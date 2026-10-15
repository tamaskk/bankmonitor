import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadDocuments } from "@/lib/ingest/load";

type FrontMatter = {
  title?: string;
  products?: string;
  banks?: string;
  source_url?: string;
  updated_at?: string;
};

function markdownFile(overrides: FrontMatter = {}, body = "Szöveg.\n") {
  const fields: Required<FrontMatter> = {
    title: '"Teszt dokumentum"',
    products: "[lakashitel]",
    banks: "[]",
    source_url: '"https://bankmonitor.hu/mediatar/cikk/teszt/"',
    updated_at: '"2026-01-31"',
    ...overrides,
  };
  const yaml = Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  return `---\n${yaml}\n---\n\n${body}`;
}

describe("loadDocuments", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "load-check-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads every document in data/docs", async () => {
    const docs = await loadDocuments("data/docs");

    expect(docs.length).toBeGreaterThan(0);
    for (const doc of docs) {
      expect(doc.slug).not.toMatch(/\.md$/);
      expect(doc.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(doc.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(doc.body.trim()).not.toBe("");
    }
  });

  it("derives slug, hash and body and ignores non-markdown files", async () => {
    await writeFile(
      path.join(dir, "otp-szamla.md"),
      markdownFile({ banks: '["OTP Bank"]' }, "# Cím\n\nTörzs.\n"),
    );
    await writeFile(path.join(dir, "notes.txt"), "not markdown");

    const docs = await loadDocuments(dir);

    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      slug: "otp-szamla",
      title: "Teszt dokumentum",
      products: ["lakashitel"],
      banks: ["OTP Bank"],
      sourceUrl: "https://bankmonitor.hu/mediatar/cikk/teszt/",
      updatedAt: "2026-01-31",
    });
    expect(docs[0].body).toContain("Törzs.");
    expect(docs[0].body).not.toContain("title:");
  });

  it("accepts an unquoted date that YAML parses as a Date", async () => {
    await writeFile(
      path.join(dir, "datum.md"),
      markdownFile({ updated_at: "2025-03-04" }),
    );

    const docs = await loadDocuments(dir);

    expect(docs[0].updatedAt).toBe("2025-03-04");
  });

  it("names the file and the field for an unknown product code", async () => {
    await writeFile(path.join(dir, "jo.md"), markdownFile());
    await writeFile(
      path.join(dir, "rossz-termek.md"),
      markdownFile({ products: "[hitel]" }),
    );

    const result = loadDocuments(dir);

    await expect(result).rejects.toThrow(/rossz-termek\.md.*products/);
  });

  it("rejects a source URL outside bankmonitor.hu", async () => {
    await writeFile(
      path.join(dir, "kulso.md"),
      markdownFile({ source_url: '"https://example.com/cikk"' }),
    );

    const result = loadDocuments(dir);

    await expect(result).rejects.toThrow(/kulso\.md.*source_url/);
  });

  it("rejects an empty body", async () => {
    await writeFile(path.join(dir, "ures.md"), markdownFile({}, "\n  \n"));

    const result = loadDocuments(dir);

    await expect(result).rejects.toThrow(/ures\.md.*body/);
  });

  it("stops when two bank names differ only in case or spacing", async () => {
    await writeFile(
      path.join(dir, "a.md"),
      markdownFile({ banks: '["OTP Bank"]' }),
    );
    await writeFile(
      path.join(dir, "b.md"),
      markdownFile({ banks: '["OTP bank"]' }),
    );

    const result = loadDocuments(dir);

    await expect(result).rejects.toThrow(/"OTP Bank".*"OTP bank"/);
  });

  it("refuses JavaScript front matter without evaluating it", async () => {
    const marker = "__loadTestEvaluated";
    await writeFile(
      path.join(dir, "js.md"),
      `---js\n{ title: (globalThis.${marker} = true, "x") }\n---\n\nSzöveg.\n`,
    );

    const result = loadDocuments(dir);

    await expect(result).rejects.toThrow(/js\.md.*only YAML/);
    expect(Reflect.get(globalThis, marker)).toBeUndefined();
  });

  it("reports a YAML syntax error with the file name", async () => {
    await writeFile(
      path.join(dir, "yaml.md"),
      "---\ntitle: [nincs lezárva\n---\n\nSzöveg.\n",
    );

    const result = loadDocuments(dir);

    await expect(result).rejects.toThrow(/yaml\.md: front matter/);
  });

  it("reports every missing field for a file without front matter", async () => {
    await writeFile(path.join(dir, "csupasz.md"), "# Csak törzs\n");

    const error = await loadDocuments(dir).catch((e: unknown) => e);

    const message = (error as Error).message;
    for (const field of ["title", "products", "banks", "source_url"]) {
      expect(message).toMatch(new RegExp(`csupasz\\.md: ${field}`));
    }
  });

  it("loads a file with CRLF line endings and a BOM", async () => {
    const crlf = markdownFile().replaceAll("\n", "\r\n");
    await writeFile(path.join(dir, "windows.md"), `﻿${crlf}`);

    const docs = await loadDocuments(dir);

    expect(docs[0]).toMatchObject({
      slug: "windows",
      title: "Teszt dokumentum",
    });
  });

  it("rejects an impossible calendar date", async () => {
    await writeFile(
      path.join(dir, "datum.md"),
      markdownFile({ updated_at: '"2026-02-30"' }),
    );

    const result = loadDocuments(dir);

    await expect(result).rejects.toThrow(/datum\.md: updated_at/);
  });

  it("rejects an unquoted timestamp that could shift the day", async () => {
    await writeFile(
      path.join(dir, "ido.md"),
      markdownFile({ updated_at: "2025-03-04T23:30:00+02:00" }),
    );

    const result = loadDocuments(dir);

    await expect(result).rejects.toThrow(/ido\.md: updated_at/);
  });

  it("trims bank names and rejects a $-prefixed one", async () => {
    await writeFile(
      path.join(dir, "ok.md"),
      markdownFile({ banks: '[" OTP Bank "]' }),
    );
    await writeFile(
      path.join(dir, "dollar.md"),
      markdownFile({ banks: '["$where"]' }),
    );

    const error = await loadDocuments(dir).catch((e: unknown) => e);

    expect((error as Error).message).toMatch(/dollar\.md: banks\.0/);
    await rm(path.join(dir, "dollar.md"));
    const docs = await loadDocuments(dir);
    expect(docs[0].banks).toEqual(["OTP Bank"]);
  });

  it("rejects a bank name that is not a string", async () => {
    await writeFile(path.join(dir, "bank.md"), markdownFile({ banks: "OTP" }));

    const result = loadDocuments(dir);

    await expect(result).rejects.toThrow(/bank\.md: banks/);
  });

  it("rejects a file name that is not kebab-case", async () => {
    await writeFile(path.join(dir, "OTP.Szamla.md"), markdownFile());

    const result = loadDocuments(dir);

    await expect(result).rejects.toThrow(/OTP\.Szamla\.md: slug/);
  });

  it("rejects whitespace or quotes in the source URL", async () => {
    await writeFile(
      path.join(dir, "url.md"),
      markdownFile({ source_url: '"https://bankmonitor.hu/a b"' }),
    );

    const result = loadDocuments(dir);

    await expect(result).rejects.toThrow(/url\.md: source_url/);
  });

  it("reports every invalid file in one error", async () => {
    await writeFile(
      path.join(dir, "elso.md"),
      markdownFile({ products: "[hitel]" }),
    );
    await writeFile(
      path.join(dir, "masodik.md"),
      markdownFile({ title: '""' }),
    );

    const error = await loadDocuments(dir).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toMatch(/elso\.md.*products/);
    expect(message).toMatch(/masodik\.md.*title/);
  });
});
