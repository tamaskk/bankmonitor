# Deploy configuration

Read by the deploy skill. Values only, never secrets. Any value still in [brackets]: the skill stops and asks.

| Key                       | Value                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform                  | Vercel                                                                                                                                                                                                     |
| Vercel project            | kb-assistant                                                                                                                                                                                               |
| Deploy method             | Git integration: pull request → preview, merge to main → production                                                                                                                                        |
| Production branch         | main                                                                                                                                                                                                       |
| Production URL            | [set after the first deploy (T-021); stored locally as DEMO_URL in .env.local]                                                                                                                             |
| Preview URLs              | created per pull request by Vercel                                                                                                                                                                         |
| Function region           | fra1 (`vercel.json`), next to the Supabase project                                                                                                                                                         |
| Smoke checks              | `curl -sSf -u "$DEMO_USER:$DEMO_PASSWORD" <url>/api/health` (the user runs it: the hook blocks sourcing `.env.local`), then one question from docs/planning/demo-gap-analysis.hu.md task 23 in the browser |
| Required env vars (names) | OPENAI_API_KEY, DATABASE_URL, GENERATION_MODEL, HELPER_MODEL, EMBEDDING_MODEL, RERANK_THRESHOLD, DEMO_USER, DEMO_PASSWORD; set in Vercel, never here                                                       |
| Pre-deploy checks         | `git ls-files \| grep -i '\.env'` lists only `.env.example`; `git grep -n 'sk-'` is empty; the Supabase project is not paused                                                                              |
| Rollback                  | Vercel dashboard → Deployments → previous deployment → Promote (or `vercel rollback`, with my approval)                                                                                                    |
| Who deploys production    | only the user; Claude prepares and verifies                                                                                                                                                                |
