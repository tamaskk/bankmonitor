import { describe, expect, it } from "vitest";

import { highlightQuotes, splitMarkers } from "@/components/chat/answer-text";

describe("splitMarkers", () => {
  it("turns [n] markers into numbered parts between text parts", () => {
    const answer = "A futamidő legfeljebb 10 év [1], bankonként eltér [2][3].";

    const parts = splitMarkers(answer);

    expect(parts).toEqual([
      { type: "text", text: "A futamidő legfeljebb 10 év " },
      { type: "marker", n: 1 },
      { type: "text", text: ", bankonként eltér " },
      { type: "marker", n: 2 },
      { type: "marker", n: 3 },
      { type: "text", text: "." },
    ]);
  });

  it("returns one text part when there is no marker", () => {
    const parts = splitMarkers("Nincs jelölő.");

    expect(parts).toEqual([{ type: "text", text: "Nincs jelölő." }]);
  });
});

describe("highlightQuotes", () => {
  it("marks a quote found regardless of case", () => {
    const content = "A Maximális futamidő 10 év. Más szöveg.";

    const { segments, unmatched } = highlightQuotes(content, [
      "maximális futamidő 10 év",
    ]);

    expect(segments).toEqual([
      { text: "A ", marked: false },
      { text: "Maximális futamidő 10 év", marked: true },
      { text: ". Más szöveg.", marked: false },
    ]);
    expect(unmatched).toEqual([]);
  });

  it("marks several quotes in text order and merges overlaps", () => {
    const content = "egy kettő három négy öt";

    const { segments } = highlightQuotes(content, [
      "négy",
      "kettő három",
      "három négy",
    ]);

    expect(segments).toEqual([
      { text: "egy ", marked: false },
      { text: "kettő három négy", marked: true },
      { text: " öt", marked: false },
    ]);
  });

  it("returns a quote that is not in the text as unmatched", () => {
    const content = "A THM „teljes hiteldíj mutató”.";

    const { segments, unmatched } = highlightQuotes(content, [
      'A THM "teljes hiteldíj mutató"',
    ]);

    expect(segments).toEqual([{ text: content, marked: false }]);
    expect(unmatched).toEqual(['A THM "teljes hiteldíj mutató"']);
  });
});
