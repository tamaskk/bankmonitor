import { describe, expect, it } from "vitest";

import {
  buildHistory,
  MAX_HISTORY_CHARS,
  type UiMessage,
} from "@/components/chat/chat-state";
import { splitLines } from "@/components/chat/ndjson";
import type { FinalResult } from "@/lib/pipeline";

function result(status: FinalResult["status"], answer: string): FinalResult {
  return { status, answer, citations: [], retrieved: [] };
}

function user(content: string): UiMessage {
  return { id: content, role: "user", content, phase: "done" };
}

function assistant(content: string, extra: Partial<UiMessage> = {}): UiMessage {
  return { id: content, role: "assistant", content, phase: "done", ...extra };
}

describe("splitLines", () => {
  it("keeps an incomplete line in the buffer until its newline arrives", () => {
    const first = splitLines("", '{"type":"par');

    const second = splitLines(first.rest, 'tial"}\n{"type":"fi');

    expect(first.lines).toEqual([]);
    expect(second.lines).toEqual(['{"type":"partial"}']);
    expect(second.rest).toBe('{"type":"fi');
  });

  it("returns every complete line from one chunk and skips empty ones", () => {
    const chunk = '{"a":1}\n\n{"b":2}\n';

    const { lines, rest } = splitLines("", chunk);

    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
    expect(rest).toBe("");
  });
});

describe("buildHistory", () => {
  it("uses the final answer for assistant turns and keeps the last six", () => {
    const messages = [
      user("k1"),
      assistant("v1", { result: result("answered", "végleges 1") }),
      user("k2"),
      assistant("v2", { result: result("partial", "végleges 2") }),
      user("k3"),
      assistant("v3", { result: result("answered", "végleges 3") }),
      user("k4"),
      assistant("v4", { result: result("answered", "végleges 4") }),
    ];

    const history = buildHistory(messages);

    expect(history).toEqual([
      { role: "user", content: "k2" },
      { role: "assistant", content: "végleges 2" },
      { role: "user", content: "k3" },
      { role: "assistant", content: "végleges 3" },
      { role: "user", content: "k4" },
      { role: "assistant", content: "végleges 4" },
    ]);
  });

  it("leaves out not_found, failed and unfinished answers", () => {
    const messages = [
      user("k1"),
      assistant("nincs", { result: result("not_found", "nincs forrás") }),
      user("k2"),
      assistant("hiba", { phase: "error" }),
      user("k3"),
      assistant("félkész", { phase: "streaming" }),
    ];

    const history = buildHistory(messages);

    expect(history).toEqual([
      { role: "user", content: "k1" },
      { role: "user", content: "k2" },
      { role: "user", content: "k3" },
    ]);
  });

  it("shortens a long answer to the request limit", () => {
    const long = "a".repeat(MAX_HISTORY_CHARS + 500);
    const messages = [
      user("k1"),
      assistant("v1", { result: result("answered", long) }),
    ];

    const history = buildHistory(messages);

    expect(history[1].content).toHaveLength(MAX_HISTORY_CHARS);
  });
});
