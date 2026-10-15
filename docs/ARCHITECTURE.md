# Architecture: KB Assistant

The demo architecture. The production target (NestJS, SSO, job queue, Langfuse) is described in [docs/planning/solution-design.hu.md](planning/solution-design.hu.md); the task-level design with acceptance criteria is [docs/planning/demo-gap-analysis.hu.md](planning/demo-gap-analysis.hu.md). Most of the code below is still planned: see docs/TASKS.md for what exists.

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
    +--> Supabase Postgres (Frankfurt): pgvector + hungarian full-text

Local machine only:
    scripts/ingest.ts  data/docs/*.md --> chunks + embeddings --> Supabase
    scripts/eval.ts    data/golden-set.json --> pipeline --> eval/results.json
```

Query pipeline (`src/lib/pipeline.ts`): rewrite → embed → hybrid search (vector + full-text, filtered) → RRF → LLM rerank + threshold → generate (streamed, structured) → validate citations → retry once → final answer or not_found.

- Users only interact with the Next.js app. The browser never reaches OpenAI or the database.
- Third-party calls happen on the server only. Keys never reach the client.
- The API route and the eval script run the same `answerQuestion` generator, so the eval measures what users see.

## 02 Tech stack

| Layer           | Choice                                                                                              | Why this, not the obvious alternative                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Frontend        | Next.js 16 App Router, React 19, TypeScript strict                                                  | One app for UI and API; a separate NestJS backend is the production plan, not needed for a one-day demo |
| Styling         | Tailwind v4 + shadcn/ui (`base-nova`), tokens from DESIGN_SYSTEM.md                                 | Fast, accessible primitives; no custom design in scope                                                  |
| Backend         | Route handlers (`runtime = 'nodejs'`)                                                               | The `postgres` driver needs Node.js                                                                     |
| Database        | Supabase Postgres, EU (Frankfurt), pgvector                                                         | One database for vectors, full-text, filters; reachable from Vercel, unlike a local Docker Compose      |
| Queries         | Drizzle ORM + postgres.js; search in raw SQL via the Drizzle `sql` template                         | Typed schema and migrations; hybrid search needs SQL the query builder cannot express                   |
| Full-text       | Postgres `hungarian` configuration, generated `tsvector` column                                     | Hungarian stemming built in; exact terms (THM, bank names) that vector search misses                    |
| LLM integration | Vercel AI SDK (`ai` v7, `@ai-sdk/openai`) with structured output                                    | Provider-independent, streaming, Zod schemas. The plan targeted v6: verify the API before coding        |
| Models          | Generation `gpt-5.5`; rerank and rewrite `gpt-5.4-mini`; embeddings `text-embedding-3-small` (1536) | All configurable by env; reasoning effort `low`                                                         |
| Reranker        | LLM rerank, 0–10 scale, threshold `RERANK_THRESHOLD` (default 6)                                    | No extra vendor; the score doubles as the refusal threshold                                             |
| Validation      | Zod (env, front matter, request bodies, model output shape)                                         | One schema library everywhere                                                                           |
| Auth            | Basic Auth in `src/proxy.ts`, credentials in env                                                    | Public URL and public repo; SSO is out of scope                                                         |
| Hosting         | Vercel, region `fra1`, Git integration                                                              | Next to the Supabase region                                                                             |
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
  drizzle/                 generated SQL migrations (enable_vector, init, ...)
  drizzle.config.ts        migrations use DATABASE_URL_SESSION
  eval/results.json        latest eval run (committed, quoted by the README)
  scripts/                 ingest.ts, eval.ts, *-check.ts (local only; load .env.local with dotenv)
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
      client.ts            postgres.js client (prepare: false, max: 1) + drizzle
      schema.ts            documents, chunks, indexes
    lib/
      env.ts               Zod-validated env, server-only
      embeddings.ts        embedTexts, embedQuery
      pipeline.ts          answerQuestion(): the only orchestrator
      ingest/              load.ts (front matter), chunk.ts (pure)
      retrieval/           types.ts, search.ts, rrf.ts (pure), rerank.ts, rewrite.ts
      generation/          schema.ts, prompt.ts, validate.ts (pure)
      utils.ts             cn() for class names
```

Where new code belongs:

- A new page: `src/app/<route>/page.tsx`. Thin; UI only.
- A new pipeline step: `src/lib/retrieval/` or `src/lib/generation/`, called from `pipeline.ts`.
- A new third-party call: through the AI SDK in the module that owns the step. No direct `fetch` to OpenAI.
- Database access: `src/db/` (schema, client) and the search functions in `src/lib/retrieval/search.ts`. Nothing else queries the database, except `scripts/ingest.ts` and `src/app/api/banks/route.ts`.
- A new UI primitive: `src/components/ui/`, added to DESIGN_SYSTEM.md in the same commit.

## 04 Data flow

Chat request:

1. `page.tsx` sends `{ question, product, bank, history }` (history: last 6 turns, final answers only).
2. `src/proxy.ts` checks Basic Auth.
3. `/api/chat` validates the body with Zod (question ≤ 1000 chars, history ≤ 6 items) and returns 400 on failure.
4. `answerQuestion()` yields events: `rewrite?`, `partial*`, then exactly one `final` or `error`.
5. The route writes each event as one NDJSON line and stops the generator when the client aborts.
6. The UI buffers by line, shows `partial` text as unverified, and replaces it with the `final` result.

Ingestion (local): `loadDocuments()` validates every file first (all-or-nothing) → per document, skip if `contentHash` matches, otherwise delete + reinsert in one transaction with fresh chunks and embeddings → delete documents whose file is gone.

State:

- Server state: `documents` and `chunks` only. No users, conversations or messages tables.
- Client state: messages, filters, loading flag (React state). Optimistic updates: none.

Errors:

- Validation errors return 400 with `{ error }`.
- Pipeline exceptions are logged with `console.error` and become an `error` event with a generic Hungarian message. Never show stack traces or OpenAI error text.
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
- Full-text search builds an OR query (`to_tsquery('hungarian', 'a | b | c')`), not `websearch_to_tsquery`. AND semantics returns nothing for natural questions; RRF and rerank fix the ranking.
- `set local hnsw.ef_search = 200` runs inside `db.transaction()`. Outside a transaction it has no effect on the transaction pooler.
- `postgres(url, { prepare: false, max: 1 })`: the Supabase transaction pooler does not support prepared statements; one connection per serverless instance.
- `contextHeader` is stored apart from `content`. Embeddings and `tsv` include the header; the citation validator checks quotes against `content` only.
- When the validator rejects good answers, tighten the prompt's quoting rule. Do not loosen the validator.
- Conversation history lives in the client and is resent with each request. No conversation tables.
- Ingest never runs on Vercel. The local script writes to the same Supabase database production reads.
- Basic Auth protects every route, including the API, even though it is "only a demo": the URL and repo are public and the OpenAI key is real.
- File names are kebab-case (`source-card.tsx`), unlike the PascalCase names in the planning document.

## 07 Scalability and future considerations

- Expected scale: one demo session, a handful of users, 12–15 documents, under 100 chunks. Build for this.
- Known limits: one question takes 10–25 s (`maxDuration = 60`); the free Supabase project pauses after inactivity; no rate limiting beyond Basic Auth.
- Planned next (production plan): NestJS backend, SSO and roles, versioned documents with validity dates, number validation, feedback, Langfuse, eval in CI, live rates via tool calling.
- Not planned for the demo: multi-tenant, document upload, background jobs. Do not add abstractions for these.

## 08 When the agent must stop and ask

If a task needs any of the following, stop, name the conflict, and propose the smallest change that avoids it:

- Crossing a boundary in §05
- Changing a decision in §06
- Adding a table, column, index, dependency, or third-party service
- Changing the auth, the relevance threshold logic, or the citation validator rules
- Running a migration or the ingest against the shared Supabase database

## 09 Environments and configuration

| Environment | URL                                   | Deployed from | Data                                            |
| ----------- | ------------------------------------- | ------------- | ----------------------------------------------- |
| Local       | http://localhost:3000                 | your machine  | the Supabase project (no separate dev database) |
| Preview     | per-PR Vercel URL                     | pull requests | the same Supabase project                       |
| Production  | `DEMO_URL` (Vercel production domain) | `main`        | the same Supabase project                       |

Environment variables (names only; values live in Vercel and `.env.local`):

| Name                     | Used by                                                     | Server-only |
| ------------------------ | ----------------------------------------------------------- | ----------- |
| OPENAI_API_KEY           | `src/lib/env.ts` → AI SDK                                   | yes         |
| DATABASE_URL             | `src/db/client.ts` (transaction pooler, port 6543)          | yes         |
| DATABASE_URL_SESSION     | `drizzle.config.ts` (session pooler, port 5432); local only | yes         |
| GENERATION_MODEL         | generation (default `gpt-5.5`)                              | yes         |
| HELPER_MODEL             | rerank, rewrite (default `gpt-5.4-mini`)                    | yes         |
| EMBEDDING_MODEL          | embeddings (default `text-embedding-3-small`)               | yes         |
| RERANK_THRESHOLD         | rerank (default 6, 0–10)                                    | yes         |
| DEMO_USER, DEMO_PASSWORD | `src/proxy.ts`                                              | yes         |
| DEMO_URL                 | test commands and scripts; local only                       | no secret   |

Changing `EMBEDDING_MODEL` makes old embeddings incomparable: empty `documents` and `chunks` and rerun the ingest.
