# Tasks

Derived from docs/PRD.md §05 and docs/planning/demo-gap-analysis.hu.md (task numbers match the plan; its "Megoldás" and "Elfogadási feltételek" sections are the spec). Tick a box only when AGENTS.md §07 is met. IDs: T-###; feature refs: F#. Time box: 12 hours in total; see the plan's §3 for the cut order if time runs short.

## Now

- [ ] T-000 (F1, F7) Write the inputs: 12–15 `data/docs/*.md` from public Bankmonitor articles (own words, front matter `title`, `products`, `banks`, `source_url`, `updated_at`, `##` sections) and `data/golden-set.json` (15 questions, 4 unanswerable)
- [ ] T-002 (F1) Supabase project in Frankfurt, `src/db/client.ts`, `scripts/db-check.ts` prints Hungarian lexemes
- [ ] T-003 (F1) Drizzle schema (`documents`, `chunks`, HNSW + GIN indexes), `enable_vector` custom migration, `init` migration

## Next

- [ ] T-004 (F1) Markdown loader with Zod front matter validation, all-or-nothing (`src/lib/ingest/load.ts`)
- [ ] T-005 (F1) Section-based chunking with context header, tables never split (`src/lib/ingest/chunk.ts`)
- [ ] T-006 (F1) Embeddings and idempotent `npm run ingest` (`src/lib/embeddings.ts`, `scripts/ingest.ts`)
- [ ] T-007 (F3) Hybrid search with product and bank pre-filters (`src/lib/retrieval/search.ts`)
- [ ] T-008 (F2) RRF merge (`src/lib/retrieval/rrf.ts`)
- [ ] T-009 (F5) LLM rerank and relevance threshold (`src/lib/retrieval/rerank.ts`)
- [ ] T-010 (F6) Follow-up query rewrite (`src/lib/retrieval/rewrite.ts`)
- [ ] T-011 (F2, F4) System prompt and structured output schema; verify the AI SDK v7 API first (`src/lib/generation/`)
- [ ] T-012 (F4, F5) Citation validator, one retry, not_found (`src/lib/generation/validate.ts`)
- [ ] T-013 (F2) Shared `answerQuestion` pipeline generator (`src/lib/pipeline.ts`)
- [ ] T-014 (F2) Streaming NDJSON chat endpoint (`src/app/api/chat/route.ts`)
- [ ] T-015 (F3) Bank list endpoint; with `cacheComponents` drop `dynamic = 'force-dynamic'` and call `await connection()` before the query (see `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`) (`src/app/api/banks/route.ts`)
- [ ] T-018 Basic Auth proxy (`src/proxy.ts`); decide whether `/api/health` is excluded
- [ ] T-016 (F2, F3, F6) Chat UI with filters and history (`src/app/page.tsx`, `src/components/chat/filter-bar.tsx`, `chat-input.tsx`)
- [ ] T-017 (F4, F5) Answer view, markers and source cards (`src/components/chat/answer-view.tsx`, `source-card.tsx`)
- [ ] T-019 Vitest unit tests: validate (6), rrf (4), chunk (4)
- [ ] T-020 (F7) Eval script, threshold tuning, `eval/results.json`
- [ ] T-021 Public GitHub repo `kb-assistant`, `vercel.json` with `fra1`, Vercel env, deploy
- [ ] T-022 README: what, Mermaid architecture, accuracy layers, decisions, eval results, local setup
- [ ] T-023 Rehearsal of the 7 scenarios on the live URL, screen recording as a fallback

## Later (after v1)

- [ ] Number validation in the validator
- [ ] Document versioning with validity dates
- [ ] Feedback buttons and an admin UI
- [ ] SSO, roles, audit log
- [ ] Langfuse tracing, LLM-as-judge, eval in CI
- [ ] Live rates via tool calling

## Done

- [x] T-001 Project scaffold: Next.js 16, Tailwind v4, shadcn/ui, dependencies, scripts, `src/lib/env.ts`, `.env.example`, git (data inputs moved to T-000)
