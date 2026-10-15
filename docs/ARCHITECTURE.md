# Architecture: KB Assistant

The demo architecture. The production target (NestJS, SSO, job queue, Langfuse) is described in [docs/planning/solution-design.hu.md](planning/solution-design.hu.md); the task-level design with acceptance criteria is [docs/planning/demo-gap-analysis.hu.md](planning/demo-gap-analysis.hu.md). Most of the code below is still planned: see docs/TASKS.md for what exists.

The database is MongoDB Atlas, not the Supabase Postgres described in the planning document. Where the planning document's database-specific sections (tasks 2, 3, 6, 7, 15, 21: Supabase, Drizzle, pgvector, `tsvector`, SQL) disagree with this file, this file wins; the rest of those tasks (inputs, outputs, acceptance criteria) still applies.

## 01 System overview

```
Browser (loan expert)
    |  Basic Auth (src/proxy.ts)
    v
Next.js app on Vercel (fra1)
    |-- page.tsx: chat UI, client-side history
    |-- POST /api/chat  --> pipeline (NDJSON stream)
    |-- GET  /api/banks
    |
    +--> OpenAI API: embeddings, rerank, query rewrite, generation
    +--> MongoDB Atlas M0 (AWS Frankfurt, eu-central-1):
           Atlas Vector Search + Atlas Search (lucene.hungarian)

Local machine only:
    scripts/create-indexes.ts  collections, indexes, search indexes (idempotent)
    scripts/ingest.ts    data/docs/*.md --> chunks + embeddings --> Atlas
    scripts/eval.ts      data/golden-set.json --> pipeline --> eval/results.json
```

Query pipeline (`src/lib/pipeline.ts`): rewrite → embed → hybrid search (`$vectorSearch` and `$search`, both pre-filtered, in parallel) → RRF in TypeScript → LLM rerank + threshold → generate (streamed, structured) → validate citations → retry once → final answer or not_found.

- Users only interact with the Next.js app. The browser never reaches OpenAI or the database.
- Third-party calls happen on the server only. Keys never reach the client.
- The API route and the eval script run the same `answerQuestion` generator, so the eval measures what users see.

## 02 Tech stack

| Layer           | Choice                                                                                              | Why this, not the obvious alternative                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Frontend        | Next.js 16 App Router, React 19, TypeScript strict                                                  | One app for UI and API; a separate NestJS backend is the production plan, not needed for a one-day demo |
| Styling         | Tailwind v4 + shadcn/ui (`base-nova`), tokens from DESIGN_SYSTEM.md                                 | Fast, accessible primitives; no custom design in scope                                                  |
| Backend         | Route handlers (`runtime = 'nodejs'`)                                                               | The MongoDB driver needs Node.js                                                                        |
| Database        | MongoDB Atlas free M0 cluster, AWS Frankfurt (`eu-central-1`); no local database                    | Free, EU, reachable from Vercel; vector and full-text search in the same cluster                        |
| Data access     | Official `mongodb` Node.js driver (v7), no ODM                                                      | Aggregation pipelines with `$vectorSearch` / `$search` are the whole query layer; an ODM adds nothing   |
| Vector search   | Atlas Vector Search, cosine, 1536 dimensions, `products` / `banks` as filter fields                 | Pre-filtering inside the index                                                                          |
| Full-text       | Atlas Search with the `lucene.hungarian` analyzer                                                   | Hungarian stemming; exact terms (THM, bank names) that vector search misses                             |
| Hybrid merge    | RRF in TypeScript over the two result lists                                                         | Native `$rankFusion` runs its sub-pipelines sequentially and its M0 support is not documented           |
| LLM integration | Vercel AI SDK (`ai` v7, `@ai-sdk/openai`) with structured output                                    | Provider-independent, streaming, Zod schemas. The plan targeted v6: verify the API before coding        |
| Models          | Generation `gpt-5.5`; rerank and rewrite `gpt-5.4-mini`; embeddings `text-embedding-3-small` (1536) | All configurable by env; reasoning effort `low`                                                         |
| Reranker        | LLM rerank, 0–10 scale, threshold `RERANK_THRESHOLD` (default 6)                                    | No extra vendor; the score doubles as the refusal threshold                                             |
| Validation      | Zod (env, front matter, request bodies, model output shape)                                         | One schema library everywhere                                                                           |
| Auth            | Basic Auth in `src/proxy.ts`, credentials in env                                                    | Public URL and public repo; SSO is out of scope                                                         |
| Hosting         | Vercel, region `fra1`, Git integration                                                              | Next to the Atlas region                                                                                |
| Testing         | Vitest (pure modules) + eval script on the golden set                                               | Unit tests guard the validator; the eval measures accuracy. No Playwright in the demo                   |

