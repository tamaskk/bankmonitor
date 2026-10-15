import "server-only";

import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  MONGODB_URI: z
    .string()
    .regex(
      /^mongodb(\+srv)?:\/\//,
      "must be a mongodb:// or mongodb+srv:// URI",
    ),
  MONGODB_DB: z.string().min(1).default("kb_assistant"),
  GENERATION_MODEL: z.string().min(1).default("gpt-5.5"),
  HELPER_MODEL: z.string().min(1).default("gpt-5.4-mini"),
  EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  RERANK_THRESHOLD: z.coerce.number().min(0).max(10).default(6),
  DEMO_USER: z.string().min(1),
  DEMO_PASSWORD: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment variables: ${problems}`);
  }
  return result.data;
}

export const env = parseEnv();
