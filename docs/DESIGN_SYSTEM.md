# Design System: KB Assistant

The demo uses the shadcn/ui base style (`base-nova`, Base UI primitives) with a small set of project tokens. The token names below are the CSS variables in `src/app/globals.css`; components use them only through Tailwind utilities (`bg-primary`, `text-muted-foreground`). When the product should look different, change this file and `globals.css` together.

## 01 Brand identity

- Personality: calm, precise, trustworthy (assumed — confirm).
- Tone in UI copy: Hungarian, plain, short sentences, informal "te" form, no exclamation marks. State facts; never sound like marketing.
- Feel: a quiet work tool. The answer and its sources are the content; chrome stays out of the way.
- UI language and locale: Hungarian only (`hu-HU`). Dates as `YYYY-MM-DD` on source cards (matches the front matter); product names in Hungarian (Lakáshitel, Személyi kölcsön, Bankszámla, Általános).
- Fixed copy: header "Tudásbázis asszisztens" / "Bankmonitor demó"; disclaimer under the input "AI által generált válasz. Ügyfél-tájékoztatás előtt ellenőrizd a forrást."; not-found text is `NOT_FOUND_MESSAGE` in `src/lib/generation/schema.ts`.
- Reference: https://bankmonitor.hu (we do not copy its branding).

## 02 Color palette

Use tokens in components. Never raw hex or oklch values, never Tailwind palette colors such as `bg-green-600`.

