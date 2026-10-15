import { z } from "zod";

import { answerQuestion } from "@/lib/pipeline";
import {
  filtersSchema,
  MAX_HISTORY_CHARS,
  MAX_HISTORY_TURNS,
  MAX_QUESTION_CHARS,
} from "@/lib/retrieval/query";

// No `runtime` export: Cache Components rejects it, and Node.js (which the
// MongoDB driver needs) is the default. A full run (rewrite, search, rerank,
// generation, one retry) takes 10–25 s, beyond the default function limit.
export const maxDuration = 60;

// A valid body is ~13k characters; anything far larger is not a question.
const MAX_BODY_BYTES = 32 * 1024;

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
        content: z.string().trim().min(1).max(MAX_HISTORY_CHARS),
      }),
    )
    .max(MAX_HISTORY_TURNS),
});

export async function POST(request: Request) {
  // Only JSON: a cross-site `text/plain` form post would otherwise parse and
  // run a paid pipeline with the user's cached Basic Auth credentials. JSON
  // forces a CORS preflight, which this route never approves.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json(
      { error: "A kérés formátuma nem támogatott." },
      { status: 415 },
    );
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "A kérés túl nagy." }, { status: 413 });
  }

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
  // does GET. The request signal reaches the rewrite, search, rerank and
  // generation calls, so a closed connection stops the paid work.
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
        // A cancelled stream is already closed; closing it again throws.
        if (!signal.aborted) controller.close();
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
      // The lines carry model text; never let a browser sniff them as HTML.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
