// T-011: one question through the full retrieval and one (non-streamed)
// generation call; prints the prompt's source list and the raw model output,
// and checks it against answerSchema. Read-only against Atlas; costs one
// embedding, one rerank and one generation call. Run: npm run generate:check
import "./load-env";

import { generateText } from "ai";

import { getClient } from "@/db/client";
import { embedQuery } from "@/lib/embeddings";
import { generationOptions } from "@/lib/generation/model";
import { buildUserPrompt } from "@/lib/generation/prompt";
import { answerSchema } from "@/lib/generation/schema";
import { validateAnswer } from "@/lib/generation/validate";
import { rerank } from "@/lib/retrieval/rerank";
import { rrf } from "@/lib/retrieval/rrf";
import { hybridSearch } from "@/lib/retrieval/search";
import type { Filters } from "@/lib/retrieval/types";

const question =
  process.argv[2] ?? "Mennyi a személyi kölcsön maximális futamideje?";
const filters: Filters = { product: "szemelyi_kolcson", bank: null };

async function main() {
  const embedding = await embedQuery(question);
  const { vector, fullText } = await hybridSearch(question, embedding, filters);
  const sources = await rerank(question, rrf([vector, fullText]));
  if (sources.length === 0) {
    console.log(
      "no source above the threshold: the pipeline would answer not_found without generating",
    );
    return;
  }

  const prompt = buildUserPrompt(question, sources, filters);
  console.log(
    prompt
      .split("\n")
      .filter((line) => line.startsWith("<forrás "))
      .join("\n"),
  );

  const started = Date.now();
  const { output } = await generateText({ ...generationOptions(), prompt });
  console.log(
    `\ngeneration: ${Date.now() - started} ms\n${JSON.stringify(output, null, 2)}`,
  );

  const parsed = answerSchema.safeParse(output);
  console.log(
    `\nanswerSchema.safeParse: ${parsed.success ? "ok" : parsed.error.message}`,
  );
  const validation = validateAnswer(output, sources);
  console.log(
    `validateAnswer: ${validation.ok ? "ok" : validation.errors.join("; ")}`,
  );
  if (!parsed.success) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(
      "generate-check failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await getClient().catch(() => undefined))?.close();
  });
