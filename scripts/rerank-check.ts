// T-009: hybrid search + RRF + rerank for a knowledge base question and an
// out-of-scope one; prints the rerank scores and checks the acceptance
// criteria. Read-only against Atlas; costs embedding and helper-model calls.
// Run: npm run rerank:check
import "./load-env";

import { getClient } from "@/db/client";
import { embedQuery } from "@/lib/embeddings";
import { env } from "@/lib/env";
import { RERANK_TOP_K, rerank } from "@/lib/retrieval/rerank";
import { rrf } from "@/lib/retrieval/rrf";
import { hybridSearch } from "@/lib/retrieval/search";
import type { Filters } from "@/lib/retrieval/types";

const CASES: { question: string; filters: Filters; expectSources: boolean }[] =
  [
    {
      question: "Mennyi a személyi kölcsön maximális futamideje?",
      filters: { product: "szemelyi_kolcson", bank: null },
      expectSources: true,
    },
    {
      question: "Milyen kriptobefektetést ajánl a bank?",
      filters: { product: "osszes", bank: null },
      expectSources: false,
    },
  ];

async function main() {
  const problems: string[] = [];
  console.log(`RERANK_THRESHOLD=${env.RERANK_THRESHOLD}`);

  for (const { question, filters, expectSources } of CASES) {
    const embedding = await embedQuery(question);
    const { vector, fullText } = await hybridSearch(
      question,
      embedding,
      filters,
    );
    const candidates = rrf([vector, fullText]);
    const started = Date.now();
    const ranked = await rerank(question, candidates);
    const ms = Date.now() - started;

    console.log(
      `\n=== ${question} (${candidates.length} candidates, rerank ${ms} ms)`,
    );
    ranked.forEach((c, i) =>
      console.log(`  ${i + 1}. score ${c.score}  ${c.slug} › ${c.sectionPath}`),
    );
    if (ranked.length === 0)
      console.log(
        "  (no candidate reached the threshold → not_found, no generation)",
      );

    if (ranked.length > RERANK_TOP_K)
      problems.push(
        `${question}: ${ranked.length} results, max ${RERANK_TOP_K}`,
      );
    if (ranked.some((c, i) => i > 0 && ranked[i - 1].score < c.score))
      problems.push(`${question}: not sorted by score`);
    if (expectSources && ranked.length === 0)
      problems.push(`${question}: expected at least one score >= threshold`);
    if (!expectSources && ranked.length > 0)
      problems.push(`${question}: expected no candidate above the threshold`);
  }

  console.log(
    problems.length === 0
      ? "\nAll checks passed."
      : `\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`,
  );
  if (problems.length > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(
      "rerank-check failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await getClient().catch(() => undefined))?.close();
  });
