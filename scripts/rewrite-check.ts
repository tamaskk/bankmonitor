// T-010: rewrites a dependent and an independent follow-up and checks the
// result. Costs two helper-model calls; no database access.
// Run: npm run rewrite:check
import "./load-env";

import { rewriteQuery } from "@/lib/retrieval/rewrite";
import type { ChatTurn } from "@/lib/retrieval/types";

const history: ChatTurn[] = [
  { role: "user", content: "Mennyi a személyi kölcsön maximális futamideje?" },
  {
    role: "assistant",
    content: "A személyi kölcsön futamideje legfeljebb 10 év (120 hónap). [1]",
  },
];

async function main() {
  const problems: string[] = [];

  const first = "Mennyi a személyi kölcsön maximális futamideje?";
  if ((await rewriteQuery(first, [])) !== first)
    problems.push("empty history must return the question unchanged");

  const dependent = "És a minimális összeg?";
  const rewritten = await rewriteQuery(dependent, history);
  console.log(`dependent:   "${dependent}" → "${rewritten}"`);
  if (!/személyi\s+kölcsön/i.test(rewritten))
    problems.push(`dependent rewrite lacks "személyi kölcsön": ${rewritten}`);

  const independent = "Mit jelent a THM?";
  const unchanged = await rewriteQuery(independent, history);
  console.log(`independent: "${independent}" → "${unchanged}"`);
  if (!/THM/.test(unchanged) || /személyi/i.test(unchanged)) {
    problems.push(`independent question changed in meaning: ${unchanged}`);
  }

  console.log(
    problems.length === 0
      ? "\nAll checks passed."
      : `\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`,
  );
  if (problems.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(
    "rewrite-check failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
