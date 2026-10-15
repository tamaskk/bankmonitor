---
paths:
  - "src/db/**"
  - "drizzle/**"
  - "drizzle.config.ts"
  - "scripts/ingest.ts"
  - "scripts/*-check.ts"
  - "src/lib/retrieval/search.ts"
  - "src/app/api/banks/**"
---

# Database (Supabase Postgres + Drizzle)

- Schema changes (new table, column, index, removed or renamed field) need approval: docs/ARCHITECTURE.md §08. There is one shared Supabase database for local, preview and production.
- Migrations: `npm run db:generate -- --name <name>` then `npm run db:migrate` (session pooler, `DATABASE_URL_SESSION`). Never edit an applied migration. Destructive migrations and `drizzle-kit drop` need explicit approval. Ask before running any migration.
- The app client is `postgres(env.DATABASE_URL, { prepare: false, max: 1 })` (transaction pooler); create it once at module level, never inside a request handler.
- Only `src/db/`, `src/lib/retrieval/search.ts`, `/api/banks` and `scripts/` touch the database.
- Raw SQL only through the Drizzle `sql` template with interpolated parameters. Never `sql.raw()` or string concatenation with user input. Vectors pass as `${JSON.stringify(embedding)}::vector`.
- Filters are pre-filters in SQL (`products && array[...]`, `banks @> array[...] or cardinality(banks) = 0`), never post-filters in TypeScript.
- `set local hnsw.ef_search = 200` and the vector query run inside one `db.transaction()`.
- The `tsv` column is generated (`to_tsvector('hungarian', context_header || ' ' || content)`); never write to it.
- Ingest is idempotent: skip unchanged `contentHash`, replace a changed document in one transaction (chunks cascade), delete documents whose file is gone. Validate all files before writing anything.
- Changing `EMBEDDING_MODEL` requires emptying `documents` and `chunks` and a full re-ingest.
