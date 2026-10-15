// Turns user input into search values. Pure module: no env, no database, so
// the unit tests run without .env.local. The route validates the request
// too; this is the last check before values reach a pipeline
// (.claude/rules/database.md), and model rewrites (T-010) skip the route.
import { z } from "zod";

import { GENERAL_BANK, PRODUCTS } from "@/db/types";
import type { Filters } from "@/lib/retrieval/types";

export const MAX_QUESTION_CHARS = 1000;
// Follow-up context the chat accepts: enough for a short conversation,
// small enough that one request cannot trigger an expensive rewrite.
export const MAX_HISTORY_TURNS = 6;
export const MAX_HISTORY_CHARS = 2000;
export const MAX_QUERY_TOKENS = 64;
const MIN_TOKEN_CHARS = 2;
const MAX_TOKEN_CHARS = 50;

export const filtersSchema = z.object({
  product: z.enum([...PRODUCTS, "osszes"]),
  bank: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((bank) => !bank.startsWith("$"), "bank must not start with $")
    .nullable(),
}) satisfies z.ZodType<Filters>;

// General documents (product and bank `altalanos`) stay in every filtered
// result: they answer questions for every product and bank.
export type FilterValues = { products?: string[]; banks?: string[] };

/** Throws on anything that is not a valid `Filters` value. */
export function buildFilter(input: unknown): FilterValues {
  const filters = filtersSchema.parse(input);
  const values: FilterValues = {};
  if (filters.product !== "osszes") {
    values.products = [filters.product, "altalanos"];
  }
  if (filters.bank !== null) {
    values.banks = [filters.bank, GENERAL_BANK];
  }
  return values;
}

/**
 * Only words reach Atlas Search: punctuation and operators carry no meaning
 * for the `text` operator. Single letters are noise, very long tokens are not
 * words, and the token cap keeps the query under Lucene's clause limit.
 */
export function extractWordTokens(question: string): string {
  // NFC first: decomposed accents (pasted from a PDF) would split words.
  const text = question.normalize("NFC").slice(0, MAX_QUESTION_CHARS);
  const tokens = (text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).filter((token) => {
    const length = [...token].length;
    return length >= MIN_TOKEN_CHARS && length <= MAX_TOKEN_CHARS;
  });
  return [...new Set(tokens)].slice(0, MAX_QUERY_TOKENS).join(" ");
}
