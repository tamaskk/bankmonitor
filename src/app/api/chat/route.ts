import { z } from "zod";

import { answerQuestion } from "@/lib/pipeline";
import { MAX_QUESTION_CHARS, filtersSchema } from "@/lib/retrieval/query";

// No `runtime` export: Cache Components rejects it, and Node.js (which the
// MongoDB driver needs) is the default. A full run (rewrite, search, rerank,
// generation, one retry) takes 10–25 s, beyond the default function limit.
export const maxDuration = 60;

// Caps keep a single request from triggering an expensive model call.
// `altalanos` is a document tag, not a product the user can pick.
const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
  product: z.enum(["osszes", "lakashitel", "szemelyi_kolcson", "bankszamla"]),
  bank: filtersSchema.shape.bank,
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .max(6),
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Érvénytelen kérés. Ellenőrizd a kérdést és a szűrőket." },
      { status: 400 },
    );
  }
  const { question, product, bank, history } = parsed.data;

  // NDJSON rather than SSE: the client sends a POST, and EventSource only
  // does GET. The request signal reaches every model and database call, so a
  // closed connection stops the paid work.
  const signal = request.signal;
  const encoder = new TextEncoder();
  const events = answerQuestion(
    { question, filters: { product, bank }, history },
    signal,
  );

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          if (signal.aborted) break;
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
        controller.close();
      } catch (error) {
        // Enqueue fails once the client is gone; anything else is a bug the
        // pipeline did not turn into an `error` event.
        if (!signal.aborted) {
          console.error(
            "[api/chat] stream failed:",
            error instanceof Error ? error.message : error,
          );
          controller.error(error);
        }
      } finally {
        await events.return(undefined);
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
