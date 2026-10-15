import "server-only";

import { createOpenAI } from "@ai-sdk/openai";

import { env } from "@/lib/env";

// The one OpenAI provider for embeddings, rerank, rewrite and generation,
// bound to the validated key rather than whatever process.env holds.
export const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
