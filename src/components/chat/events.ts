import { z } from "zod";

import type { PipelineEvent } from "@/lib/pipeline";

// The stream is the trust boundary between server and UI: a proxy, a crash
// or a version mismatch can send lines the views would crash on. Only
// well-formed events reach the state; everything else is dropped.
const citedSourceSchema = z.object({
  slug: z.string(),
  title: z.string(),
  sectionPath: z.string(),
  content: z.string(),
  sourceUrl: z.string(),
  products: z.array(z.string()),
  banks: z.array(z.string()),
  updatedAt: z.string(),
});

const finalResultSchema = z.object({
  status: z.enum(["answered", "partial", "not_found", "info"]),
  answer: z.string(),
  reason: z
    .enum(["no_relevant_source", "validation_failed", "model_not_found"])
    .optional(),
  citations: z.array(
    z.object({ n: z.number(), quote: z.string(), source: citedSourceSchema }),
  ),
  retrieved: z.array(z.object({ slug: z.string(), score: z.number() })),
});

const pipelineEventSchema: z.ZodType<PipelineEvent> = z.discriminatedUnion(
  "type",
  [
    z.object({ type: z.literal("rewrite"), query: z.string() }),
    z.object({ type: z.literal("partial"), answer: z.string() }),
    z.object({ type: z.literal("final"), result: finalResultSchema }),
    z.object({ type: z.literal("error"), message: z.string() }),
  ],
);

export function parseEvent(line: string): PipelineEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  const parsed = pipelineEventSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
