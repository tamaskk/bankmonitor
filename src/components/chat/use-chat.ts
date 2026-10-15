import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildHistory,
  DEFAULT_FILTERS,
  type UiMessage,
} from "@/components/chat/chat-state";
import { parseEvent } from "@/components/chat/events";
import { splitLines } from "@/components/chat/ndjson";
import type { PipelineEvent } from "@/lib/pipeline";
import type { Filters } from "@/lib/retrieval/types";

const NETWORK_ERROR = "Nem sikerült elérni a szervert. Próbáld újra.";
const CUT_OFF_ERROR = "A válasz megszakadt. Próbáld újra.";

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

  // Applies one stream event; returns true for the terminal `final` or
  // `error`, after which nothing else may change the message.
  const applyEvent = useCallback(
    (id: string, event: PipelineEvent): boolean => {
      switch (event.type) {
        case "rewrite":
          updateMessage(id, { rewrittenQuery: event.query });
          return false;
        case "partial":
          updateMessage(id, { content: event.answer });
          return false;
        case "final":
          // The verified text always replaces whatever was streamed.
          updateMessage(id, {
            phase: "done",
            content: event.result.answer,
            result: event.result,
          });
          return true;
        case "error":
          updateMessage(id, { phase: "error", content: event.message });
          return true;
      }
    },
    [updateMessage],
  );

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      // The ref, not the state: two clicks in one tick both see the old state.
      if (!trimmed || abortRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;

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

      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
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

        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;
        while (!finished) {
          const { value, done } = await reader.read();
          // At the end, flush the decoder and treat the tail as a last line.
          const chunk = done
            ? decoder.decode() + "\n"
            : decoder.decode(value, { stream: true });
          const { lines, rest } = splitLines(buffer, chunk);
          buffer = rest;
          for (const line of lines) {
            const event = parseEvent(line);
            if (event && applyEvent(assistantId, event)) {
              finished = true;
              break;
            }
          }
          if (done) break;
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
        // Exactly one terminal event: stop reading whatever else arrives.
        reader?.cancel().catch(() => undefined);
        // A reset may already have started over; leave its state alone.
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [applyEvent, filters, messages, updateMessage],
  );

  // A new conversation stops the running answer and empties the history.
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setMessages([]);
  }, []);

  return { messages, filters, setFilters, isLoading, send, reset };
}