| Token                  | Value                                                         | Use                                                         |
| ---------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| --background           | oklch(1 0 0)                                                  | Page background                                             |
| --foreground           | oklch(0.145 0 0)                                              | Body text                                                   |
| --card                 | oklch(1 0 0)                                                  | Cards (source cards, answer panel)                          |
| --muted                | oklch(0.97 0 0)                                               | Subtle surfaces: user message bubble, quote block           |
| --muted-foreground     | oklch(0.556 0 0)                                              | Secondary text: section path, dates, "Keresett kérdés" line |
| --border / --input     | oklch(0.922 0 0)                                              | Dividers, card and input borders                            |
| --ring                 | oklch(0.708 0 0)                                              | Focus ring                                                  |
| --primary              | oklch(0.546 0.245 262.881) (blue, #2563EB, assumed — confirm) | Send button, links, `[n]` markers, active states            |
| --primary-foreground   | oklch(0.985 0 0)                                              | Text on primary                                             |
| --secondary / --accent | oklch(0.97 0 0)                                               | Secondary buttons, hover backgrounds                        |
| --success              | oklch(0.527 0.154 150.069)                                    | "Forrással ellenőrizve" badge                               |
| --warning              | oklch(0.555 0.163 48.998)                                     | "Részleges válasz" badge                                    |
| --destructive          | oklch(0.577 0.245 27.325)                                     | Errors, not-found frame                                     |

Rules:

- One primary color. Success, warning and destructive are for status only.
- Status badges use the tinted pattern: `bg-<token>/10 text-<token>`.
- Text on any background passes WCAG AA (4.5:1 for body text); success and warning are the darker 700-level shades for this reason.
- Dark mode: not supported in v1. The `.dark` block in `globals.css` is the shadcn default and stays unused; never hard-code a color to fake it.
- The `chart-*` and `sidebar-*` tokens come from shadcn and are unused.

## 03 Typography

Font: Geist (`next/font/google`, variable `--font-sans`); Geist Mono for code. Use Tailwind type utilities, not pixel values.

| Role  | Utility             | Weight          | Use                                                         |
| ----- | ------------------- | --------------- | ----------------------------------------------------------- |
| H1    | `text-xl`           | `font-semibold` | Page title "Tudásbázis asszisztens"                         |
| H2    | `text-base`         | `font-semibold` | Source card title                                           |
| Body  | `text-sm` (14px)    | `font-normal`   | Answers, messages, card text, `leading-relaxed` for answers |
| Small | `text-xs`           | `font-normal`   | Section path, dates, disclaimer, badges                     |
| Code  | `font-mono text-xs` | `font-normal`   | Debug output only                                           |

Rules:

- Answer text line length stays under ~75 characters (`max-w-prose` or the chat column width).
- Never more than the two Geist families.

## 04 Spacing

Tailwind's 4px scale only. No arbitrary values like `p-[13px]`.

| Token | Value | Typical use                                   |
| ----- | ----- | --------------------------------------------- |
| 1     | 4px   | Icon gaps                                     |
| 2     | 8px   | Inside badges and small controls              |
| 3     | 12px  | Input padding, gap between markers and text   |
| 4     | 16px  | Default gap, card padding on mobile           |
| 6     | 24px  | Card padding on desktop, gap between messages |
| 8     | 32px  | Between page sections                         |

Layout:

- Single chat column, `max-w-3xl`, centered, `px-4` on mobile.
- Filter bar on top, message list in the middle, input pinned to the bottom.

## 05 Border radius and shadows

`--radius` is 0.625rem (10px); Tailwind maps it to `rounded-sm` … `rounded-4xl`.

| Utility        | Use                      |
| -------------- | ------------------------ |
| `rounded-md`   | Inputs, selects, badges  |
| `rounded-lg`   | Buttons, message bubbles |
| `rounded-xl`   | Cards                    |
| `rounded-full` | Status dots              |

Shadows: none on flat cards (border only). Popovers and select menus use the shadcn default shadow.

## 06 Components

Reuse before creating. Primitives live in `src/components/ui/` (shadcn, do not edit their structure; restyle only through tokens). If a variant is not listed here, ask before adding it.

| Primitive  | Source                                        | Variants used                                                                                           |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Button     | shadcn                                        | `default` (primary, one per screen: send), `outline` ("Új beszélgetés"), `ghost` (icon actions), `link` |
| Badge      | shadcn                                        | status badges (§02 tinted pattern), `[n]` markers, product and bank tags                                |
| Card       | shadcn                                        | Source cards, answer container                                                                          |
| Select     | shadcn                                        | Product and bank filters                                                                                |
| Textarea   | shadcn                                        | Question input: Enter sends, Shift+Enter new line, disabled while loading                               |
| ScrollArea | shadcn                                        | Chunk text on a source card, max height 16rem                                                           |
| EmptyState | project (`src/components/ui/empty-state.tsx`) | Empty chat: one line + example questions                                                                |

Feature components live in `src/components/chat/`: `filter-bar.tsx`, `chat-input.tsx`, `answer-view.tsx`, `source-card.tsx`.

States:

- Answer phases: streaming → muted badge "Ellenőrzés folyamatban…"; answered → success badge "Forrással ellenőrizve"; partial → warning badge "Részleges válasz"; not_found → destructive-framed `NOT_FOUND_MESSAGE` plus the reason line; error → destructive text, input usable again.
- Quote highlight: `<mark>` with `bg-primary/15` and no text color change.
- Marker click: scroll to `source-<messageId>-<n>` and highlight the card with a primary ring for 1.5 s.
- Links to Bankmonitor open in a new tab with `rel="noopener noreferrer"`.

## 07 Icons

- Set: Lucide (`lucide-react`). One set only.
- Sizes: 16px inline (shadcn default inside buttons), 20px standalone.
- An icon is never the only label on an action. Add text or an `aria-label`.

## 08 Responsive breakpoints

Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.

Rules:

- Mobile first. Everything works at 375px wide.
- Filters stack vertically below `sm`.
- Touch targets at least 44px on touch layouts (`h-11` for the send button below `sm`).
- No horizontal scrolling except inside code blocks and tables on source cards.

## 09 Motion

- 150ms for hover and focus, 250ms for the card highlight fade.
- Smooth scroll to source cards; respect `prefers-reduced-motion` (`motion-safe:` utilities).
- No decorative animation.

## 10 Implementation

- Tokens live in `src/app/globals.css` as CSS variables with the names above, exposed to Tailwind through `@theme inline`. This file and `globals.css` change in the same commit.
- Primitives live in `src/components/ui/` (shadcn/ui `base-nova`, restyled only through tokens). Add new shadcn components with `npx shadcn@latest add <name>` after approval.
- Anything not defined here: ask before inventing it.
