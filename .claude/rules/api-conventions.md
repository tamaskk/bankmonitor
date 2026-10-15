---
paths:
  - "src/app/api/**"
  - "src/proxy.ts"
  - "src/lib/pipeline.ts"
  - "src/lib/embeddings.ts"
  - "src/lib/retrieval/**"
  - "src/lib/generation/**"
---

# API, pipeline and LLM calls

- Route handlers are thin: validate the body with a Zod schema, call `answerQuestion` (or one query for banks), map the result to a response. Basic Auth is already done by `src/proxy.ts`.
- `export const runtime = 'nodejs'` where the database is used; `/api/chat` sets `maxDuration = 60`. No `export const dynamic` (Cache Components): use `await connection()`.
- Errors: 400 with `{ error: string }` for invalid input. Pipeline failures become one `error` event with a generic Hungarian message; never return stack traces or OpenAI error text.
- `/api/chat` streams NDJSON (`application/x-ndjson; charset=utf-8`, `Cache-Control: no-cache, no-transform`), one `PipelineEvent` per line, and stops the generator when `request.signal` aborts.
- Every run ends with exactly one `final` or `error` event. Below-threshold retrieval returns `not_found` without calling the generation model.
- LLM calls go through the AI SDK with models from `env` (`GENERATION_MODEL`, `HELPER_MODEL`, `EMBEDDING_MODEL`) and `providerOptions.openai.reasoningEffort: 'low'`. No `temperature`. No `streamObject` / `generateObject`.
- Structured output schemas use no Zod `min` / `max` (OpenAI strict mode); check ranges in code after parsing.
- Model output is untrusted: `safeParse`, then `validateAnswer`; one regeneration with the error list, then `not_found` with `validation_failed`.
- Prompts mark knowledge text as data (`<forrás>` tags), forbid general knowledge and bank or product recommendations, and require verbatim quotes. Prompt changes need an eval run before merge.
- Log with `console.warn` / `console.error` only what helps debugging: step, slugs, scores, validation errors. Never keys or full prompts.
