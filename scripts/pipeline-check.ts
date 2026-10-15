// T-013: runs a relevant, an out-of-scope and a follow-up question through
// answerQuestion, prints the event sequence and checks the acceptance
// criteria. Read-only against Atlas; costs a few model calls.
// Run: npm run pipeline:check
import "./load-env";

import { getClient } from "@/db/client";
import {
  answerQuestion,
  type PipelineEvent,
  type PipelineInput,
} from "@/lib/pipeline";

const CASES: {
  label: string;
  input: PipelineInput;
  expect: "answer" | "no_source";
}[] = [
  {
    label: "relevant",
    input: {
      question: "Mennyi a személyi kölcsön maximális futamideje?",
      filters: { product: "szemelyi_kolcson", bank: null },
      history: [],
    },
    expect: "answer",
  },
  {
    label: "out of scope",
    input: {
      question: "Milyen kriptobefektetést ajánl a bank?",
      filters: { product: "osszes", bank: null },
      history: [],
    },
    expect: "no_source",
  },
  {
    label: "follow-up",
    input: {
      question: "És a minimális összeg?",
      filters: { product: "szemelyi_kolcson", bank: null },
      history: [
        {
          role: "user",
          content: "Mennyi a személyi kölcsön maximális futamideje?",
        },
        {
          role: "assistant",
          content:
            "A személyi kölcsön futamideje legfeljebb 10 év (120 hónap). [1]",
        },
      ],
    },
    expect: "answer",
  },
];

function check(
  label: string,
  events: PipelineEvent[],
  expect: "answer" | "no_source",
): string[] {
  const problems: string[] = [];
  const terminal = events.filter(
    (e) => e.type === "final" || e.type === "error",
  );
  if (terminal.length !== 1 || events.at(-1) !== terminal[0]) {
    problems.push(`${label}: must end with exactly one final or error event`);
  }
  const final = events.find((e) => e.type === "final");
  if (final?.type !== "final") return [...problems, `${label}: no final event`];
  if (final.result.retrieved.length > 5)
    problems.push(
      `${label}: retrieved has ${final.result.retrieved.length} items`,
    );
  const partials = events.filter((e) => e.type === "partial").length;
  if (expect === "answer") {
    if (partials === 0)
      problems.push(`${label}: expected at least one partial event`);
    if (final.result.status === "not_found")
      problems.push(
        `${label}: expected an answer, got not_found (${final.result.reason})`,
      );
  } else {
    if (events.length !== 1)
      problems.push(
        `${label}: expected a single final event, got ${events.length} events`,
      );
    if (final.result.reason !== "no_relevant_source")
      problems.push(
        `${label}: expected no_relevant_source, got ${final.result.reason}`,
      );
  }
  return problems;
}

async function main() {
  const problems: string[] = [];
  for (const { label, input, expect } of CASES) {
    const started = Date.now();
    const events: PipelineEvent[] = [];
    for await (const event of answerQuestion(input)) events.push(event);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    const sequence = events
      .map((e) => e.type)
      .reduce<string[]>((acc, type) => {
        const last = acc.at(-1);
        if (last?.startsWith(type))
          acc[acc.length - 1] =
            `${type}×${Number(last.split("×")[1] ?? 1) + 1}`;
        else acc.push(type);
        return acc;
      }, []);
    console.log(
      `\n=== ${label}: "${input.question}" (${seconds} s)\nevents: ${sequence.join(" → ")}`,
    );
    for (const event of events) {
      if (event.type === "rewrite") console.log(`rewrite: ${event.query}`);
      if (event.type === "error") console.log(`error: ${event.message}`);
      if (event.type === "final") {
        const { status, reason, answer, citations, retrieved } = event.result;
        console.log(
          `final: ${status}${reason ? ` (${reason})` : ""}\n${answer}`,
        );
        citations.forEach((c) =>
          console.log(
            `  [${c.n}] ${c.source.slug} › ${c.source.sectionPath}: "${c.quote.slice(0, 90)}…"`,
          ),
        );
        console.log(
          `retrieved: ${retrieved.map((r) => `${r.slug}=${r.score}`).join(", ") || "-"}`,
        );
      }
    }
    problems.push(...check(label, events, expect));
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
      "pipeline-check failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await getClient().catch(() => undefined))?.close();
  });
