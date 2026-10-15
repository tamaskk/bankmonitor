import { ExternalLinkIcon } from "lucide-react";

import { highlightQuotes } from "@/components/chat/answer-text";
import { PRODUCT_LABELS } from "@/components/chat/chat-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GENERAL_BANK, PRODUCTS, type Product } from "@/db/types";
import type { CitedSource } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

function productLabel(product: string): string {
  return (PRODUCTS as readonly string[]).includes(product)
    ? PRODUCT_LABELS[product as Product]
    : product;
}

export function sourceCardId(messageId: string, n: number): string {
  return `source-${messageId}-${n}`;
}

type SourceCardProps = {
  messageId: string;
  n: number;
  source: CitedSource;
  quotes: string[];
  highlighted: boolean;
};

export function SourceCard({
  messageId,
  n,
  source,
  quotes,
  highlighted,
}: SourceCardProps) {
  const { segments, unmatched } = highlightQuotes(source.content, quotes);
  const banks = source.banks.filter((bank) => bank !== GENERAL_BANK);

  return (
    <Card
      id={sourceCardId(messageId, n)}
      className={cn(
        "scroll-mt-4 ring-1 transition-shadow duration-250",
        highlighted && "ring-primary ring-2",
      )}
    >
      <CardHeader className="gap-2">
        <CardTitle className="text-base font-semibold">
          [{n}] {source.title}
        </CardTitle>
        <p className="text-muted-foreground text-xs">{source.sectionPath}</p>
        <div className="flex flex-wrap items-center gap-2">
          {source.products.map((product) => (
            <Badge key={product} variant="outline">
              {productLabel(product)}
            </Badge>
          ))}
          {banks.map((bank) => (
            <Badge key={bank} variant="outline">
              {bank}
            </Badge>
          ))}
          <span className="text-muted-foreground text-xs">
            Frissítve: {source.updatedAt}
          </span>
        </div>
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary flex w-fit items-center gap-1 text-xs underline-offset-4 hover:underline"
        >
          Megnyitás a Bankmonitoron
          <ExternalLinkIcon className="size-3" aria-hidden />
          <span className="sr-only">(új lapon nyílik meg)</span>
        </a>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {unmatched.map((quote) => (
          <blockquote
            key={quote}
            className="bg-muted rounded-md p-3 text-sm leading-relaxed wrap-break-word"
          >
            <mark className="bg-primary/15 text-inherit">{quote}</mark>
          </blockquote>
        ))}
        <ScrollArea className="max-h-64">
          <p className="pr-3 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
            {segments.map((segment, index) =>
              segment.marked ? (
                <mark key={index} className="bg-primary/15 text-inherit">
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </p>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
