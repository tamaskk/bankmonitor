// T-007: runs three questions through both searches without a filter, with a
// product filter and with a bank filter, prints both result lists and checks
// the acceptance criteria. Read-only against Atlas; costs 3 embedding calls.
// Run: npm run search:check
import "./load-env";

import type { MongoClient } from "mongodb";

import { getClient } from "@/db/client";
import { GENERAL_BANK } from "@/db/types";
import { embedQuery } from "@/lib/embeddings";
import { hybridSearch, SEARCH_LIMIT } from "@/lib/retrieval/search";
import type { Candidate, Filters } from "@/lib/retrieval/types";

const QUESTIONS = [
  "Mennyi a személyi kölcsön maximális futamideje?",
  "Mennyi az OTP bankszámla havi díja?",
  "Mit jelent a THM?",
];

const FILTERS: { label: string; filters: Filters }[] = [
  { label: "no filter", filters: { product: "osszes", bank: null } },
  {
    label: "product=szemelyi_kolcson",
    filters: { product: "szemelyi_kolcson", bank: null },
  },
  { label: "bank=OTP Bank", filters: { product: "osszes", bank: "OTP Bank" } },
];

function describe(candidate: Candidate): string {
  return `${candidate.slug} › ${candidate.sectionPath} [${candidate.products.join(",")}] [${candidate.banks.join(",")}]`;
}

function checkList(
  name: string,
  list: Candidate[],
  filters: Filters,
): string[] {
  const problems: string[] = [];
  if (list.length > SEARCH_LIMIT) {
    problems.push(`${name}: ${list.length} results, limit ${SEARCH_LIMIT}`);
  }
  for (const candidate of list) {
    if ("embedding" in candidate) {
      problems.push(`${name}: ${candidate.id} contains the embedding`);
    }
    if (
      filters.product !== "osszes" &&
      !candidate.products.some(
        (p) => p === filters.product || p === "altalanos",
      )
    ) {
      problems.push(`${name}: ${candidate.id} fails the product filter`);
    }
    if (
      filters.bank !== null &&
      !candidate.banks.some((b) => b === filters.bank || b === GENERAL_BANK)
    ) {
      problems.push(`${name}: ${candidate.id} fails the bank filter`);
    }
  }
  return problems;
}

// Connected up front and closed in `finally` only if it exists, so a failure
// before the first query does not open a connection just to close it.
let client: MongoClient | undefined;

async function main() {
  client = await getClient();
  const problems: string[] = [];

  for (const [index, question] of QUESTIONS.entries()) {
    const embedding = await embedQuery(question);
    for (const { label, filters } of FILTERS) {
      const { vector, fullText } = await hybridSearch(
        question,
        embedding,
        filters,
      );
      console.log(`\n=== ${question} (${label})`);
      console.log(`vector (${vector.length}):`);
      vector.forEach((c, i) => console.log(`  ${i + 1}. ${describe(c)}`));
      console.log(`full-text (${fullText.length}):`);
      fullText.forEach((c, i) => console.log(`  ${i + 1}. ${describe(c)}`));

      problems.push(...checkList(`${label} vector`, vector, filters));
      problems.push(...checkList(`${label} full-text`, fullText, filters));
      // The first question uses an inflected form of "futamidő", which the
      // knowledge base contains; the Hungarian analyzer must stem it.
      if (index === 0 && fullText.length === 0) {
        problems.push(`${label} full-text: no hit for "futamideje"`);
      }
    }
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
    // Driver errors can embed the connection string; print the message only.
    console.error(
      "search-check failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await client?.close();
  });
