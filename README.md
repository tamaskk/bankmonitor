# KB Assistant

An internal RAG assistant demo for Bankmonitor loan experts: ask a question in Hungarian, get an answer built only from the knowledge base, with a verified quote for every claim. When no reliable source exists, it says so instead of guessing.

> Status: work in progress. The scaffold and the agent harness are in place; the pipeline is being built task by task (see [docs/TASKS.md](docs/TASKS.md)). Architecture diagram, accuracy layers and eval results will be added in T-022.

## Source of truth

| What                                                     | Where                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| What we build and why, scope, metrics                    | [docs/PRD.md](docs/PRD.md)                                           |
| How it looks                                             | [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)                       |
| Where code lives, boundaries, intentional decisions      | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                         |
| Security rules                                           | [docs/SECURITY.md](docs/SECURITY.md)                                 |
| Task list                                                | [docs/TASKS.md](docs/TASKS.md)                                       |
| Original solution design and task-level plan (Hungarian) | [docs/planning/](docs/planning/)                                     |
| Rules for AI coding agents                               | [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [.claude/](.claude/) |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 + shadcn/ui · MongoDB Atlas (Vector Search + Atlas Search with the Hungarian analyzer) · Vercel AI SDK + OpenAI · Vitest · Vercel.

## Run locally

Requires Node.js 24 (`nvm use`).

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

## Scripts

| Script                                    | What it does                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                             | Development server                                                          |
| `npm run build` / `npm run start`         | Production build / server                                                   |
| `npm run lint`                            | ESLint                                                                      |
| `npm run typecheck`                       | `next typegen` + `tsc --noEmit`                                             |
| `npm run test` / `npm run test:watch`     | Vitest unit tests                                                           |
| `npm run format` / `npm run format:check` | Prettier                                                                    |
| `npm run db:check`                        | Ping the Atlas cluster and print the server version                         |
| `npm run db:indexes`                      | Create collections, indexes and Atlas search indexes (planned, T-003)       |
| `npm run ingest`                          | Load `data/docs` into Atlas (idempotent; `-- --force` re-embeds everything) |
| `npm run eval`                            | Run the golden set, print the metrics and write `eval/results.json`         |

## Knowledge base

Summaries of public Bankmonitor articles, written in our own words; every document's front matter links to its source article. This is a demo dataset, not Bankmonitor's internal knowledge.
