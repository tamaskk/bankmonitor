import { z } from "zod";

// What the generation model must return. No Zod min/max: OpenAI strict
// structured output rejects some JSON Schema keywords; every content check
// happens in validate.ts (ARCHITECTURE.md §06).
export const answerSchema = z.object({
  status: z.enum(["answered", "partial", "not_found"]),
  answer: z.string(),
  citations: z.array(z.object({ sourceId: z.number(), quote: z.string() })),
});

export type ModelAnswer = z.infer<typeof answerSchema>;

export const NOT_FOUND_MESSAGE =
  "Erre a kérdésre nem találtam megbízható forrást a tudásbázisban. Ellenőrizd a kérdést vagy a szűrőket.";
