// Pure text helpers for the answer view. The answer is rendered as text,
// never as HTML: markers become elements through a regex split.

export type AnswerPart =
  { type: "text"; text: string } | { type: "marker"; n: number };

export function splitMarkers(answer: string): AnswerPart[] {
  return answer
    .split(/(\[\d+\])/)
    .filter((piece) => piece !== "")
    .map((piece): AnswerPart => {
      const match = /^\[(\d+)\]$/.exec(piece);
      return match
        ? { type: "marker", n: Number(match[1]) }
        : { type: "text", text: piece };
    });
}

export type Segment = { text: string; marked: boolean };

/**
 * Finds each quote in the chunk text, ignoring case (Hungarian locale), and
 * splits the text into marked and unmarked segments. Quotes that differ in
 * typography (quotes, dashes) are returned as unmatched, to show separately.
 */
export function highlightQuotes(
  content: string,
  quotes: string[],
): { segments: Segment[]; unmatched: string[] } {
  const haystack = content.toLocaleLowerCase("hu");
  // Index positions only line up if lowercasing kept the length.
  const comparable = haystack.length === content.length;
  const ranges: [number, number][] = [];
  const unmatched: string[] = [];

  for (const quote of quotes) {
    const needle = quote.trim().toLocaleLowerCase("hu");
    const start = comparable && needle ? haystack.indexOf(needle) : -1;
    if (start === -1) unmatched.push(quote);
    else ranges.push([start, start + needle.length]);
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ text: content.slice(cursor, start), marked: false });
    }
    segments.push({ text: content.slice(start, end), marked: true });
    cursor = end;
  }
  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor), marked: false });
  }
  return { segments, unmatched };
}
