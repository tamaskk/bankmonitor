import "server-only";

import { generateText, streamText } from "ai";

import { embedQuery } from "@/lib/embeddings";
import { assistantReply } from "@/lib/generation/assistant-help";
import { classifyIntent } from "@/lib/generation/intent";
import { generationOptions } from "@/lib/generation/model";
import { buildRetryPrompt, buildUserPrompt } from "@/lib/generation/prompt";
import {
  answerSchema,
  NOT_FOUND_MESSAGE,
  type ModelAnswer,
} from "@/lib/generation/schema";
import { validateAnswer } from "@/lib/generation/validate";
import { rerank } from "@/lib/retrieval/rerank";
import { rewriteQuery } from "@/lib/retrieval/rewrite";
import { rrf } from "@/lib/retrieval/rrf";
import { hybridSearch } from "@/lib/retrieval/search";
import type {
  Candidate,
  ChatTurn,
  Filters,
  RankedCandidate,
} from "@/lib/retrieval/types";

export const PIPELINE_ERROR_MESSAGE =
  "Hiba történt a válasz előállítása közben. Próbáld újra.";

export type CitedSource = Pick<
  Candidate,
  | "slug"
  | "title"
  | "sectionPath"
  | "content"
  | "sourceUrl"
  | "products"
  | "banks"
  | "updatedAt"
>;

export type FinalResult = {
  // "info": a fixed reply about the assistant or to small talk, with no sources.
  status: "answered" | "partial" | "not_found" | "info";
  answer: string;
  reason?: "no_relevant_source" | "validation_failed" | "model_not_found";
  citations: { n: number; quote: string; source: CitedSource }[];
  retrieved: { slug: string; score: number }[];
};

export type PipelineEvent =
  | { type: "rewrite"; query: string }
  | { type: "partial"; answer: string }
  | { type: "final"; result: FinalResult }
  | { type: "error"; message: string };

export type PipelineInput = {
  question: string;
  filters: Filters;
  history: ChatTurn[];
};

/**
 * The one query pipeline, shared by /api/chat and the eval script. Yields an
 * optional `rewrite`, `partial` updates while the answer streams (unverified),
 * then exactly one `final` or `error`. Knows nothing about HTTP.
 */
export async function* answerQuestion(
  input: PipelineInput,
  signal?: AbortSignal,
): AsyncGenerator<PipelineEvent> {
  try {
    // 1. Follow-up → standalone question; used for search, rerank and generation.
    const query = await rewriteQuery(input.question, input.history, signal);
    if (query !== input.question) yield { type: "rewrite", query };

    // 2. Retrieval: both searches pre-filtered, merged, reranked with the threshold.
    const embedding = await embedQuery(query);
    const { vector, fullText } = await hybridSearch(
      query,
      embedding,
      input.filters,
      signal,
    );
    const sources = await rerank(query, rrf([vector, fullText]), signal);
    const retrieved = sources.map((s) => ({ slug: s.slug, score: s.score }));

    // 3. Nothing relevant: refuse without calling the generation model.
    if (sources.length === 0) {
      // "Mit tudok tőled kérdezni?", "Szia", "Köszönöm" find no source but
      // deserve a reply. Classified only here, so answerable questions pay
      // no extra latency; the reply is fixed text, never generated.
      const reply = assistantReply(
        await classifyIntent(input.question, signal),
      );
      yield {
        type: "final",
        result: reply
          ? { status: "info", answer: reply, citations: [], retrieved }
          : notFound("no_relevant_source", retrieved),
      };
      return;
    }

    // 4. Stream the first attempt; the text is shown as unverified until `final`.
    const stream = streamText({
      ...generationOptions(),
      prompt: buildUserPrompt(query, sources, input.filters),
      abortSignal: signal,
    });
    let lastPartial: unknown;
    let shownAnswer = "";
    for await (const partial of stream.partialOutputStream) {
      lastPartial = partial;
      const answer = typeof partial?.answer === "string" ? partial.answer : "";
      if (answer && answer !== shownAnswer) {
        shownAnswer = answer;
        yield { type: "partial", answer };
      }
    }

    // 5. Validate; 6. one non-streamed retry with the errors; then refuse.
    let attempt = checkOutput(lastPartial, sources);
    if (!attempt.ok) {
      console.warn(
        "[pipeline] first answer failed validation:",
        attempt.errors,
      );
      const retry = await generateText({
        ...generationOptions(),
        prompt: buildRetryPrompt(query, sources, attempt.errors, input.filters),
        abortSignal: signal,
      }).catch((error: unknown) => ({ output: undefined, error }));
      attempt = checkOutput(retry.output, sources);
      if (!attempt.ok) {
        console.warn("[pipeline] retry failed validation:", attempt.errors);
        yield {
          type: "final",
          result: notFound("validation_failed", retrieved),
        };
        return;
      }
    }

    // 7. Final answer with the cited sources' metadata.
    yield {
      type: "final",
      result: toFinalResult(attempt.output, sources, retrieved),
    };
  } catch (error) {
    if (signal?.aborted) return; // the client left; nobody is listening
    console.error(
      "[pipeline] failed:",
      error instanceof Error ? error.message : error,
    );
    yield { type: "error", message: PIPELINE_ERROR_MESSAGE };
  }
}

type CheckedOutput =
  { ok: true; output: ModelAnswer } | { ok: false; errors: string[] };

function checkOutput(raw: unknown, sources: RankedCandidate[]): CheckedOutput {
  const parsed = answerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: ["the output does not match the JSON schema"] };
  }
  const validation = validateAnswer(parsed.data, sources);
  return validation.ok ? { ok: true, output: parsed.data } : validation;
}

function notFound(
  reason: NonNullable<FinalResult["reason"]>,
  retrieved: FinalResult["retrieved"],
): FinalResult {
  return {
    status: "not_found",
    answer: NOT_FOUND_MESSAGE,
    reason,
    citations: [],
    retrieved,
  };
}

function toFinalResult(
  output: ModelAnswer,
  sources: RankedCandidate[],
  retrieved: FinalResult["retrieved"],
): FinalResult {
  if (output.status === "not_found")
    return notFound("model_not_found", retrieved);
  return {
    status: output.status,
    answer: output.answer,
    citations: output.citations.map((citation) => {
      const s = sources[citation.sourceId - 1];
      return {
        n: citation.sourceId,
        quote: citation.quote,
        source: {
          slug: s.slug,
          title: s.title,
          sectionPath: s.sectionPath,
          content: s.content,
          sourceUrl: s.sourceUrl,
          products: s.products,
          banks: s.banks,
          updatedAt: s.updatedAt,
        },
      };
    }),
    retrieved,
  };
}
