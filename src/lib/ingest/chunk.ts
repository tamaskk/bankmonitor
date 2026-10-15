// T-005: section-based chunking with a context header. Pure module: no env,
// no database, so the unit tests run without .env.local (ARCHITECTURE.md §05).

export const MAX_CHUNK_CHARS = 2400; // ~800 tokens of Hungarian text
export const MAX_OVERLAP_CHARS = 400;
export const MIN_SECTION_CHARS = 150;
export const INTRO_SECTION = "Bevezető";

// Structural subset of the loader's LoadedDocument (T-004), so this module
// does not depend on the loader.
export type ChunkableDocument = {
  title: string;
  products: readonly string[];
  banks: readonly string[];
  body: string;
};

export type ChunkDraft = {
  ordinal: number;
  sectionPath: string;
  contextHeader: string;
  content: string;
};

type Section = { path: string; blocks: string[] };

export function chunkDocument(doc: ChunkableDocument): ChunkDraft[] {
  const sections = mergeShortSections(splitSections(doc.body));
  const pieces = sections.flatMap((section) =>
    splitSection(section.blocks).map((content) => ({
      sectionPath: section.path,
      content,
    })),
  );
  return pieces.map((piece, ordinal) => ({
    ordinal,
    sectionPath: piece.sectionPath,
    contextHeader: buildContextHeader(doc, piece.sectionPath),
    content: piece.content,
  }));
}

export function buildContextHeader(
  doc: ChunkableDocument,
  sectionPath: string,
): string {
  const banks = doc.banks.length > 0 ? doc.banks.join(", ") : "általános";
  return `${doc.title} | Termék: ${doc.products.join(", ")} | Bank: ${banks} | ${sectionPath}`;
}

// Splits the body at `##` and `###` headings. Heading lines become the
// section path ("H2 > H3"); text before the first heading is the intro.
function splitSections(body: string): Section[] {
  const sections: { path: string; lines: string[] }[] = [];
  let h2: string | null = null;
  let current = { path: INTRO_SECTION, lines: [] as string[] };

  for (const line of body.split(/\r?\n/)) {
    const heading = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!heading) {
      current.lines.push(line);
      continue;
    }
    sections.push(current);
    const title = heading[2];
    if (heading[1] === "##") {
      h2 = title;
      current = { path: title, lines: [] };
    } else {
      current = { path: h2 ? `${h2} > ${title}` : title, lines: [] };
    }
  }
  sections.push(current);

  return sections
    .map((section) => ({ path: section.path, blocks: toBlocks(section.lines) }))
    .filter((section) => section.blocks.length > 0);
}

// Blocks are paragraphs separated by blank lines; consecutive table rows
// (lines starting with "|") always form one block, even without blank lines.
function toBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let buffer: string[] = [];
  let inTable = false;

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) blocks.push(text);
    buffer = [];
  };

  for (const line of lines) {
    const isTableRow = line.trimStart().startsWith("|");
    if (line.trim() === "") {
      flush();
      inTable = false;
      continue;
    }
    if (isTableRow !== inTable) {
      flush();
      inTable = isTableRow;
    }
    buffer.push(line);
  }
  flush();
  return blocks;
}

const sectionLength = (section: Section) => section.blocks.join("\n\n").length;

// A section shorter than MIN_SECTION_CHARS merges into the next one (the last
// one into the previous). The merged chunk keeps the more specific path when
// the next section is a subsection of the short one.
function mergeShortSections(sections: Section[]): Section[] {
  const result: Section[] = [];
  let pending: Section | null = null;

  for (const section of sections) {
    const merged: Section = pending
      ? {
          path: section.path.startsWith(`${pending.path} > `)
            ? section.path
            : pending.path,
          blocks: [...pending.blocks, ...section.blocks],
        }
      : section;
    pending = null;
    if (sectionLength(merged) < MIN_SECTION_CHARS) {
      pending = merged;
    } else {
      result.push(merged);
    }
  }

  if (pending) {
    const last = result.pop();
    result.push(
      last
        ? { path: last.path, blocks: [...last.blocks, ...pending.blocks] }
        : pending,
    );
  }
  return result;
}

// Packs blocks into pieces of at most MAX_CHUNK_CHARS. A new piece starts with
// the previous piece's last block as overlap when it is short enough and fits.
// A single block longer than the limit (e.g. a big table) stays whole.
function splitSection(blocks: string[]): string[] {
  const pieces: string[][] = [];
  let current: string[] = [];
  let hasNewBlock = false;

  const length = (items: string[]) => items.join("\n\n").length;

  for (const block of blocks) {
    if (current.length > 0 && length([...current, block]) > MAX_CHUNK_CHARS) {
      pieces.push(current);
      const overlap = current[current.length - 1];
      current =
        overlap.length <= MAX_OVERLAP_CHARS &&
        length([overlap, block]) <= MAX_CHUNK_CHARS
          ? [overlap]
          : [];
      hasNewBlock = false;
    }
    current.push(block);
    hasNewBlock = true;
  }
  if (hasNewBlock) pieces.push(current);

  return pieces.map((piece) => piece.join("\n\n"));
}
