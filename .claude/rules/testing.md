---
paths:
  - "**/*.test.{ts,tsx}"
  - "tests/**"
  - "vitest.config.*"
  - "scripts/eval.ts"
  - "data/golden-set.json"
---

# Testing

- Unit tests (Vitest, `tests/*.test.ts`) cover the pure modules: `src/lib/ingest/chunk.ts`, `src/lib/retrieval/rrf.ts`, `src/lib/generation/validate.ts`. They run without `.env.local`, so tested modules never import `env.ts` or the database client.
- The pipeline is measured by `npm run eval` on `data/golden-set.json`, not by unit tests with mocked models. No Playwright in the demo.
- Structure every test as Arrange-Act-Assert, with a blank line between the three parts.
- State-based tests: real inputs (inline markdown strings, candidate arrays, model outputs), assertions on outputs. Mock only at the boundaries: the AI SDK, the database, the clock.
- Test names state the behaviour: `rejects a quote that is not in the cited source`.
- A bug fix starts with a failing test that reproduces the bug.
- No network or real OpenAI calls in unit tests. Test data lives inline in the test file.
- Deterministic tests: fixed time (`vi.setSystemTime`), no order dependence.
- Never loosen the citation validator to make a test or the eval pass; tighten the prompt instead (ARCHITECTURE.md §06).
- Golden set changes (questions, `expected_sources`, `answerable`) need approval: they move the metrics.
- Commands: `npm run test` (unit), `npm run eval` (ask first: it costs OpenAI calls). A task is not done while tests fail.
