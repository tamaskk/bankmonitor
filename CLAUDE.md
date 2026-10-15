@AGENTS.md

<!--
Maintainer notes (block comments are stripped from Claude's context):
- AGENTS.md is the tool-agnostic rulebook. Only Claude Code-specific guidance lives here.
- Keep this file under 120 lines. Procedures go to .claude/skills, file-type rules to .claude/rules with `paths`.
-->

# Claude Code guide: KB Assistant

## Snapshot

- KB Assistant: source-cited RAG answers for Bankmonitor loan experts, in Hungarian. Stage: one-day interview demo.
- Stack: Next.js 16 App Router · TypeScript strict · Tailwind v4 + shadcn/ui · Supabase Postgres (pgvector, hungarian FTS) · Drizzle · Vercel AI SDK v7 + OpenAI · Vercel (fra1).
- The truth lives in docs/: PRD (what and why), DESIGN_SYSTEM (how it looks), ARCHITECTURE (where code goes), TASKS (what is next), planning/ (Hungarian specs per task). Read them as AGENTS.md §02 says; do not restate them here.

## Commands

`npm run dev` · `npm run lint` · `npm run typecheck` · `npm run test` · `npm run build` · `npm run format`

## Harness map: use these instead of improvising

| When                                                            | Use                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| Building a task from docs/TASKS.md                              | `/new-feature <T-### or F#>`                                  |
| After a feature, before a PR                                    | `/review-changes` (project rules + subagents)                 |
| Hunting correctness bugs in a diff                              | bundled `/code-review`; security pass: `/security-review`     |
| Fixing a bug or an issue                                        | `/fix-issue <number or description>`                          |
| Deploying                                                       | `/deploy <preview or production>`, only when I ask            |
| Independent review                                              | subagents `code-reviewer`, `security-auditor`                 |
| Broad code search                                               | built-in `Explore` subagent (keeps your context clean)        |
| UI work                                                         | the `ui-component` skill loads for UI files                   |
| Current library APIs (AI SDK v7, Next.js 16, Drizzle, Supabase) | context7 MCP; for Next.js also `node_modules/next/dist/docs/` |
| Proving a change works in the running app                       | bundled `/verify` (after `/run-skill-generator` ran once)     |

## Working agreements (Claude Code)

- Plan first (plan mode or a written plan) when a task touches more than 5 files or anything in docs/ARCHITECTURE.md §08.
- Track multi-step work in the task list, one item in progress at a time.
- Verify before saying done: `npm run typecheck` and the relevant tests. Say what you ran.
- Never run `npm run db:migrate`, `npm run ingest`, `npm run eval` or SQL against Supabase without asking: there is one shared database, and eval costs OpenAI calls.
- Hooks in .claude/hooks enforce safety. If one blocks you, do not work around it: say what you wanted to run and why.
- Only change .claude/**, .mcp.json or CLAUDE.md when the task is about the harness itself.
- A convention I correct twice belongs in AGENTS.md or .claude/rules, not only in auto memory: propose the edit.

## Gotchas

- `npm run typecheck` runs `next typegen` first; plain `tsc` fails on the global `LayoutProps` / `PageProps` types in a clean checkout.
- `cacheComponents` is on (Next.js 16.4 default): no `export const dynamic`; use `await connection()` for request-time data.
- `next dev` re-adds the Next.js block at the end of AGENTS.md. Keep it; do not delete it.
- Scripts under `scripts/` must load `.env.local` themselves (`dotenv`); `tsx` does not.
- The Supabase transaction pooler (port 6543) needs `prepare: false`; migrations use the session pooler URL (`DATABASE_URL_SESSION`).
- The validate-bash hook blocks reading or sourcing `.env*`, so the plan's `set -a; source .env.local` test commands are mine to run. In scripts use `node --env-file=.env.local …` or dotenv. The hook also matches such text inside a Bash command (e.g. writing it with `printf`); edit files with Edit/Write instead.
