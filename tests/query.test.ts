import { describe, expect, it } from "vitest";

import {
  buildFilter,
  extractWordTokens,
  MAX_QUERY_TOKENS,
} from "@/lib/retrieval/query";

describe("buildFilter", () => {
  it("adds no condition for all products and no bank", () => {
    const filters = { product: "osszes", bank: null };

    const result = buildFilter(filters);

    expect(result).toEqual({});
  });

  it("keeps general documents next to the chosen product and bank", () => {
    const filters = { product: "szemelyi_kolcson", bank: " OTP Bank " };

    const result = buildFilter(filters);

    expect(result).toEqual({
      products: ["szemelyi_kolcson", "altalanos"],
      banks: ["OTP Bank", "altalanos"],
    });
  });

  it("rejects an operator object passed as the product", () => {
    const filters = { product: { $ne: "x" }, bank: null };

    const act = () => buildFilter(filters);

    expect(act).toThrow();
  });

  it("rejects a bank that starts with $ after trimming", () => {
    const filters = { product: "osszes", bank: " $where" };

    const act = () => buildFilter(filters);

    expect(act).toThrow();
  });

  it("rejects a bank that is not a string", () => {
    const filters = { product: "osszes", bank: ["OTP Bank"] };

    const act = () => buildFilter(filters);

    expect(act).toThrow();
  });
});

describe("extractWordTokens", () => {
  it("keeps only words of at least two characters, without punctuation", () => {
    const question = 'Mi a THM? $where: "x" -- 5 év*';

    const result = extractWordTokens(question);

    expect(result).toBe("Mi THM where év");
  });

  it("keeps accented words whole when the input is decomposed (NFD)", () => {
    const question = "személyi kölcsön futamideje".normalize("NFD");

    const result = extractWordTokens(question);

    expect(result).toBe("személyi kölcsön futamideje");
  });

  it("drops duplicates and caps the token count", () => {
    const words = Array.from({ length: 200 }, (_, i) => `szo${i}`);
    const question = ["THM", "THM", ...words].join(" ");

    const result = extractWordTokens(question).split(" ");

    expect(result).toHaveLength(MAX_QUERY_TOKENS);
    expect(result.filter((token) => token === "THM")).toHaveLength(1);
  });

  it("drops tokens longer than any real word", () => {
    const question = `THM ${"a".repeat(60)}`;

    const result = extractWordTokens(question);

    expect(result).toBe("THM");
  });

  it("returns an empty string when no word remains", () => {
    const result = extractWordTokens("? ! a 1");

    expect(result).toBe("");
  });
});
