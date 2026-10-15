import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import { describe, expect, it } from "vitest";

import {
  MAX_CHUNK_CHARS,
  MIN_SECTION_CHARS,
  chunkDocument,
  type ChunkableDocument,
} from "@/lib/ingest/chunk";

const doc = (body: string, banks: string[] = []): ChunkableDocument => ({
  title: "Teszt dokumentum",
  products: ["szemelyi_kolcson"],
  banks,
  body,
});

const sentence = (n: number) =>
  `Ez a ${n}. bekezdés, amely a személyi kölcsön feltételeiről szól, és elég hosszú ahhoz, hogy számítson.`;

const paragraph = (n: number, sentences: number) =>
  Array.from({ length: sentences }, (_, i) => sentence(n * 100 + i)).join(" ");

describe("chunkDocument", () => {
  it("splits at ## and ### headings and builds the section path and context header", () => {
    const body = [
      paragraph(1, 2),
      "## Feltételek",
      paragraph(2, 2),
      "### Futamidő",
      "A személyi kölcsön futamideje legfeljebb 10 év. " + paragraph(3, 2),
    ].join("\n\n");

    const chunks = chunkDocument(doc(body, ["MBH Bank"]));

    expect(chunks.map((c) => c.sectionPath)).toEqual([
      "Bevezető",
      "Feltételek",
      "Feltételek > Futamidő",
    ]);
    expect(chunks.map((c) => c.ordinal)).toEqual([0, 1, 2]);
    expect(chunks[2].contextHeader).toBe(
      "Teszt dokumentum | Termék: szemelyi_kolcson | Bank: MBH Bank | Feltételek > Futamidő",
    );
    expect(chunks[2].content).not.toContain("###");
  });

  it("splits a long section at paragraph boundaries and overlaps the previous short paragraph", () => {
    const paragraphs = Array.from({ length: 12 }, (_, i) =>
      paragraph(i + 1, 3),
    );
    const body = ["## Hosszú szakasz", ...paragraphs].join("\n\n");

    const chunks = chunkDocument(doc(body));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length <= MAX_CHUNK_CHARS)).toBe(true);
    for (let i = 1; i < chunks.length; i++) {
      const previousParagraphs = chunks[i - 1].content.split("\n\n");
      expect(chunks[i].content.startsWith(previousParagraphs.at(-1)!)).toBe(
        true,
      );
    }
    expect(chunks.every((c) => c.sectionPath === "Hosszú szakasz")).toBe(true);
  });

  it("never splits a table, even when the table alone exceeds the limit", () => {
    const rows = Array.from(
      { length: 90 },
      (_, i) => `| Bank ${i} | ${10 + (i % 5)} év | ${(i + 1) * 100} ezer Ft |`,
    );
    const table = [
      "| Bank | Futamidő | Minimum |",
      "| --- | --- | --- |",
      ...rows,
    ].join("\n");
    const body = ["## Kondíciók", paragraph(1, 2), table, paragraph(2, 2)].join(
      "\n\n",
    );

    const chunks = chunkDocument(doc(body));

    const withTable = chunks.filter((c) => c.content.includes("| Bank |"));
    expect(withTable).toHaveLength(1);
    expect(withTable[0].content).toContain(table);
    expect(table.length).toBeGreaterThan(MAX_CHUNK_CHARS);
  });

  it("merges a section shorter than the minimum into the next one", () => {
    const body = [
      "## Feltételek",
      "Röviden.",
      "### Életkor",
      paragraph(1, 2),
      "## Díjak",
      paragraph(2, 2),
    ].join("\n\n");

    const chunks = chunkDocument(doc(body));

    expect(chunks.map((c) => c.sectionPath)).toEqual([
      "Feltételek > Életkor",
      "Díjak",
    ]);
    expect(chunks[0].content.startsWith("Röviden.")).toBe(true);
    expect(chunks.every((c) => c.content.length >= MIN_SECTION_CHARS)).toBe(
      true,
    );
  });

  it("chunks every knowledge base document within the limits", () => {
    const dir = path.resolve(import.meta.dirname, "../data/docs");
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));

    const results = files.map((file) => {
      const { data, content } = matter(
        readFileSync(path.join(dir, file), "utf8"),
      );
      return {
        file,
        chunks: chunkDocument({
          title: data.title,
          products: data.products,
          banks: data.banks,
          body: content,
        }),
      };
    });

    expect(files.length).toBeGreaterThanOrEqual(12);
    for (const { chunks } of results) {
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
      for (const chunk of chunks) {
        expect(chunk.sectionPath).not.toBe("");
        expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
        const tableRows = chunk.content
          .split("\n")
          .filter((l) => l.startsWith("|"));
        if (tableRows.length > 0) expect(tableRows[1]).toMatch(/^\|\s*-/);
      }
    }
  });
});
