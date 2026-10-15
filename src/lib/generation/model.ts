import "server-only";

import { Output } from "ai";

import { env } from "@/lib/env";
import { answerSchema } from "@/lib/generation/schema";
import { SYSTEM_PROMPT } from "@/lib/generation/prompt";
import { openai } from "@/lib/openai";

// Shared by streamText (first attempt) and generateText (the retry).
// Deliberately no sampling parameters: the GPT-5 family does not support them
// reliably; the prompt, the schema and the validator carry the accuracy
// (ARCHITECTURE.md §06).
export function generationOptions() {
  return {
    model: openai(env.GENERATION_MODEL),
    providerOptions: { openai: { reasoningEffort: "low" as const } },
    output: Output.object({ schema: answerSchema }),
    system: SYSTEM_PROMPT,
  };
}
