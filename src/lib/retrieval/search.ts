import "server-only";

import type { Document } from "mongodb";

import { getDb } from "@/db/client";
import {
  COLLECTIONS,
  TEXT_INDEX,
  VECTOR_INDEX,
  type ChunkRecord,
} from "@/db/types";
import { buildFilter, extractWordTokens } from "@/lib/retrieval/query";
import type { Candidate, Filters } from "@/lib/retrieval/types";

export const SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
// The documented >= 10-20x guideline: with strict pre-filters the vector
// index otherwise collects too few matching candidates (ARCHITECTURE.md §06).
const NUM_CANDIDATES = 200;
// A search that takes longer is broken, not slow; fail instead of holding
// the request open.
const MAX_TIME_MS = 5000;

// Keeps numCandidates (limit × 10) under Atlas's 10,000 cap and rejects
// negative or fractional values before they reach the pipeline.
function clampLimit(limit: number): number {
  return Math.min(Math.max(1, Math.trunc(limit)), MAX_SEARCH_LIMIT);
}

export async function vectorSearch(
  embedding: number[],
  filters: Filters,
  limit = SEARCH_LIMIT,
  signal?: AbortSignal,
): Promise<Candidate[]> {
  const size = clampLimit(limit);
  const { products, banks } = buildFilter(filters);
  const filter: Document = {};
  if (products) filter.products = { $in: products };
  if (banks) filter.banks = { $in: banks };

  return runSearch(
    [
      {
        $vectorSearch: {
          index: VECTOR_INDEX.name,
          path: "embedding",
          queryVector: embedding,
          numCandidates: Math.max(NUM_CANDIDATES, size * 10),
          limit: size,
          ...(Object.keys(filter).length > 0 && { filter }),
        },
      },
    ],
    signal,
  );
}

export async function fullTextSearch(
  question: string,
  filters: Filters,
  limit = SEARCH_LIMIT,
  signal?: AbortSignal,
): Promise<Candidate[]> {
  const size = clampLimit(limit);
  const { products, banks } = buildFilter(filters);
  const query = extractWordTokens(question);
  if (query === "") return [];
  const filter: Document[] = [];
  if (products) filter.push({ in: { path: "products", value: products } });
  if (banks) filter.push({ in: { path: "banks", value: banks } });

  return runSearch(
    [
      {
        $search: {
          index: TEXT_INDEX.name,
          compound: {
            // `text` matches any term (OR); RRF and rerank fix the ranking
            // (ARCHITECTURE.md §06).
            must: [{ text: { query, path: ["contextHeader", "content"] } }],
            ...(filter.length > 0 && { filter }),
          },
        },
      },
      { $limit: size },
    ],
    signal,
  );
}

/**
 * Both searches in parallel; the caller merges them with `rrf`. Pass the
 * request's signal so a closed connection stops the queries.
 */
export async function hybridSearch(
  question: string,
  embedding: number[],
  filters: Filters,
  signal?: AbortSignal,
): Promise<{ vector: Candidate[]; fullText: Candidate[] }> {
  const [vector, fullText] = await Promise.all([
    vectorSearch(embedding, filters, SEARCH_LIMIT, signal),
    fullTextSearch(question, filters, SEARCH_LIMIT, signal),
  ]);
  return { vector, fullText };
}

// Joins the document metadata and projects to `Candidate`. An inclusion
// projection, so the embedding never leaves the database. `$unwind` drops a
// chunk without its document; the ingest transaction keeps them in sync.
async function runSearch(
  searchStages: Document[],
  signal?: AbortSignal,
): Promise<Candidate[]> {
  const db = await getDb();
  return db
    .collection<ChunkRecord>(COLLECTIONS.chunks)
    .aggregate<Candidate>(
      [
        ...searchStages,
        {
          $lookup: {
            from: COLLECTIONS.documents,
            localField: "documentId",
            foreignField: "_id",
            as: "document",
          },
        },
        { $unwind: "$document" },
        {
          $project: {
            _id: 0,
            id: "$_id",
            slug: "$documentId",
            title: "$document.title",
            sectionPath: 1,
            contextHeader: 1,
            content: 1,
            products: 1,
            banks: 1,
            sourceUrl: "$document.sourceUrl",
            updatedAt: "$document.updatedAt",
          },
        },
      ],
      { maxTimeMS: MAX_TIME_MS, signal },
    )
    .toArray();
}
