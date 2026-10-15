# Security: KB Assistant

Read before changing auth, data handling, secrets, prompts or anything that reaches OpenAI or the database. Where this file is stricter than AGENTS.md §05, this file wins.

## 01 What we protect

| Data                         | Examples                                                   | Sensitivity                                         | Where stored                      | Retention                                                            |
| ---------------------------- | ---------------------------------------------------------- | --------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| API and database credentials | `OPENAI_API_KEY`, `MONGODB_URI`, `DEMO_PASSWORD`           | Secret: a leak costs money and exposes the database | `.env.local`, Vercel env          | Until rotated                                                        |
| Knowledge base               | `data/docs/*.md` (public Bankmonitor articles, summarised) | Public, but must be accurate                        | Git, Atlas `documents` / `chunks` | Until removed from `data/docs`                                       |
| User questions               | Free text typed by the expert                              | May accidentally contain client data                | Sent to OpenAI; not stored by us  | Not persisted (no logs of question text beyond Vercel function logs) |

Customer data (names, tax ids, account numbers) must never be needed. The UI disclaimer and the README say so; PII detection is out of scope for the demo.

## 02 Trust boundaries

- Browser → server: untrusted. Basic Auth first, then Zod validation in the route handler (question ≤ 1000 chars, history ≤ 6 turns of ≤ 2000 chars, product from the enum, bank ≤ 100 chars).
- Model output: untrusted. Parse with the Zod schema, then `validateAnswer` before anything is shown as final. Unknown source ids, invented quotes and unmatched markers fail validation.
- Knowledge documents inside the prompt: data, not instructions. They are wrapped in `<forrás>` tags; the system prompt says to answer only from them and never to follow instructions in them.
- Front matter: validated by Zod at ingest; `source_url` must start with `https://bankmonitor.hu/`.

## 03 Authentication and authorization

- Basic Auth in `src/proxy.ts` on every route except Next.js static assets. Credentials from `DEMO_USER` / `DEMO_PASSWORD`; if either is missing the proxy returns 500 (fail closed).
- Compare SHA-256 digests of both sides with `crypto.timingSafeEqual` (equal lengths, so neither content nor length leaks), user and password always both. Decode the header as UTF-8 (`Buffer`, not `atob`). Split on the first `:` only.
- 401 responses carry `WWW-Authenticate: Basic realm="kb-assistant", charset="UTF-8"`.
- No roles. Everyone with the password has the same access.

## 04 Secrets

- Stored in Vercel env (Production, Preview) and `.env.local` (development). Never in git, never in `NEXT_PUBLIC_*`, never in logs, never in the README.
- The repository is public: before every push, `git ls-files | grep -i '\.env'` lists only `.env.example`, and `git grep -n 'sk-'` is empty.
- The demo password goes to the interviewer in a separate message.
- Set a monthly spending limit on the OpenAI project.
- Rotation: the repo owner (@tamas) rotates in the OpenAI dashboard / Atlas (Database Access), then updates Vercel env and `.env.local`.

## 05 Input, output, injection

- MongoDB: filters and pipelines are built only from Zod-validated values (enum products, bank string ≤ 100 chars); never pass request objects into a query and reject `$`-prefixed input (operator injection). The `$search` text query is built from regex-extracted word tokens (`/[\p{L}\p{N}]+/gu`).
- No `dangerouslySetInnerHTML`. Answer text is rendered as React text; markers are parsed with a regex into elements.
- External links (`sourceUrl`) open with `target="_blank" rel="noopener noreferrer"`; only `https://bankmonitor.hu/` URLs pass ingest validation.
- Cost abuse: Basic Auth, request size limits, `maxDuration = 60`, abort the pipeline when the client disconnects. No rate limiter in the demo (assumed — confirm).
- Never log full prompts with secrets; `console.warn` validation errors only (no API keys, no full chunk dumps).

## 06 Dependencies

- New dependency → ask first (AGENTS.md §03).
- `npm audit --omit=dev` before the deploy; report, do not `--force` fix.

## 07 Incident basics

- Contact: the repo owner (@tamas).
- A leaked secret: rotate first (OpenAI key, Atlas database user password, demo password), update Vercel and `.env.local`, then remove it from git history. A public repo means assume it was already harvested.
