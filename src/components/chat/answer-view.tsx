import { useEffect, useRef, useState } from "react";

import { splitMarkers } from "@/components/chat/answer-text";
import type { UiMessage } from "@/components/chat/chat-state";
import { SourceCard, sourceCardId } from "@/components/chat/source-card";
import { Badge } from "@/components/ui/badge";
import type { CitedSource, FinalResult } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

const HIGHLIGHT_MS = 1500;

const REASON_TEXT: Record<NonNullable<FinalResult["reason"]>, string> = {
  no_relevant_source: "Nincs elég releváns forrás a tudásbázisban",
  validation_failed: "A válasz nem ment át a forrásellenőrzésen",
  model_not_found: "A források nem tartalmazzák a választ",
};

type SourceGroup = { n: number; source: CitedSource; quotes: string[] };

// One card per source, with every quote the answer took from it.
function groupCitations(citations: FinalResult["citations"]): SourceGroup[] {
  const groups = new Map<number, SourceGroup>();
  for (const { n, quote, source } of citations) {
    const group = groups.get(n);
    if (group) group.quotes.push(quote);
    else groups.set(n, { n, source, quotes: [quote] });
  }
  return [...groups.values()].sort((a, b) => a.n - b.n);
}

function StatusBadge({ message }: { message: UiMessage }) {
  if (message.phase === "streaming") {
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        Ellenőrzés folyamatban…
      </Badge>
    );
  }
  if (message.result?.status === "answered") {
    return (
      <Badge className="bg-success/10 text-success">
        Forrással ellenőrizve
      </Badge>
    );
  }
  if (message.result?.status === "partial") {
    return (
      <Badge className="bg-warning/10 text-warning">Részleges válasz</Badge>
    );
  }
  return null;
}

export function AnswerView({ message }: { message: UiMessage }) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const { result } = message;
  const groups =
    message.phase === "done" && result ? groupCitations(result.citations) : [];
  const cited = new Set(groups.map((group) => group.n));

  function showSource(n: number) {
    const card = document.getElementById(sourceCardId(message.id, n));
    if (!card) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    card.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
    setHighlighted(n);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
  }

  return (
    <article
      className="flex flex-col gap-3"
      aria-busy={message.phase === "streaming"}
    >
      {message.rewrittenQuery ? (
        <p className="text-muted-foreground text-xs">
          Keresett kérdés: {message.rewrittenQuery}
        </p>
      ) : null}

      {message.phase === "error" ? (
        <p role="alert" className="text-destructive text-sm">
          {message.content}
        </p>
      ) : result?.status === "not_found" ? (
        <div
          role="status"
          className="border-destructive flex max-w-prose flex-col gap-1 rounded-lg border p-4"
        >
          <p className="text-sm leading-relaxed wrap-break-word">
            {result.answer}
          </p>
          {result.reason ? (
            <p className="text-muted-foreground text-xs">
              {REASON_TEXT[result.reason]}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          {/* Only the verification state is announced, never the
              unverified text as it streams. */}
          <div role="status">
            <StatusBadge message={message} />
          </div>
          <p
            className={cn(
              "max-w-prose text-sm leading-relaxed wrap-break-word whitespace-pre-wrap",
              message.phase === "streaming" && "text-muted-foreground",
            )}
          >
            {message.content === "" && message.phase === "streaming"
              ? "Válasz készül…"
              : splitMarkers(message.content).map((part, index) =>
                  part.type === "text" ? (
                    <span key={index}>{part.text}</span>
                  ) : cited.has(part.n) ? (
                    <Badge
                      key={index}
                      render={
                        <button
                          type="button"
                          aria-label={`${part.n}. forrás megnyitása`}
                          onClick={() => showSource(part.n)}
                        />
                      }
                      className="relative mx-1 cursor-pointer overflow-visible align-baseline after:absolute after:-inset-3"
                    >
                      [{part.n}]
                    </Badge>
                  ) : (
                    <span key={index}>[{part.n}]</span>
                  ),
                )}
          </p>
        </>
      )}

      {groups.length > 0 ? (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <SourceCard
              key={group.n}
              messageId={message.id}
              n={group.n}
              source={group.source}
              quotes={group.quotes}
              highlighted={highlighted === group.n}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
