import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { z } from "zod";

export const PRODUCTS = [
  "lakashitel",
  "szemelyi_kolcson",
  "bankszamla",
  "altalanos",
] as const;

export type Product = (typeof PRODUCTS)[number];

// YAML turns an unquoted 2026-01-31 into a Date at UTC midnight (and silently
// rolls an impossible 2026-02-30 over to March); a Date with a time part would
// shift the day when converted to UTC. Accept only a real calendar date as a
// string, or a Date that is exactly a calendar day.
const MS_PER_DAY = 86_400_000;
const dateString = z.union([
  z.iso.date(),
  z
    .date()
    .refine((date) => date.getTime() % MS_PER_DAY === 0, "expected YYYY-MM-DD")
    .transform((date) => date.toISOString().slice(0, 10)),
]);

// Kebab-case only: the slug becomes the document `_id` and a source id in
// prompts, where dots, `$` or spaces would cause path or operator problems.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const frontMatterSchema = z.object({
  title: z.string().trim().min(1).max(200),
  products: z.array(z.enum(PRODUCTS)).min(1),
  // Bank names end up in MongoDB filters and the bank list: no `$` prefix or
  // control characters, and the same 100-character cap as the request side.
  banks: z.array(
    z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[^$\p{Cc}]+$/u, "no $ or control characters"),
  ),
  // The URL parser tolerates whitespace and quotes that would break links,
  // logs and prompt text, so reject them and store the normalised href.
  source_url: z
    .url({ protocol: /^https$/, hostname: /^bankmonitor\.hu$/ })
    .startsWith("https://bankmonitor.hu/")
    .refine((url) => !/[\s"<>]/.test(url), "no whitespace, quotes or <>")
    .transform((url) => new URL(url).href),
  updated_at: dateString,
});

export type LoadedDocument = {
  slug: string;
  title: string;
  products: Product[];
  banks: string[];
  sourceUrl: string;
  updatedAt: string;
  contentHash: string;
  body: string;
};

/**
 * Reads and validates every markdown file in `dir`. All-or-nothing: if any
 * file is invalid, throws one error listing every problem with file and
 * field, so the ingest never writes a partial knowledge base.
 */
export async function loadDocuments(
  dir = "data/docs",
): Promise<LoadedDocument[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

  const problems: string[] = [];
  const documents: LoadedDocument[] = [];

  for (const fileName of fileNames) {
    const raw = await readFile(path.join(dir, fileName), "utf8");
    const result = parseDocument(fileName, raw);
    if (result.ok) documents.push(result.document);
    else problems.push(...result.problems);
  }

  problems.push(...findDuplicateSlugs(documents));
  problems.push(...findConflictingBankNames(documents));

  if (problems.length > 0) {
    throw new Error(
      `Invalid knowledge base documents in ${dir}:\n- ${problems.join("\n- ")}`,
    );
  }
  return documents;
}

type ParseResult =
  { ok: true; document: LoadedDocument } | { ok: false; problems: string[] };

function parseDocument(fileName: string, raw: string): ParseResult {
  let parsed: matter.GrayMatterFile<string>;
  try {
    // gray-matter evals `---js` front matter by default, which would run any
    // document's code on the ingest machine with secrets loaded. Passing
    // options also skips its module-level cache, which would otherwise hand
    // back a shared `data` object for identical inputs.
    parsed = matter(raw, { engines: { javascript: rejectNonYaml } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, problems: [`${fileName}: front matter: ${reason}`] };
  }

  const problems: string[] = [];
  const slug = fileName.slice(0, -".md".length);
  if (!SLUG_PATTERN.test(slug)) {
    problems.push(`${fileName}: slug: file name must be lowercase kebab-case`);
  }
  const frontMatter = frontMatterSchema.safeParse(parsed.data);
  if (!frontMatter.success) {
    for (const issue of frontMatter.error.issues) {
      const field = issue.path.join(".") || "front matter";
      problems.push(`${fileName}: ${field}: ${issue.message}`);
    }
  }
  if (parsed.content.trim() === "") {
    problems.push(`${fileName}: body: empty after the front matter`);
  }
  // `!frontMatter.success` is implied by the problem count; it is repeated so
  // TypeScript narrows `frontMatter.data` below.
  if (!frontMatter.success || problems.length > 0)
    return { ok: false, problems };

  const data = frontMatter.data;
  return {
    ok: true,
    document: {
      slug,
      title: data.title,
      products: data.products,
      banks: data.banks,
      sourceUrl: data.source_url,
      updatedAt: data.updated_at,
      contentHash: createHash("sha256").update(raw).digest("hex"),
      body: parsed.content,
    },
  };
}

function rejectNonYaml(): never {
  throw new Error("only YAML front matter is allowed");
}

// File names in one directory are unique on case-sensitive filesystems; this
// guards case-insensitive ones and the spec's uniqueness guarantee.
function findDuplicateSlugs(documents: LoadedDocument[]): string[] {
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const { slug } of documents) {
    if (seen.has(slug)) problems.push(`${slug}.md: slug: duplicate "${slug}"`);
    seen.add(slug);
  }
  return problems;
}

// "OTP Bank" and "OTP bank" would become two banks in the filter, so any
// spellings that differ only in case or whitespace stop the load.
function findConflictingBankNames(documents: LoadedDocument[]): string[] {
  const spellings = new Map<string, Map<string, string[]>>();
  for (const { slug, banks } of documents) {
    for (const bank of banks) {
      const key = bank.toLowerCase().replace(/\s+/g, "");
      const variants = spellings.get(key) ?? new Map<string, string[]>();
      variants.set(bank, [...(variants.get(bank) ?? []), `${slug}.md`]);
      spellings.set(key, variants);
    }
  }

  const problems: string[] = [];
  for (const variants of spellings.values()) {
    if (variants.size < 2) continue;
    const listed = [...variants]
      .map(([name, files]) => `"${name}" (${files.join(", ")})`)
      .join(" vs ");
    problems.push(`banks: conflicting spellings ${listed}`);
  }
  return problems;
}
