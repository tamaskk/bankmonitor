// T-006: loads data/docs, chunks and embeds changed documents, and writes them
// to Atlas idempotently. Run: npm run ingest  (add `-- --force` to re-embed
// everything, e.g. after a chunking change: the content hash would not notice).
import "./load-env";

import type { ClientSession, Collection, MongoClient } from "mongodb";

import { getClient, getDb } from "@/db/client";
import {
  COLLECTIONS,
  GENERAL_BANK,
  TEXT_INDEX,
  type ChunkRecord,
  type DocumentRecord,
} from "@/db/types";
import { chunkEmbeddingInput, embedTexts } from "@/lib/embeddings";
import { chunkDocument } from "@/lib/ingest/chunk";
import { loadDocuments, type LoadedDocument } from "@/lib/ingest/load";

const INDEX_POLL_MS = 2_000;
const INDEX_TIMEOUT_MS = 60_000;

type Outcome = "new" | "updated" | "unchanged";

async function main() {
  const force = process.argv.includes("--force");

  // 1. Validate every file before touching the database (all-or-nothing).
  let documents: LoadedDocument[];
  try {
    documents = await loadDocuments();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const client = await getClient();
  const db = await getDb();
  const docsCollection = db.collection<DocumentRecord>(COLLECTIONS.documents);
  const chunksCollection = db.collection<ChunkRecord>(COLLECTIONS.chunks);

  // 2. What is already stored.
  const stored = new Map(
    (
      await docsCollection
        .find({}, { projection: { contentHash: 1, createdAt: 1 } })
        .toArray()
    ).map((doc) => [doc._id, doc]),
  );

  // 3. New or changed documents: chunk and embed first, then write in one transaction.
  const counts: Record<Outcome, number> = { new: 0, updated: 0, unchanged: 0 };
  const longest: {
    slug: string;
    chunks: number;
    maxChars: number;
    outcome: Outcome;
  }[] = [];

  for (const doc of documents) {
    const previous = stored.get(doc.slug);
    const drafts = chunkDocument(doc);
    const outcome: Outcome = !previous
      ? "new"
      : previous.contentHash === doc.contentHash && !force
        ? "unchanged"
        : "updated";
    counts[outcome]++;
    longest.push({
      slug: doc.slug,
      chunks: drafts.length,
      maxChars: Math.max(...drafts.map((d) => d.content.length)),
      outcome,
    });
    if (outcome === "unchanged") continue;

    const embeddings = await embedTexts(drafts.map(chunkEmbeddingInput));
    const banks = doc.banks.length > 0 ? doc.banks : [GENERAL_BANK];
    const chunkRecords: ChunkRecord[] = drafts.map((draft, i) => ({
      _id: `${doc.slug}#${draft.ordinal}`,
      documentId: doc.slug,
      ordinal: draft.ordinal,
      sectionPath: draft.sectionPath,
      contextHeader: draft.contextHeader,
      content: draft.content,
      products: doc.products,
      banks,
      embedding: embeddings[i],
    }));
    const documentRecord: DocumentRecord = {
      _id: doc.slug,
      title: doc.title,
      products: doc.products,
      banks: doc.banks,
      sourceUrl: doc.sourceUrl,
      updatedAt: doc.updatedAt,
      contentHash: doc.contentHash,
      createdAt: previous?.createdAt ?? new Date(),
    };

    await inTransaction(client, async (session) => {
      await chunksCollection.deleteMany({ documentId: doc.slug }, { session });
      await docsCollection.replaceOne({ _id: doc.slug }, documentRecord, {
        upsert: true,
        session,
      });
      await chunksCollection.insertMany(chunkRecords, { session });
    });
    console.log(
      `${outcome.padEnd(9)} ${doc.slug} (${chunkRecords.length} chunks)`,
    );
  }

  // 4. Documents whose file is gone.
  const slugs = new Set(documents.map((doc) => doc.slug));
  const removed = [...stored.keys()].filter((slug) => !slugs.has(slug));
  for (const slug of removed) {
    await inTransaction(client, async (session) => {
      await chunksCollection.deleteMany({ documentId: slug }, { session });
      await docsCollection.deleteOne({ _id: slug }, { session });
    });
    console.log(`deleted   ${slug}`);
  }

  // 5. Wait until the text index sees every chunk.
  const total = await chunksCollection.countDocuments();
  await waitForTextIndex(chunksCollection, total);

  // 6. Summary.
  console.table(longest);
  console.log(
    `new: ${counts.new}, updated: ${counts.updated}, unchanged: ${counts.unchanged}, deleted: ${removed.length}; chunks in database: ${total}`,
  );
}

async function inTransaction(
  client: MongoClient,
  work: (session: ClientSession) => Promise<void>,
) {
  const session = client.startSession();
  try {
    await session.withTransaction(work);
  } finally {
    await session.endSession();
  }
}

async function waitForTextIndex(
  chunks: Collection<ChunkRecord>,
  expected: number,
) {
  const deadline = Date.now() + INDEX_TIMEOUT_MS;
  for (;;) {
    const [meta] = await chunks
      .aggregate<{ count?: { total?: number } }>([
        {
          $searchMeta: {
            index: TEXT_INDEX.name,
            exists: { path: "content" },
            count: { type: "total" },
          },
        },
      ])
      .toArray();
    const indexed = meta?.count?.total ?? 0;
    if (indexed === expected) {
      console.log(`text index is up to date (${indexed} chunks)`);
      return;
    }
    if (Date.now() > deadline) {
      console.warn(
        `warning: text index shows ${indexed} of ${expected} chunks after ${INDEX_TIMEOUT_MS / 1000} s; search may be stale for a moment`,
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, INDEX_POLL_MS));
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      "ingest failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await getClient().catch(() => undefined))?.close();
  });
