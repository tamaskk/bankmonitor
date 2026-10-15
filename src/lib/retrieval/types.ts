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
