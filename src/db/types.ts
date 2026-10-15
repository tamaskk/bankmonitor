// Collection shapes for the demo (docs/ARCHITECTURE.md §03). No versioning
// fields: versioning is out of scope. Index definitions live here too, so the
// schema and the indexes that depend on it change in one place.

export const COLLECTIONS = {
  documents: "documents",
  chunks: "chunks",
} as const;

export const EMBEDDING_DIMENSIONS = 1536;

// Stored in `banks` for documents not tied to a bank: the $vectorSearch
// pre-filter cannot express "empty array". Front matter keeps `banks: []`;
// the ingest maps it. Never shown in the bank list.
export const GENERAL_BANK = "altalanos";

export type DocumentRecord = {
  _id: string; // slug: file name without .md
  title: string;
  products: string[];
  banks: string[];
  sourceUrl: string;
  updatedAt: string; // YYYY-MM-DD
  contentHash: string;
  createdAt: Date;
};

export type ChunkRecord = {
  _id: string; // `${slug}#${ordinal}`
  documentId: string; // slug
  ordinal: number;
  sectionPath: string;
  contextHeader: string;
  content: string;
  products: string[];
  banks: string[];
  embedding: number[]; // EMBEDDING_DIMENSIONS values
};

export const VECTOR_INDEX = {
  name: "chunks_vector",
  type: "vectorSearch",
  definition: {
    fields: [
      {
        type: "vector",
        path: "embedding",
        numDimensions: EMBEDDING_DIMENSIONS,
        similarity: "cosine",
      },
      { type: "filter", path: "products" },
      { type: "filter", path: "banks" },
    ],
  },
} as const;

export const TEXT_INDEX = {
  name: "chunks_text",
  type: "search",
  definition: {
    mappings: {
      dynamic: false,
      fields: {
        content: { type: "string", analyzer: "lucene.hungarian" },
        contextHeader: { type: "string", analyzer: "lucene.hungarian" },
        products: { type: "token" },
        banks: { type: "token" },
      },
    },
  },
} as const;
