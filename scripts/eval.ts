// T-020: runs every golden set question through answerQuestion (the same
// pipeline as /api/chat), prints per-item results and the four metrics next
// to their targets, and writes eval/results.json. Sequential on purpose (rate
// limits). Read-only against Atlas; costs model calls. Run: npm run eval
import "./load-env";

import { mkdir, readFile, writeFile } from "node:fs/promises";

import { z } from "zod";

import { getClient } from "@/db/client";
import { env } from "@/lib/env";
import { answerQuestion, type FinalResult } from "@/lib/pipeline";

const GOLDEN_SET_PATH = "data/golden-set.json";
const RESULTS_PATH = "eval/results.json";

const goldenSetSchema = z.array(
  z.object({
    id: z.string(),
    question: z.string(),
    product: z
      .enum(["osszes", "lakashitel", "szemelyi_kolcson", "bankszamla"])
      .optional(),
    bank: z.string().nullable().optional(),
    expected_sources: z.array(z.string()),
    answerable: z.boolean(),
  }),
);

const TARGETS = { citationAccuracy: 0.98, correctRefusal: 0.9 } as const;

type ItemResult = {
  id: string;
  question: string;
  answerable: boolean;
  status: FinalResult["status"] | "error";
  reason: string;
  ok: boolean;
  recallHit: boolean | null;
  citations: number;
  correctCitations: number;
  retrieved: string[];
  seconds: number;
  answer: string;
};

const ratio = (part: number, whole: number) =>
  whole === 0 ? null : part / whole;
const percent = (value: number | null) =>
  value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;

async function main() {
  const items = goldenSetSchema.parse(
    JSON.parse(await readFile(GOLDEN_SET_PATH, "utf8")),
  );
  const results: ItemResult[] = [];

  for (const item of items) {
    const started = Date.now();
    let final: FinalResult | null = null;
    let errorMessage = "";
    for await (const event of answerQuestion({
      question: item.question,
      filters: { product: item.product ?? "osszes", bank: item.bank ?? null },
      history: [],
    })) {
      if (event.type === "final") final = event.result;
      if (event.type === "error") errorMessage = event.message;
    }
    const seconds = Number(((Date.now() - started) / 1000).toFixed(1));

    const expected = new Set(item.expected_sources);
    const retrieved = final?.retrieved.map((r) => r.slug) ?? [];
    const answered =
      final?.status === "answered" || final?.status === "partial";
    const citations = answered ? final!.citations : [];
    const result: ItemResult = {
      id: item.id,
      question: item.question,
      answerable: item.answerable,
      status: final?.status ?? "error",
      reason: final?.reason ?? (errorMessage ? "error" : ""),
      ok: item.answerable ? answered : final?.status === "not_found",
      recallHit: item.answerable
        ? retrieved.some((slug) => expected.has(slug))
        : null,
      citations: citations.length,
      correctCitations: citations.filter((c) => expected.has(c.source.slug))
        .length,
      retrieved,
      seconds,
      answer: final?.answer ?? errorMessage,
    };
    results.push(result);
    console.log(
      `${result.id} ${result.ok ? "ok  " : "MISS"} ${result.status}${result.reason ? ` (${result.reason})` : ""} ${seconds}s`,
    );
  }

  const answerable = results.filter((r) => r.answerable);
  const unanswerable = results.filter((r) => !r.answerable);
  const answeredItems = results.filter(
    (r) => r.status === "answered" || r.status === "partial",
  );
  const totalCitations = answeredItems.reduce((sum, r) => sum + r.citations, 0);
  const metrics = {
    recallAt5: ratio(
      answerable.filter((r) => r.recallHit).length,
      answerable.length,
    ),
    citationAccuracy: ratio(
      answeredItems.reduce((sum, r) => sum + r.correctCitations, 0),
      totalCitations,
    ),
    correctRefusal: ratio(
      unanswerable.filter((r) => r.status === "not_found").length,
      unanswerable.length,
    ),
    answerRate: ratio(answerable.filter((r) => r.ok).length, answerable.length),
  };

  console.table(
    results.map(
      ({
        id,
        status,
        reason,
        ok,
        recallHit,
        citations,
        correctCitations,
        seconds,
      }) => ({
        id,
        status,
        reason,
        ok,
        recall: recallHit === null ? "-" : recallHit,
        citations: `${correctCitations}/${citations}`,
        seconds,
      }),
    ),
  );
  console.table([
    {
      metric: "recall@5 (answerable)",
      value: percent(metrics.recallAt5),
      target: "-",
    },
    {
      metric: "citation accuracy",
      value: percent(metrics.citationAccuracy),
      target: `≥ ${percent(TARGETS.citationAccuracy)}`,
    },
    {
      metric: "correct refusal (unanswerable)",
      value: percent(metrics.correctRefusal),
      target: `≥ ${percent(TARGETS.correctRefusal)}`,
    },
    {
      metric: "answer rate (answerable)",
      value: percent(metrics.answerRate),
      target: "-",
    },
  ]);

  await mkdir("eval", { recursive: true });
  await writeFile(
    RESULTS_PATH,
    `${JSON.stringify(
      {
        runAt: new Date().toISOString(),
        models: {
          generation: env.GENERATION_MODEL,
          helper: env.HELPER_MODEL,
          embedding: env.EMBEDDING_MODEL,
        },
        rerankThreshold: env.RERANK_THRESHOLD,
        items: results.length,
        metrics,
        targets: TARGETS,
        results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nwrote ${RESULTS_PATH}`);
}

main()
  .catch((error: unknown) => {
    console.error(
      "eval failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await getClient().catch(() => undefined))?.close();
  });
