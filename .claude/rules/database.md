---
paths:
  - "src/db/**"
  - "scripts/setup-db.ts"
  - "scripts/ingest.ts"
  - "scripts/*-check.ts"
  - "src/lib/retrieval/search.ts"
  - "src/app/api/banks/**"
---

# Database (MongoDB Atlas M0 + official driver)

- Schema changes (new collection, field, index or search index definition) need approval: docs/ARCHITECTURE.md §08. There is one shared Atlas cluster for local, preview and production, and M0 allows at most 3 search indexes (we use 2).
- Collections, indexes and search indexes are created only by `scripts/setup-db.ts`, idempotently (create if missing, update the definition if it changed). Ask before running `npm run db:setup`, `npm run ingest`, or any write.
- One `MongoClient` cached on `globalThis` in `src/db/client.ts` (`maxPoolSize: 5`); never connect inside a request handler.
- Only `src/db/`, `src/lib/retrieval/search.ts`, `/api/banks` and `scripts/` touch the database.
- NoSQL injection: never pass request objects or unvalidated values into a filter or pipeline. Values come from Zod-parsed strings and enums; reject anything that starts with `$`. The `$search` query string is built from extracted word tokens.
- Filters are pre-filters inside `$vectorSearch.filter` and the `$search` `compound.filter`, never `$match` after the search stage: post-filtering returns too few results.
- `$vectorSearch` supports only simple match expressions in `filter` (`$eq`, `$in`, `$and`, `$or`, ranges, `$exists`); every filtered field must be declared as a `filter` field in the vector index. Use `bankGeneral: true` for bank-independent chunks, not empty-array checks.
- `$vectorSearch` and `$search` must be the first stage of their pipeline. Read scores with `{ $meta: "vectorSearchScore" }` / `{ $meta: "searchScore" }`; project away `embedding` from results.
- Search indexes are eventually consistent: after a write, poll until the index is queryable before testing search.
- Ingest is idempotent: skip unchanged `contentHash`, replace a changed document and its chunks in one `session.withTransaction`, delete documents whose file is gone. Validate all files before writing anything.
- Never `drop()` a collection or `deleteMany({})` without explicit approval (the bash hook asks too).
- Changing `EMBEDDING_MODEL` requires emptying `documents` and `chunks` (and new dimensions in the vector index) plus a full re-ingest.
