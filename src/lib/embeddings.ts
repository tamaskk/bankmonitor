import "server-only";

import { embed, embedMany } from "ai";

import { EMBEDDING_DIMENSIONS } from "@/db/types";
import { env } from "@/lib/env";
import { openai } from "@/lib/openai";

const model = openai.embedding(env.EMBEDDING_MODEL);

// The vector index has a fixed dimension count; a model change without a new
// index would otherwise fail only at query time.
function assertDimensions(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `${env.EMBEDDING_MODEL} returned ${embedding.length} dimensions, the index expects ${EMBEDDING_DIMENSIONS}`,
    );
  }
}

// embedMany splits large inputs into several API calls on its own.
export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  const { embeddings } = await embedMany({ model, values });
  embeddings.forEach(assertDimensions);
  return embeddings;
}

export async function embedQuery(value: string): Promise<number[]> {
  const { embedding } = await embed({ model, value });
  assertDimensions(embedding);
  return embedding;
}

// What gets embedded for a chunk: the context header carries title, product,
// bank and section, so a bare "Futamidő" paragraph still lands near its product.
export function chunkEmbeddingInput(chunk: {
  contextHeader: string;
  content: string;
}): string {
  return `${chunk.contextHeader}\n\n${chunk.content}`;
}
