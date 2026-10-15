---
name: deploy
description: Deploy this app to a preview or to production with the project's release checklist. Use only when the user explicitly asks to deploy.
argument-hint: "<preview or production>"
disable-model-invocation: true
allowed-tools:
  - Bash(git status *)
  - Bash(git log *)
  - Bash(git fetch *)
  - Bash(npm run lint)
  - Bash(npm run typecheck)
  - Bash(npm run test)
  - Bash(npm run build)
---

# Deploy: $ARGUMENTS

Read `${CLAUDE_SKILL_DIR}/deploy-config.md` first: platform, method, URLs, smoke checks, rollback. If any value there is still a [placeholder], stop and ask.

## 1. Preconditions (stop on any failure)

- The target is `preview` or `production`. Anything else: ask.
- The working tree is clean (`git status --porcelain` is empty).
- `production`: on the production branch from the config, up to date with origin (`git fetch`, then compare), and the latest CI run on it is green (`gh run list --branch <branch> --limit 1`, if gh is available).
- `preview`: a feature branch.

## 2. Quality gate

Run lint, typecheck, test and build. Any failure: stop, report, do not deploy.

## 3. Deploy

- Follow the "Deploy method" in the config.
  - Git integration: preview = push the feature branch (ask first); production = merge the approved pull request. Tell me to merge it in GitHub unless I explicitly asked you to.
  - CLI: preview `vercel deploy`; production `vercel deploy --prod`. Production always needs my explicit "yes" in this conversation, even though the hook asks too.
- Never change environment variables, domains or project settings as part of a deploy.

## 4. Verify

- Wait for the deployment URL, then run the smoke checks from the config (e.g. `curl -sSf <url>/api/health`).
- Report: target, URL, commit SHA, checks and their results.

## 5. If something is wrong

Report first. Offer the rollback steps from the config; run them only after I say so.
