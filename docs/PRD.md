# PRD: KB Assistant

Status: Approved for the interview demo · Last updated: 2026-10-15

Background and the full production plan: [docs/planning/solution-design.hu.md](planning/solution-design.hu.md) (Hungarian). Task-level plan for the demo: [docs/planning/demo-gap-analysis.hu.md](planning/demo-gap-analysis.hu.md).

## 01 Product overview

| Field        | Value                                                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product name | KB Assistant (UI title: "Tudásbázis asszisztens")                                                                                                                                                                                                                              |
| Tagline      | Source-cited knowledge base answers for Bankmonitor loan experts                                                                                                                                                                                                               |
| Description  | An internal RAG assistant: a loan expert asks a question in Hungarian, the system retrieves the relevant knowledge base passages and answers only from them, with a verbatim quote and a link for every claim. When no reliable source exists, it says so instead of guessing. |
| Stage        | MVP: a one-day interview demo, publicly deployed behind a login page                                                                                                                                                                                                           |
| Platform     | Web app                                                                                                                                                                                                                                                                        |

## 02 Problem

Bankmonitor's loan experts help clients choose from more than 100 loan products of 13 banks. The rules, processes and product conditions live in many documents, so an expert who needs one fact (the maximum term of a personal loan, what counts as proof of income) searches by hand or asks a colleague. A wrong answer passed on to a client is a compliance and trust problem, not just an inconvenience.

Today, a loan expert has to search several documents by hand because the knowledge is scattered and differs per product and bank. This costs them minutes per question, and a rushed answer risks giving the client wrong information.

## 03 Goal

Help loan experts get a correct, source-backed answer to a product question in seconds, without ever receiving an answer that the knowledge base does not support.

## 04 Target users

Primary user:

- Who: a Bankmonitor loan expert (hitelszakértő) advising clients on mortgages, personal loans and bank accounts.
- Trigger: a client asks a product or process question the expert cannot answer from memory.
- Today they use: manual search in documents and the Bankmonitor website, or asking colleagues.
- They will switch because: every answer shows the exact quoted source, and the assistant refuses rather than guesses.

Secondary users (demo audience):

- Interviewers: need to see that accuracy is designed in and measured (citations, refusal, eval numbers).

Not for:

- Clients of Bankmonitor. The assistant is internal and never gives advice to consumers.
- Product recommendation. The model never recommends a bank or product; the decision is the expert's.

## 05 Core features

| #   | Feature                     | What the user can do                                                                            | Done when                                                                                                                                                                                                        |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Knowledge ingestion         | Run `npm run ingest` to load `data/docs/*.md` into the database                                 | All documents and chunks are stored with embeddings; a second run without changes reports 0 new / 0 updated / 0 deleted and calls no embedding API; invalid front matter stops the run naming the file and field |
| F2  | Ask and stream              | Type a question in Hungarian and get a streamed answer                                          | The answer appears progressively, shows "Ellenőrzés folyamatban…" while streaming, and ends with a validated final state                                                                                         |
| F3  | Product and bank filter     | Choose a product (Összes / Lakáshitel / Személyi kölcsön / Bankszámla) and a bank before asking | Retrieved sources only belong to the chosen product plus `altalanos`, and to the chosen bank plus bank-independent documents; the bank list comes from the data                                                  |
| F4  | Source citations            | Click an `[n]` marker to jump to its source card                                                | Every marker scrolls to a card showing title, section path, updated date, product and bank tags, a Bankmonitor link and the highlighted quote                                                                    |
| F5  | Refusal instead of guessing | Ask something the knowledge base does not cover                                                 | The user sees the not-found message with its reason; no generation runs when nothing passes the relevance threshold; text that fails citation validation twice is replaced by the not-found message              |
| F6  | Follow-up questions         | Ask a follow-up such as "És mekkora a minimális hitelösszeg?"                                   | The rewritten standalone question appears as "Keresett kérdés: …" and the answer refers to the right product                                                                                                     |
| F7  | Accuracy evaluation         | Run `npm run eval`                                                                              | All 15 golden set questions run; the four metrics print next to their targets; `eval/results.json` is written                                                                                                    |

Key user flow:

1. The expert opens the demo URL and signs in on the login page.
2. They pick a product filter (optionally a bank) and ask a question in Hungarian.
3. They read the streamed answer, check the highlighted quote on the source card, and open the Bankmonitor article if needed.

## 06 Success metrics

Measured by `npm run eval` on `data/golden-set.json` (15 questions, 4 unanswerable).

| Metric                                                 | Target                                | Measured by       |
| ------------------------------------------------------ | ------------------------------------- | ----------------- |
| Citation accuracy (cited source is an expected source) | ≥ 98%                                 | `scripts/eval.ts` |
| Correct refusal on unanswerable questions              | 4 / 4 (100%)                          | `scripts/eval.ts` |
| Answer rate on answerable questions                    | ≥ 80% (assumed — confirm)             | `scripts/eval.ts` |
| Retrieval recall@5                                     | ≥ 90% (assumed — confirm)             | `scripts/eval.ts` |
| Time to final answer on the live URL                   | ≤ 25 s per question, warm-up excluded | rehearsal (T-023) |

## 07 Out of scope

Do not build these in the demo, even if they look easy. They are covered verbally and in the README.

- Number validation in the validator, document versioning and validity dates.
- Feedback buttons, admin UI, document upload, SSO and roles.
- Server-side conversation storage (`conversations` / `messages` tables). History lives in the client.
- Langfuse tracing, LLM-as-judge metrics, PII detection.
- Live interest rates via tool calling from the Bankmonitor product database.
- Docker Compose, a separate NestJS backend, a background job queue.
- Playwright end-to-end tests, dark mode, a custom visual design beyond the shadcn base style.
- Embedding into Teams or other tools.

## 08 Open questions

- Final `RERANK_THRESHOLD` value (starts at 6, tuned by T-020).
- The installed `ai` package is v7; the plan was written against AI SDK 6 (`Output.object`, `partialOutputStream`). Verify the current API before T-011 and T-013.
- Answer rate and recall@5 targets (marked assumed in §06).
- Primary brand color and font (DESIGN_SYSTEM.md §01–§03 are assumed).
- `cacheComponents` is on (Next.js 16.4 default): confirm `await connection()` keeps `/api/banks` fresh after an ingest (T-015).

## 09 Glossary

| Term           | Meaning                                                                                                                                    | Not to be confused with       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Document       | One markdown file in `data/docs/`, identified by its slug (file name without `.md`)                                                        | A chunk                       |
| Chunk          | A section-based piece of a document (≤ 2400 characters) with its own embedding                                                             | A citation                    |
| Context header | `<title> \| Termék: … \| Bank: … \| <section path>`, stored separately from chunk content and used for embedding and full-text search only | The chunk content             |
| Product code   | `lakashitel`, `szemelyi_kolcson`, `bankszamla`, `altalanos` (general, applies to every product)                                            | The UI labels (Lakáshitel, …) |
| Candidate      | A chunk returned by hybrid search, before reranking                                                                                        | A source                      |
| Source         | A reranked candidate that passed the threshold, numbered 1..n for the model and the UI                                                     | A document                    |
| Citation       | `{ sourceId, quote }` in the model output; the quote must appear verbatim in the source                                                    | A marker                      |
| Marker         | `[n]` in the answer text, pointing to source n                                                                                             | A citation                    |
| not_found      | Final status when no source is relevant, the model finds no answer, or validation fails twice                                              | An error                      |
| Golden set     | `data/golden-set.json`: 15 questions with expected sources, 4 of them unanswerable                                                         | Unit tests                    |
