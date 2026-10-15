import "server-only";

import { generateText } from "ai";

import { env } from "@/lib/env";
import { openai } from "@/lib/openai";
import type { ChatTurn } from "@/lib/retrieval/types";

export const REWRITE_HISTORY_TURNS = 6;
const MAX_REWRITE_CHARS = 500;

const REWRITE_INSTRUCTION =
  "Fogalmazd át a legutóbbi kérdést önálló, az előzmények nélkül is érthető kérdéssé. Ha már önálló, változatlanul add vissza. Csak a kérdést írd ki, magyarázat nélkül. Ne válaszold meg a kérdést.";

export function buildRewritePrompt(
  question: string,
  history: ChatTurn[],
): string {
  const turns = history
    .slice(-REWRITE_HISTORY_TURNS)
    .map(
      (turn) =>
        `${turn.role === "user" ? "Felhasználó" : "Asszisztens"}: ${turn.content}`,
    )
    .join("\n");
  return `${REWRITE_INSTRUCTION}\n\nElőzmények:\n${turns}\n\nLegutóbbi kérdés: ${question}`;
}

// An empty or overly long result (the model started answering instead of
// rewriting) falls back to the original question.
export function acceptRewrite(original: string, rewritten: string): string {
  const text = rewritten.trim();
  return text.length === 0 || text.length > MAX_REWRITE_CHARS ? original : text;
}

/**
 * Turns a follow-up ("És a minimális összeg?") into a standalone question for
 * search, rerank and generation. No model call without history.
 */
export async function rewriteQuery(
  question: string,
  history: ChatTurn[],
  abortSignal?: AbortSignal,
): Promise<string> {
  if (history.length === 0) return question;
  const { text } = await generateText({
    model: openai(env.HELPER_MODEL),
    providerOptions: { openai: { reasoningEffort: "low" } },
    prompt: buildRewritePrompt(question, history),
    abortSignal,
  });
  return acceptRewrite(question, text);
}
