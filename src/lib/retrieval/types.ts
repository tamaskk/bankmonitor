// Shared retrieval types. Client components import these type-only
// (ARCHITECTURE.md §05), so this file holds no runtime code.
import type { Product } from "@/db/types";

export type { Product };

export type Filters = {
  product: Product | "osszes";
  bank: string | null;
};

export type Candidate = {
  id: string; // chunk `_id`: `${slug}#${ordinal}`
  slug: string;
  title: string;
  sectionPath: string;
  contextHeader: string;
  content: string;
  products: string[];
  banks: string[];
  sourceUrl: string;
  updatedAt: string;
};

// A candidate that passed the rerank threshold; `score` is the 0–10 rerank score.
export type RankedCandidate = Candidate & { score: number };

export type ChatTurn = { role: "user" | "assistant"; content: string };
