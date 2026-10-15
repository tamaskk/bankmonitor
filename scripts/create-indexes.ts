// T-003: creates the chunks collection, its documentId index and the two
// Atlas search indexes, then waits until both are queryable. Idempotent:
// existing indexes are left alone. Run: npm run db:indexes
import "./load-env";

import type { Collection } from "mongodb";

import { getClient, getDb } from "@/db/client";
import {
  COLLECTIONS,
  TEXT_INDEX,
  VECTOR_INDEX,
  type ChunkRecord,
} from "@/db/types";

const SEARCH_INDEXES = [VECTOR_INDEX, TEXT_INDEX];
const POLL_INTERVAL_MS = 5_000;
const TIMEOUT_MS = 3 * 60_000;

type SearchIndexInfo = { name: string; status?: string; queryable?: boolean };

async function listSearchIndexes(
  chunks: Collection<ChunkRecord>,
): Promise<SearchIndexInfo[]> {
  return (await chunks.listSearchIndexes().toArray()) as SearchIndexInfo[];
}

async function waitUntilQueryable(chunks: Collection<ChunkRecord>) {
  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    const indexes = await listSearchIndexes(chunks);
    const states = SEARCH_INDEXES.map((wanted) => {
      const found = indexes.find((index) => index.name === wanted.name);
      return {
        name: wanted.name,
        status: found?.status ?? "missing",
        queryable: found?.queryable === true,
      };
    });
    console.log(
      states
        .map(
          (s) => `${s.name}: ${s.status}${s.queryable ? " (queryable)" : ""}`,
        )
        .join(", "),
    );
    if (states.every((s) => s.queryable)) return;
    if (Date.now() > deadline) {
      throw new Error(
        `search indexes not queryable after ${TIMEOUT_MS / 1000} s`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function main() {
  const db = await getDb();

  // createSearchIndex can fail on a collection that does not exist yet.
  const existing = await db
    .listCollections({ name: COLLECTIONS.chunks }, { nameOnly: true })
    .toArray();
  if (existing.length === 0) {
    await db.createCollection(COLLECTIONS.chunks);
    console.log(`created collection ${COLLECTIONS.chunks}`);
  }
  const chunks = db.collection<ChunkRecord>(COLLECTIONS.chunks);

  const indexName = await chunks.createIndex({ documentId: 1 });
  console.log(`index ${indexName}: ok`);

  const present = new Set(
    (await listSearchIndexes(chunks)).map((index) => index.name),
  );
  for (const index of SEARCH_INDEXES) {
    if (present.has(index.name)) {
      console.log(`search index ${index.name}: exists, not changed`);
      continue;
    }
    await chunks.createSearchIndex({
      name: index.name,
      type: index.type,
      definition: index.definition,
    });
    console.log(`search index ${index.name}: created`);
  }

  await waitUntilQueryable(chunks);
  console.log("all search indexes are queryable");
}

main()
  .catch((error: unknown) => {
    console.error(
      "create-indexes failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await getClient().catch(() => undefined))?.close();
  });
