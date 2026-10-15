---
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
  - "src/app/globals.css"
---

# UI components

- Before creating or changing UI, read docs/DESIGN_SYSTEM.md if you have not in this session.
- Tokens only: colors, spacing, radius and typography from DESIGN_SYSTEM.md. No raw hex or oklch, no Tailwind palette colors (`bg-green-600`), no arbitrary values like `p-[13px]`.
- Reuse the `src/components/ui` primitives first. A new primitive needs approval and a DESIGN_SYSTEM.md §06 entry in the same change. Do not restructure shadcn files; restyle through tokens.
- Feature components go in `src/components/chat/`.
- Every data-driven view has loading, empty and error states. Streamed answer text is visibly marked unverified until the `final` event replaces it.
- Mobile first: works at 375px, touch targets at least 44px, no horizontal scroll.
- Accessibility: semantic HTML, visible labels, `aria-label` on icon-only buttons, visible focus ring, AA contrast, `lang="hu"` on `<html>`.
- No `dangerouslySetInnerHTML`. Render answers as text; turn `[n]` markers into elements with a regex split.
- Server components by default. `"use client"` only for state, effects or browser APIs, as deep in the tree as possible. Client code imports only types from `src/lib/`.
- UI copy is Hungarian and follows the tone rules in DESIGN_SYSTEM.md §01.
