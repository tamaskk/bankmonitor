---
name: ui-component
description: Build or change a React UI component the project's way - design tokens from docs/DESIGN_SYSTEM.md, reuse of the ui primitives, all states, mobile first, accessible. Use when creating or modifying components or pages.
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
---

# UI component workflow

1. Read docs/DESIGN_SYSTEM.md if you have not in this session. List the primitives in `src/components/ui`.
2. Reuse, then compose, then create. A new primitive only if nothing fits: ask first, and add it to DESIGN_SYSTEM.md §06 in the same change.
3. Tokens only (no raw hex, no off-scale spacing). Typography roles from §03.
4. States: default, hover, focus-visible, active, disabled, loading. Data views: loading, empty, error.
5. Mobile first: 375px, touch targets at least 44px.
6. Accessibility: semantic elements, labels, `aria-label` for icon-only buttons, visible focus ring, AA contrast.
7. Server component unless it needs state, effects or browser APIs; `"use client"` at the leaf.
8. Verify: typecheck; if `/verify` is available, check 375px and 1280px. Answer states to check: streaming, answered, partial, not_found (each reason), error.
