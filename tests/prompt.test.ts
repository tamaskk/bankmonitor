import { describe, expect, it } from "vitest";

import { buildRetryPrompt, buildUserPrompt } from "@/lib/generation/prompt";
import type { RankedCandidate } from "@/lib/retrieval/types";

const source = (n: number, banks: string[]): RankedCandidate => ({
  id: `doc-${n}#0`,
  slug: `doc-${n}`,
  title: `Dokumentum "${n}"`,
  sectionPath: `Szakasz ${n}`,
  contextHeader: "",
  content: `A(z) ${n}. forrás szövege.`,
  products: ["szemelyi_kolcson"],
  banks,
  sourceUrl: `https://bankmonitor.hu/${n}`,
  updatedAt: "2026-01-15",
  score: 10 - n,
});

describe("buildUserPrompt", () => {
  it("numbers the sources from 1 in rerank order with title, section, bank and date", () => {
    const sources = [
      source(1, ["altalanos"]),
      source(2, ["MBH Bank"]),
      source(3, ["OTP Bank", "altalanos"]),
    ];

    const prompt = buildUserPrompt("Mennyi a futamidő?", sources);

    const ids = [...prompt.matchAll(/<forrás id="(\d+)"/g)].map((m) =>
      Number(m[1]),
    );
    expect(ids).toEqual([1, 2, 3]);
    expect(prompt).toContain(
      `<forrás id="1" cím="Dokumentum '1'" szakasz="Szakasz 1" bank="általános" frissítve="2026-01-15">\nA(z) 1. forrás szövege.\n</forrás>`,
    );
    expect(prompt).toContain('bank="MBH Bank"');
    expect(prompt).toContain('bank="OTP Bank"');
    expect(prompt.startsWith("<források>\n")).toBe(true);
    expect(prompt.endsWith("</források>\n\nKérdés: Mennyi a futamidő?")).toBe(
      true,
    );
  });

  it("appends the validation errors to the retry prompt", () => {
    const sources = [source(1, ["altalanos"])];

    const prompt = buildRetryPrompt("Mennyi a futamidő?", sources, [
      "marker [2] has no citation",
    ]);

    expect(prompt).toContain(
      "Az előző válaszod nem felelt meg a szabályoknak:\n- marker [2] has no citation",
    );
    expect(prompt).toContain(
      "Javítsd, és csak a forrásokból szó szerint idézz.",
    );
  });
});