Do not add a dependency that overlaps with a row in this table without asking.

## 03 Project structure

```
/
  AGENTS.md, CLAUDE.md     agent instructions
  docs/                    PRD, design system, this file, security, tasks, planning/ (Hungarian originals)
  data/
    docs/*.md              knowledge base: Bankmonitor articles summarised, with front matter
    golden-set.json        15 eval questions
  eval/results.json        latest eval run (committed, quoted by the README)
  scripts/                 load-env.ts (import first), db-check.ts, create-indexes.ts, ingest.ts, search-check.ts, rerank-check.ts, rewrite-check.ts, generate-check.ts, pipeline-check.ts, eval.ts (local only; run via npm scripts with --conditions=react-server)
  tests/                   Vitest unit tests (*.test.ts)
  src/
    proxy.ts               Basic Auth for every route
    instrumentation.ts     validates env at server start (not during build)
    app/
      page.tsx             chat UI (client component)
      api/chat/route.ts    POST, NDJSON stream of PipelineEvent
      api/banks/route.ts   GET, distinct banks from chunks
      api/health/route.ts  GET, { status: "ok" }
    components/
      ui/                  shadcn primitives + empty-state (DESIGN_SYSTEM.md §06)
      chat/                filter-bar, chat-input, answer-view, source-card
    db/
      client.ts            cached MongoClient promise on globalThis (failed connects not cached), getClient(), getDb()
      types.ts             collection names, PRODUCTS, DocumentRecord, ChunkRecord, search index definitions
    lib/
      env.ts               Zod-validated env, server-only
      embeddings.ts        embedTexts, embedQuery, chunkEmbeddingInput (header + content)
      openai.ts            the one OpenAI provider, bound to env.OPENAI_API_KEY
      pipeline.ts          answerQuestion(): the only orchestrator
      ingest/              load.ts (front matter), chunk.ts (pure)
      retrieval/           types.ts, query.ts (pure: filter schema, word tokens), search.ts, rrf.ts (pure), rerank.ts, rewrite.ts
      generation/          schema.ts, prompt.ts, validate.ts (pure), model.ts (shared generation options)
      utils.ts             cn() for class names
```

Data model (two collections in database `MONGODB_DB`):

| Collection  | Fields                                                                                                                                                                                     | Indexes                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `documents` | `_id` (slug), `title`, `products[]`, `banks[]`, `sourceUrl`, `updatedAt` (YYYY-MM-DD), `contentHash`, `createdAt`                                                                          | `_id`                                                                           |
| `chunks`    | `_id` (`<slug>#<ordinal>`), `documentId` (slug), `ordinal`, `sectionPath`, `contextHeader`, `content`, `products[]`, `banks[]` (`["altalanos"]` when not bank-specific), `embedding[1536]` | `documentId_1`; vector search index `chunks_vector`; search index `chunks_text` |

Search indexes (M0 allows at most 3 Atlas Search + Vector Search indexes in total; we use 2):

- `chunks_vector` (type `vectorSearch`): `embedding` (1536, cosine); filter fields `products`, `banks`.
- `chunks_text` (type `search`, static mapping): `contextHeader` and `content` as `string` with the `lucene.hungarian` analyzer; `products`, `banks` as `token`.

Where new code belongs:

