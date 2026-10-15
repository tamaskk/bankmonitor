import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildHistory,
  DEFAULT_FILTERS,
  type UiMessage,
} from "@/components/chat/chat-state";
import { splitLines } from "@/components/chat/ndjson";
import type { PipelineEvent } from "@/lib/pipeline";
import type { Filters } from "@/lib/retrieval/types";

const NETWORK_ERROR = "Nem sikerült elérni a szervert. Próbáld újra.";
const CUT_OFF_ERROR = "A válasz megszakadt. Próbáld újra.";

const EVENT_TYPES = new Set(["rewrite", "partial", "final", "error"]);

// The stream is our own server's output, but a proxy or a crash can still
// send something else; drop anything that is not a known event.
function parseEvent(line: string): PipelineEvent | null {
  try {
    const value: unknown = JSON.parse(line);
    if (
      typeof value === "object" &&
      value !== null &&
      "type" in value &&
      typeof value.type === "string" &&
      EVENT_TYPES.has(value.type)
    ) {
      return value as PipelineEvent;
    }
  } catch {
    // A malformed line is skipped; the missing `final` is reported below.
  }
  return null;
}

async function readErrorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return NETWORK_ERROR;
}

export function useChat() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the page stops the request, so the server stops paying for it.
  useEffect(() => () => abortRef.current?.abort(), []);

  const updateMessage = useCallback(
    (id: string, patch: Partial<UiMessage>) =>
      setMessages((current) =>
        current.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      ),
    [],
  );

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isLoading) return;

      const history = buildHistory(messages);
      const assistantId = crypto.randomUUID();
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: trimmed,
          phase: "done",
        },
        { id: assistantId, role: "assistant", content: "", phase: "streaming" },
      ]);
      setIsLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            product: filters.product,
            bank: filters.bank,
            history,
          }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          updateMessage(assistantId, {
            phase: "error",
            content: await readErrorMessage(response),
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;
        while (!finished) {
          const { value, done } = await reader.read();
          if (done) break;
          const { lines, rest } = splitLines(
            buffer,
            decoder.decode(value, { stream: true }),
          );
          buffer = rest;
          for (const line of lines) {
            const event = parseEvent(line);
            if (!event) continue;
            if (event.type === "rewrite") {
              updateMessage(assistantId, { rewrittenQuery: event.query });
            } else if (event.type === "partial") {
              updateMessage(assistantId, { content: event.answer });
            } else if (event.type === "final") {
              // The verified text always replaces whatever was streamed.
              updateMessage(assistantId, {
                phase: "done",
                content: event.result.answer,
                result: event.result,
              });
              finished = true;
            } else {
              updateMessage(assistantId, {
                phase: "error",
                content: event.message,
              });
              finished = true;
            }
          }
        }
        if (!finished) {
          updateMessage(assistantId, {
            phase: "error",
            content: CUT_OFF_ERROR,
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          updateMessage(assistantId, {
            phase: "error",
            content: NETWORK_ERROR,
          });
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsLoading(false);
      }
    },
    [filters, isLoading, messages, updateMessage],
  );

  // A new conversation stops the running answer and empties the history.
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  return { messages, filters, setFilters, isLoading, send, reset };
}
