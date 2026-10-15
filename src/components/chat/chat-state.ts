import type { Product } from "@/db/types";
import type { FinalResult } from "@/lib/pipeline";
import type { ChatTurn, Filters } from "@/lib/retrieval/types";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  phase: "streaming" | "done" | "error";
  rewrittenQuery?: string;
  result?: FinalResult;
};

export const DEFAULT_FILTERS: Filters = { product: "osszes", bank: null };

// The request schema in /api/chat: at most six turns of 2000 characters.
export const MAX_HISTORY_TURNS = 6;
export const MAX_HISTORY_CHARS = 2000;
export const MAX_QUESTION_CHARS = 1000;

export const PRODUCT_LABELS: Record<Product, string> = {
  lakashitel: "Lakáshitel",
  szemelyi_kolcson: "Személyi kölcsön",
  bankszamla: "Bankszámla",
  altalanos: "Általános",
};

/**
 * The context sent with a follow-up: user questions and verified answers
 * only. A refusal or an error carries no facts, and the streamed text was
 * never verified, so neither goes back to the model.
 */
export function buildHistory(messages: UiMessage[]): ChatTurn[] {
  const turns = messages.flatMap((message): ChatTurn[] => {
    if (message.role === "user") {
      return [{ role: "user", content: message.content }];
    }
    const { result } = message;
    if (message.phase !== "done" || !result || result.status === "not_found") {
      return [];
    }
    return [{ role: "assistant", content: result.answer }];
  });
  return turns.slice(-MAX_HISTORY_TURNS).map((turn) => ({
    ...turn,
    content: turn.content.slice(0, MAX_HISTORY_CHARS),
  }));
}