- A new page: `src/app/<route>/page.tsx`. Thin; UI only.
- A new pipeline step: `src/lib/retrieval/` or `src/lib/generation/`, called from `pipeline.ts`.
- A new third-party call: through the AI SDK in the module that owns the step. No direct `fetch` to OpenAI.
- Database access: `src/db/` (client, collections) and the search functions in `src/lib/retrieval/search.ts`. Nothing else queries the database, except `scripts/` and `src/app/api/banks/route.ts`.
- A new UI primitive: `src/components/ui/`, added to DESIGN_SYSTEM.md in the same commit.

## 04 Data flow

Chat request:

1. `page.tsx` sends `{ question, product, bank, history }` (history: last 6 turns, final answers only).
2. `src/proxy.ts` checks Basic Auth.
3. `/api/chat` validates the body with Zod (question ≤ 1000 chars, history ≤ 6 items) and returns 400 on failure.
4. `answerQuestion()` yields events: `rewrite?`, `partial*`, then exactly one `final` or `error`.
5. The route writes each event as one NDJSON line and stops the generator when the client aborts.
6. The UI buffers by line, shows `partial` text as unverified, and replaces it with the `final` result.

Filters, applied inside both search stages (pre-filter, never after):

- Product (unless `osszes`): `products` in `[product, 'altalanos']`.
- Bank (if given): `banks` in `[bank, "altalanos"]`.

Ingestion (local): `loadDocuments()` validates every file first (all-or-nothing) → per document, skip if `contentHash` matches, otherwise replace the document and its chunks in one transaction with fresh embeddings → delete documents (and chunks) whose file is gone → wait until both search indexes report the new data as queryable before the script says done.

State:

- Server state: `documents` and `chunks` only. No users, conversations or messages collections.
- Client state: messages, filters, loading flag (React state). Optimistic updates: none.

Errors:

- Validation errors return 400 with `{ error }`.
- Pipeline exceptions are logged with `console.error` and become an `error` event with a generic Hungarian message. Never show stack traces, OpenAI or MongoDB error text.
- Rerank failure is an error, never "generate without the threshold".

## 05 Boundaries

Dependencies flow one way: app → components → (types only); app/api → lib/pipeline → lib/retrieval, lib/generation → db, AI SDK.

Allowed:

- Route handlers import `pipeline`, `env`, `db` (banks only) and Zod schemas.
- `pipeline.ts` imports retrieval, generation, embeddings.
- Client components import types from `lib/pipeline.ts` and `lib/retrieval/types.ts` (type-only imports).

Never:

- Client components import `db`, `env`, `embeddings` or any module that calls OpenAI.
- `chunk.ts`, `rrf.ts` and `validate.ts` import `env.ts` or the database client. They stay pure so the unit tests run without `.env.local`.
- The API route or the eval script reimplements a pipeline step instead of calling `answerQuestion`.
- Anything in the client bundle reads a secret. `env.ts` and `db/client.ts` import `server-only`.

## 06 Decisions that look wrong but are intentional

The agent must not "fix" these.

- No `temperature` parameter anywhere. The GPT-5 family does not support it reliably; determinism comes from the prompt, the schema and the validator.
- No `streamObject` / `generateObject`: structured output goes through `streamText` / `generateText` with `Output.object` (deprecated since AI SDK 6; re-check for v7).
- The answer streams before it is validated. The UI marks it as unverified and replaces it with the final result. This is the accepted trade-off for responsiveness.
- LLM rerank instead of a cross-encoder: no extra vendor, and the score is the refusal threshold. Results below `RERANK_THRESHOLD` are dropped even if that leaves nothing.
- Output schemas have no Zod `min` / `max`: OpenAI strict structured output rejects some JSON Schema keywords. Range checks happen in code.
- Two separate queries plus RRF in TypeScript, not `$rankFusion`: the two run in parallel, and `$rankFusion` support on M0 is not documented.
- Chunks carry only `products` and `banks` from their document. Display fields (`title`, `sourceUrl`, `updatedAt`) are read from `documents` by `_id` (one `find` with `$in` over the reranked slugs), not copied onto chunks.
- Bank-independent documents store `banks: ["altalanos"]` in the database (front matter keeps `banks: []`; the ingest maps it): the vector search pre-filter cannot express "empty array". `altalanos` never appears in the bank list (`/api/banks`).
- String `_id`s are deterministic (`slug`, `<slug>#<ordinal>`): re-running the ingest cannot create duplicates, and the eval and debugging work with slugs directly.
- Full-text uses the `text` operator over `contextHeader` and `content`, which matches any term (OR semantics). Do not switch to `phrase` or require all terms: natural questions would return nothing; RRF and rerank fix the ranking.
- `numCandidates: 200` for `limit: 20` (the documented ≥ 20× guideline): filtered vector queries need the extra candidates.
- One `MongoClient` cached on `globalThis`, small pool (`maxPoolSize: 5`): serverless functions and hot reload must not open a new pool per request.
- `contextHeader` is stored apart from `content`. Embeddings and the text index include the header; the citation validator checks quotes against `content` only.
- When the validator rejects good answers, tighten the prompt's quoting rule. Do not loosen the validator.
- Conversation history lives in the client and is resent with each request. No conversation collections.
- Ingest never runs on Vercel. The local script writes to the same Atlas cluster production reads.
- Basic Auth protects every route, including the API, even though it is "only a demo": the URL and repo are public and the OpenAI key is real.
- File names are kebab-case (`source-card.tsx`), unlike the PascalCase names in the planning document.

