// Network chunks do not line up with NDJSON line breaks: keep the incomplete
// tail in the buffer until its newline arrives, or JSON.parse fails mid-event.
export function splitLines(
  buffer: string,
  chunk: string,
): { lines: string[]; rest: string } {
  const parts = (buffer + chunk).split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts.filter((line) => line.trim() !== ""), rest };
}
