# AGENTS.md

Instructions for any AI coding agent working in this project
(Claude Code, Cursor, Codex, Copilot). Read this whole file before doing anything.

## 01 Purpose

KB Assistant is an internal RAG assistant that answers Bankmonitor loan experts' questions in Hungarian only from the knowledge base, with a verified quote for every claim, and refuses when no reliable source exists. It is a one-day interview demo.
Accuracy is the product: every change is judged by whether it keeps wrong information from reaching the user.
Your job is to extend it without breaking what exists, in the style already established. When in doubt, match what is there.

## 02 Before you start

Do these in order, every session:

1. Read docs/PRD.md for what we are building and what is out of scope.
2. Before any UI work, read docs/DESIGN_SYSTEM.md. Use its tokens.
3. Before any structural, data, retrieval, generation or backend work, read docs/ARCHITECTURE.md for where code lives and what may touch what.
4. For the task's detailed spec and acceptance criteria, read its section in docs/planning/demo-gap-analysis.hu.md (Hungarian; task numbers match docs/TASKS.md).
5. Check the existing ui components before creating a new one.
6. Look at docs/TASKS.md before proposing new work.
7. Restate the task in one or two sentences and list the files you expect
   to touch. Wait for a go-ahead if that list is longer than five files.

## 03 General rules

- Follow the design system. If a value is not in DESIGN_SYSTEM.md, ask. Do not invent it.
- Keep responsibilities where ARCHITECTURE.md puts them. No business logic in pages or components; the pipeline lives in `src/lib/pipeline.ts`.
- Reuse before creating. Search the codebase for an existing helper or component first.
- Small, focused changes. One task, one branch, one clear diff.
- Do not add dependencies, tables, environment variables, or third-party services without asking.
- Do not delete or rewrite working code the task does not require.
- Never "improve" anything listed under intentional decisions in ARCHITECTURE.md §06.
- Leave the project runnable after every change.
- Never pass a `temperature` parameter, and never use `streamObject` / `generateObject`.
- The model must never recommend a bank or product. Prompts say so; do not weaken that rule.
- When unsure whether an answer is supported by a source, the correct behaviour is `not_found`. Never trade a refusal for a guess.
- `src/lib/ingest/chunk.ts`, `src/lib/retrieval/rrf.ts` and `src/lib/generation/validate.ts` stay pure: no `env.ts`, no database client.
- The installed `ai` package is v7, newer than most examples. Check the current API (context7 or `node_modules/ai`) before writing AI SDK code.
- User-facing text is Hungarian; code, comments, commits and docs are English.

## 04 Code guidelines

- TypeScript strict. No `any`. No `@ts-ignore` without a comment saying why.
- Functional components, hooks, named exports (except where the framework requires a default export, e.g. Next.js page and layout files).
- Validate every external input (request bodies, front matter, model output) with a Zod schema before it is used.
- Name things by what they do: `validateAnswer`, not `check2`.
- Comments explain why, not what. Delete commented-out code.
- Every data-driven view handles loading, empty, and error states.
- UI copy follows the tone rules in DESIGN_SYSTEM.md: plain, short, no exclamation marks.
- Tests cover the pure modules (chunking, RRF, citation validation). The eval script covers the pipeline end to end.
- Formatting is the formatter's job. Run it. Do not argue with it.

## 05 Security and best practices

- Secrets live in environment variables and are read on the server only, through `src/lib/env.ts`.
  Never log them, never send them to the client. The repository is public.
- Authorization is checked on every server entry point, not just in the UI (Basic Auth in `src/proxy.ts`).
- Escape and validate everything that comes from a user, a model, or a document.
- Database filters only from Zod-validated values. Never pass request objects or `$`-prefixed input into a MongoDB filter or pipeline (NoSQL injection).
- No new auth flow, data deletion behavior, or change to the relevance threshold or the citation validator without explicit approval.
- Read docs/SECURITY.md before changing auth, prompts, data handling, secrets or anything that reaches OpenAI or the database. Where it is stricter than this section, it wins.

## 06 Useful commands

```
nvm use               Node 24 (.nvmrc)
npm install           install dependencies
npm run dev           start the dev server (http://localhost:3000)
npm run build         production build (must pass before a PR)
npm run lint          lint
npm run typecheck     next typegen + tsc --noEmit
npm run test          unit tests (Vitest)
npm run format        format the codebase (Prettier)
npm run db:check        ping Atlas with the configured user (read-only)
npm run db:indexes      create collections and Atlas search indexes (ask before running)
npm run ingest        load data/docs into the database (planned; ask before running)
npm run eval          run the golden set (planned; costs OpenAI calls)
```

If a command fails, report the exact output. Do not work around it silently.

## 07 Definition of done

A task is done when all of these are true:

- The change does what the task asked, and nothing else.
- Build, lint, typecheck, and tests pass locally.
- The task's acceptance criteria in docs/planning/demo-gap-analysis.hu.md are met, or the gap is stated.
- New UI matches DESIGN_SYSTEM.md and works at 375px wide.
- Docs are updated if a structure, a decision, or a component changed; docs/TASKS.md is ticked.
- The summary says what changed, what was not done, and what the user should check.

## 08 When to stop and ask

Stop and ask instead of guessing when:

- The task conflicts with the PRD, the design system, or an architectural boundary.
- Two reasonable readings of the task lead to different work.
- The change needs a new dependency, table, secret, or service.
- A command would write to the shared Atlas cluster (db:indexes, ingest, manual writes).
- Something is broken that the task did not mention.

Ask with the specific question, the options you see, and your recommendation.

## 09 Git workflow

- Never commit to main directly. Branches: feat/<slug>, fix/<issue>-<slug>, chore/<slug>, docs/<slug>.
- Conventional Commits: `type(scope): summary` (feat, fix, refactor, test, docs, chore, perf).
- One logical change per commit. Never commit secrets, .env files or build output.
- Do not push, force-push, rebase shared branches, or merge pull requests unless the user asks.
- Pull request description: what changed, why, how it was verified, screenshots for UI.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
