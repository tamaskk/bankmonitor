import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import { describe, expect, it } from "vitest";

import { buildHistory, type UiMessage } from "@/components/chat/chat-state";
import { parseEvent } from "@/components/chat/events";
import {
  assistantReply,
  GREETING_MESSAGE,
  HELP_MESSAGE,
  THANKS_MESSAGE,
} from "@/lib/generation/assistant-help";

describe("assistantReply", () => {
  it("returns the fixed text for help, greeting and thanks, and nothing for a real question", () => {
    const replies = (["help", "greeting", "thanks", "question"] as const).map(
      assistantReply,
    );

    expect(replies).toEqual([
      HELP_MESSAGE,
      GREETING_MESSAGE,
      THANKS_MESSAGE,
      null,
    ]);
  });

  it("names exactly the banks that have their own documents", () => {
    const dir = path.resolve(import.meta.dirname, "../data/docs");
    const banks = new Set(
      readdirSync(dir)
        .filter((file) => file.endsWith(".md"))
        .flatMap(
          (file) =>
            matter(readFileSync(path.join(dir, file), "utf8")).data
              .banks as string[],
        ),
    );

    const bankLine =
      /^Bankspecifikus anyag: (.+)\.$/m.exec(HELP_MESSAGE)?.[1] ?? "";
    const mentioned = bankLine.split(", ");

    expect(new Set(mentioned)).toEqual(banks);
  });
});

describe("the info status in the UI", () => {
  it("parses an info final event", () => {
    const line = JSON.stringify({
      type: "final",
      result: {
        status: "info",
        answer: HELP_MESSAGE,
        citations: [],
        retrieved: [],
      },
    });

    const event = parseEvent(line);

    expect(event?.type === "final" && event.result.status).toBe("info");
  });

  it("keeps a fixed help reply out of the follow-up history", () => {
    const messages: UiMessage[] = [
      {
        id: "q",
        role: "user",
        content: "Mit tudok tőled kérdezni?",
        phase: "done",
      },
      {
        id: "a",
        role: "assistant",
        content: HELP_MESSAGE,
        phase: "done",
        result: {
          status: "info",
          answer: HELP_MESSAGE,
          citations: [],
          retrieved: [],
        },
      },
    ];

    const history = buildHistory(messages);

    expect(history).toEqual([
      { role: "user", content: "Mit tudok tőled kérdezni?" },
    ]);
  });
});
