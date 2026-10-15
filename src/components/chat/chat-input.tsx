import { SendIcon } from "lucide-react";
import { useState, type KeyboardEvent, type SubmitEvent } from "react";

import { MAX_QUESTION_CHARS } from "@/components/chat/chat-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatInputProps = {
  onSend: (question: string) => void;
  isLoading: boolean;
};

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [question, setQuestion] = useState("");
  const canSend = !isLoading && question.trim() !== "";

  function submit() {
    if (!canSend) return;
    onSend(question);
    setQuestion("");
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  // Enter sends, Shift+Enter adds a line; never send mid IME composition.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="question" className="sr-only">
        Kérdés
      </label>
      <div className="flex items-end gap-2">
        <Textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          maxLength={MAX_QUESTION_CHARS}
          rows={2}
          placeholder="Írd ide a kérdésed…"
          className="max-h-40 min-h-11 flex-1 resize-none text-sm"
        />
        <Button type="submit" disabled={!canSend} className="h-11 sm:h-9">
          <SendIcon />
          Küldés
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        AI által generált válasz. Ügyfél-tájékoztatás előtt ellenőrizd a
        forrást.
      </p>
    </form>
  );
}
