# Code style

- TypeScript strict. No `any` (use `unknown` and narrow). No `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- File names kebab-case (`source-card.tsx`); components PascalCase; hooks `useThing` in `use-thing.ts`.
- Named exports only, except where the framework requires a default export (Next.js `page`, `layout`, `loading`, `error`, `not-found`, `template`, `default`) and config files (`vitest.config.ts`).
- Imports use the `@/` alias for `src/`. No `../../../` chains.
- One function, one job. Name it by what it does (`buildSearchFilter`, not `helper2`).
- Never swallow errors. Catch only where you can handle them or add context; log unexpected errors once.
- Modules that touch the database, OpenAI or secrets import `server-only` (scripts excepted). Client components start with `"use client"` and stay at the leaves of the tree.
- Comments explain why, not what. No commented-out code. No TODO without a task id (`T-###`).
- User-facing strings are Hungarian; identifiers, comments and log messages are English.
- Formatting belongs to Prettier (with `prettier-plugin-tailwindcss`); a hook formats every file you edit. Do not hand-format.