## 07 Scalability and future considerations

- Expected scale: one demo session, a handful of users, 12–15 documents, under 100 chunks. Build for this; M0 limits (512 MB storage, 3 search indexes, shared resources) are far away.
- Known limits: one question takes 10–25 s (`maxDuration = 60`); search indexes are eventually consistent (seconds after a write); M0 clusters pause after long inactivity; no rate limiting beyond Basic Auth.
- Planned next (production plan): NestJS backend, SSO and roles, versioned documents with validity dates, number validation, feedback, Langfuse, eval in CI, live rates via tool calling. The production plan's database choice (Postgres) is open again after this change.
- Not planned for the demo: multi-tenant, document upload, background jobs. Do not add abstractions for these.

## 08 When the agent must stop and ask

If a task needs any of the following, stop, name the conflict, and propose the smallest change that avoids it:

- Crossing a boundary in §05
- Changing a decision in §06
- Adding a collection, field, index, search index, dependency, or third-party service
- Changing the auth, the relevance threshold logic, or the citation validator rules
- Running `db:indexes`, the ingest, or any write against the shared Atlas cluster

## 09 Environments and configuration

| Environment | URL                                   | Deployed from | Data                                     |
| ----------- | ------------------------------------- | ------------- | ---------------------------------------- |
| Local       | http://localhost:3000                 | your machine  | the Atlas M0 cluster (no local database) |
| Preview     | per-PR Vercel URL                     | pull requests | the same cluster                         |
| Production  | `DEMO_URL` (Vercel production domain) | `main`        | the same cluster                         |

Atlas network access must allow Vercel's dynamic egress IPs (`0.0.0.0/0` on the free tier); the database user is the only gate, so it gets a long random password and the `readWrite` role on `MONGODB_DB` only.

Environment variables (names only; values live in Vercel and `.env.local`):

| Name                     | Used by                                                 | Server-only |
| ------------------------ | ------------------------------------------------------- | ----------- |
| OPENAI_API_KEY           | `src/lib/env.ts` → AI SDK                               | yes         |
| MONGODB_URI              | `src/db/client.ts` (`mongodb+srv://` connection string) | yes         |
| MONGODB_DB               | database name (default `kb_assistant`)                  | yes         |
| GENERATION_MODEL         | generation (default `gpt-5.5`)                          | yes         |
| HELPER_MODEL             | rerank, rewrite (default `gpt-5.4-mini`)                | yes         |
| EMBEDDING_MODEL          | embeddings (default `text-embedding-3-small`)           | yes         |
| RERANK_THRESHOLD         | rerank (default 6, 0–10)                                | yes         |
| DEMO_USER, DEMO_PASSWORD | `src/proxy.ts`                                          | yes         |
| DEMO_URL                 | test commands and scripts; local only                   | no secret   |

Changing `EMBEDDING_MODEL` makes old embeddings incomparable: empty `documents` and `chunks`, rerun `db:indexes` if the dimensions change, then rerun the ingest.
