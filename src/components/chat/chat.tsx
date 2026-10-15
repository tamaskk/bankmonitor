"use client";

import { useEffect, useRef } from "react";

import { ChatInput } from "@/components/chat/chat-input";
import type { UiMessage } from "@/components/chat/chat-state";
import { FilterBar } from "@/components/chat/filter-bar";
import { useChat } from "@/components/chat/use-chat";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const EXAMPLE_QUESTIONS = [
  "Mennyi a személyi kölcsön maximális futamideje?",
  "Mit jelent a THM?",
  "Mik az OTP bankszámla díjmentességi feltételei?",
];

function AssistantMessage({ message }: { message: UiMessage }) {
  return (
    <div className="flex flex-col gap-2">
      {message.rewrittenQuery ? (
        <p className="text-muted-foreground text-xs">
          Keresett kérdés: {message.rewrittenQuery}
        </p>
      ) : null}
      {message.phase === "error" ? (
        <p role="alert" className="text-destructive text-sm">
          {message.content}
        </p>
      ) : (
        <p
          className={
            message.phase === "streaming"
              ? "text-muted-foreground max-w-prose text-sm leading-relaxed whitespace-pre-wrap"
              : "max-w-prose text-sm leading-relaxed whitespace-pre-wrap"
          }
        >
          {message.content ||
            (message.phase === "streaming" ? "Válasz készül…" : "")}
        </p>
      )}
    </div>
  );
}

export function Chat() {
  const { messages, filters, setFilters, isLoading, send, reset } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view while the answer streams in.
  const lastContent = messages.at(-1)?.content;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, lastContent]);

  return (
    <>
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onNewConversation={reset}
        canReset={messages.length > 0}
      />

      <section
        aria-label="Beszélgetés"
        aria-live="polite"
        className="flex flex-1 flex-col gap-6 py-6"
      >
        {messages.length === 0 ? (
          <EmptyState
            title="Kérdezz a tudásbázisból."
            description="A válasz csak a Bankmonitor cikkeiből készül, minden állításhoz forrással."
            action={
              <div className="flex flex-col items-center gap-1">
                {EXAMPLE_QUESTIONS.map((question) => (
                  <Button
                    key={question}
                    variant="link"
                    className="h-auto whitespace-normal"
                    onClick={() => send(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            }
          />
        ) : (
          messages.map((message) =>
            message.role === "user" ? (
              <p
                key={message.id}
                className="bg-muted max-w-prose self-end rounded-lg px-4 py-3 text-sm whitespace-pre-wrap"
              >
                {message.content}
              </p>
            ) : (
              <AssistantMessage key={message.id} message={message} />
            ),
          )
        )}
        <div ref={endRef} />
      </section>

      <div className="bg-background sticky bottom-0 pt-2 pb-4">
        <ChatInput onSend={send} isLoading={isLoading} />
      </div>
    </>
  );
}
