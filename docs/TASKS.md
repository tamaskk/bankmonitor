# Tasks

Derived from docs/PRD.md §05 and docs/planning/demo-gap-analysis.hu.md (task numbers match the plan; its "Megoldás" and "Elfogadási feltételek" sections are the spec). Tick a box only when AGENTS.md §07 is met. IDs: T-###; feature refs: F#. Time box: 12 hours in total; see the plan's §3 for the cut order if time runs short.

## Now

## Next

- [x] T-004 (F1) Markdown loader with Zod front matter validation, all-or-nothing (`src/lib/ingest/load.ts`)
- [x] T-005 (F1) Section-based chunking with context header, tables never split (`src/lib/ingest/chunk.ts`)
- [x] T-006 (F1) Embeddings and idempotent `npm run ingest` (`src/lib/embeddings.ts`, `scripts/ingest.ts`)
- [x] T-007 (F3) Hybrid search with product and bank pre-filters (`src/lib/retrieval/search.ts`)
- [x] T-008 (F2) RRF merge (`src/lib/retrieval/rrf.ts`)
- [x] T-009 (F5) LLM rerank and relevance threshold (`src/lib/retrieval/rerank.ts`)
- [x] T-010 (F6) Follow-up query rewrite (`src/lib/retrieval/rewrite.ts`)
- [x] T-011 (F2, F4) System prompt and structured output schema; verify the AI SDK v7 API first (`src/lib/generation/`)
- [x] T-012 (F4, F5) Citation validator, one retry, not_found (`src/lib/generation/validate.ts`)
- [x] T-013 (F2) Shared `answerQuestion` pipeline generator (`src/lib/pipeline.ts`)
- [x] T-014 (F2) Streaming NDJSON chat endpoint (`src/app/api/chat/route.ts`)
- [x] T-015 (F3) Bank list endpoint; with `cacheComponents` drop `dynamic = 'force-dynamic'` and call `await connection()` before the query (see `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`) (`src/app/api/banks/route.ts`)
- [x] T-018 Basic Auth proxy (`src/proxy.ts`); `/api/health` stays behind Basic Auth (smoke check uses `curl -u`)
- [x] T-016 (F2, F3, F6) Chat UI with filters and history (`src/app/page.tsx`, `src/components/chat/filter-bar.tsx`, `chat-input.tsx`)
- [x] T-017 (F4, F5) Answer view, markers and source cards (`src/components/chat/answer-view.tsx`, `source-card.tsx`)
- [x] T-019 Vitest unit tests: validate, rrf and chunk spec cases (plus proxy, prompt, query, loader, chat); all run without `.env.local`; mutation check on `normalize` fails as it should
- [x] T-020 (F7) Eval script and `eval/results.json`: recall@5, citation accuracy, correct refusal and answer rate all 100% at RERANK_THRESHOLD=6 (no threshold change needed)
- [x] T-021 Public GitHub repo `tamaskk/bankmonitor`, `vercel.json` with `fra1`, Vercel env, deploy — live at https://bankmonitor.vercel.app (fra1): 401 without credentials, /api/banks 200, a question answered with citations, no function errors
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

- [x] T-003 `src/db/types.ts`, `npm run db:indexes` (idempotent): `documentId_1`, `chunks_vector` and `chunks_text` READY; Hungarian stemming verified ("hiteleket" finds "hitel")
- [x] T-002 Atlas connection: `src/db/client.ts`, `npm run db:check` (ping ok, MongoDB 8.0.34, database `kb_assistant`)
- [x] T-000 Inputs: 15 `data/docs/*.md` (4 mortgage + CIB Bank, 4 personal loan incl. MBH Bank, 3 account incl. OTP Bank, 3 general) and `data/golden-set.json` (15 questions, 4 unanswerable, 2 with a bank filter)
- [x] T-001 Project scaffold: Next.js 16, Tailwind v4, shadcn/ui, dependencies, scripts, `src/lib/env.ts`, `.env.example`, git (data inputs moved to T-000)
