---
name: new-feature
description: Implement a v1 feature from docs/PRD.md end to end - plan, thin vertical slices, tests, definition of done, task list update. Use when the user asks to build a feature listed in the PRD or in docs/TASKS.md.
argument-hint: "<feature id or name, e.g. F2>"
---

# New feature: $ARGUMENTS

1. Find the feature in PRD §05 and its tasks in docs/TASKS.md, then read each task's section in docs/planning/demo-gap-analysis.hu.md (Megoldás, Elfogadási feltételek, Függőségek és kockázatok). Restate the user action, the "done when" and the out-of-scope neighbours (§07). Not in the PRD: stop and ask whether to add it there first.
2. Read docs/ARCHITECTURE.md (where code goes, boundaries, §06), and docs/DESIGN_SYSTEM.md for UI.
3. Plan in plan mode, or present a plan: vertical slices (data/service → route or action → UI), files and tests per slice, risks. More than five files in a slice, or anything in ARCHITECTURE §08: ask. Wait for approval.
4. Branch `feat/<id>-<slug>`.
5. Per slice: tests first for pure modules (chunk, rrf, validate) (Arrange-Act-Assert), implement, run tests and typecheck.
6. Finish: every "done when" is observable; loading, empty and error states; 375px; TASKS.md boxes ticked; docs updated if structure or decisions changed.
7. Suggest `/review-changes` before the pull request.
