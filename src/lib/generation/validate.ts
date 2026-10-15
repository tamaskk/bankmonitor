// T-012: deterministic citation checks on the model's answer. Pure: no env,
// no database, so the unit tests run without .env.local. When good answers
// fail here, tighten the prompt's quoting rule; never loosen these checks
// (ARCHITECTURE.md §06).
import type { ModelAnswer } from "@/lib/generation/schema";
import type { RankedCandidate } from "@/lib/retrieval/types";

export const MIN_QUOTE_CHARS = 10;
const MARKER = /\[(\d+)\]/g;

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

// Typographic variants (quote styles, dashes, line breaks, case) must not
// decide whether a quote is genuine.
export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[„”“"'’‘]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("hu");
}

export function validateAnswer(
  output: ModelAnswer,
  sources: Pick<RankedCandidate, "content">[],
): ValidationResult {
  if (output.status === "not_found") return { ok: true };

  const errors: string[] = [];
  const isKnownSource = (id: number) =>
    Number.isInteger(id) && id >= 1 && id <= sources.length;

  if (output.citations.length === 0) errors.push("the answer has no citations");

  output.citations.forEach((citation, i) => {
    const label = `citation ${i + 1} (source ${citation.sourceId})`;
    if (!isKnownSource(citation.sourceId)) {
      errors.push(
        `${label}: source ${citation.sourceId} does not exist (1-${sources.length})`,
      );
      return;
    }
    const quote = normalize(citation.quote);
    if (quote.length < MIN_QUOTE_CHARS) {
      errors.push(
        `${label}: quote is shorter than ${MIN_QUOTE_CHARS} characters`,
      );
      return;
    }
    if (!normalize(sources[citation.sourceId - 1].content).includes(quote)) {
      errors.push(
        `${label}: quote is not in the source verbatim: "${citation.quote}"`,
      );
    }
  });

  const markers = new Set(
    [...output.answer.matchAll(MARKER)].map((match) => Number(match[1])),
  );
  const cited = new Set(output.citations.map((citation) => citation.sourceId));
  if (markers.size === 0) errors.push("the answer has no [n] markers");
  for (const n of markers) {
    if (!cited.has(n)) errors.push(`marker [${n}] has no citation`);
  }
  for (const n of cited) {
    if (!markers.has(n))
      errors.push(
        `citation for source ${n} has no [${n}] marker in the answer`,
      );
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
