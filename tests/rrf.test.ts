import { describe, expect, it } from "vitest";

import { rrf } from "@/lib/retrieval/rrf";
import type { Candidate } from "@/lib/retrieval/types";

function candidate(id: string): Candidate {
  return {
    id,
    slug: id.split("#")[0],
    title: `Dokumentum ${id}`,
    sectionPath: "Bevezető",
    contextHeader: "",
    content: `Tartalom ${id}`,
    products: ["altalanos"],
    banks: ["altalanos"],
    sourceUrl: "https://bankmonitor.hu/",
    updatedAt: "2026-01-01",
  };
}

const ids = (list: Candidate[]) => list.map((c) => c.id);

describe("rrf", () => {
  it("ranks a chunk found by both searches above one found by a single search at the same rank", () => {
    const vector = [candidate("a#0"), candidate("b#0")];
    const fullText = [candidate("b#0"), candidate("c#0")];

    const result = rrf([vector, fullText]);

    expect(ids(result)).toEqual(["b#0", "a#0", "c#0"]);
  });

  it("ranks a deep match in both lists above a top match in only one", () => {
    const vector = [
      ...["v1", "v2", "v3", "v4"].map((id) => candidate(`${id}#0`)),
      candidate("both#0"),
    ];
    const fullText = [
      ...["t1", "t2", "t3", "t4"].map((id) => candidate(`${id}#0`)),
      candidate("both#0"),
    ];

    const result = rrf([vector, fullText]);

    expect(ids(result)[0]).toBe("both#0");
  });

  it("scores a chunk repeated within one list only once", () => {
    const vector = [candidate("a#0"), candidate("a#0"), candidate("b#0")];
    const fullText = [candidate("b#0")];

    const result = rrf([vector, fullText]);

    expect(ids(result)).toEqual(["b#0", "a#0"]);
  });

  it("returns at most 20 chunks by default", () => {
    const vector = Array.from({ length: 25 }, (_, i) => candidate(`v#${i}`));

    const result = rrf([vector]);

    expect(ids(result)).toEqual(ids(vector.slice(0, 20)));
  });

  it("keeps every chunk once when the lists are disjoint, interleaved by rank", () => {
    const vector = [candidate("a#0"), candidate("b#0")];
    const fullText = [candidate("c#0"), candidate("d#0")];

    const result = rrf([vector, fullText]);

    expect(ids(result)).toEqual(["a#0", "c#0", "b#0", "d#0"]);
  });

  it("returns the other list unchanged when one list is empty", () => {
    const fullText = [candidate("a#0"), candidate("b#0"), candidate("c#0")];

    const result = rrf([[], fullText]);

    expect(ids(result)).toEqual(["a#0", "b#0", "c#0"]);
  });

  it("returns an empty array for empty input lists", () => {
    const result = rrf([[], []]);

    expect(result).toEqual([]);
  });

  it("breaks a score tie in favour of the first occurrence", () => {
    const vector = [candidate("a#0")];
    const fullText = [candidate("b#0")];

    const result = rrf([vector, fullText]);

    expect(ids(result)).toEqual(["a#0", "b#0"]);
  });

  it("returns at most `limit` chunks, each once", () => {
    const vector = Array.from({ length: 15 }, (_, i) => candidate(`v#${i}`));
    const fullText = [
      ...vector.slice(0, 5),
      ...Array.from({ length: 15 }, (_, i) => candidate(`t#${i}`)),
    ];

    const result = rrf([vector, fullText], 60, 20);

    expect(result).toHaveLength(20);
    expect(new Set(ids(result)).size).toBe(20);
  });
});
