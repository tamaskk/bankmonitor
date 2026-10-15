// T-008: Reciprocal Rank Fusion. Pure module: no env, no database
// (ARCHITECTURE.md §05). The vector and full-text scores live on different
// scales, so only the ranks are merged.
import type { Candidate } from "@/lib/retrieval/types";

export const RRF_K = 60;

/**
 * Merges ranked lists: each chunk scores Σ 1 / (k + rank) over the lists it
 * appears in (rank starts at 1). Deduplicates by `id`, within and across
 * lists; ties keep the order of
 * first occurrence (list by list, rank by rank).
 */
export function rrf(lists: Candidate[][], k = RRF_K, limit = 20): Candidate[] {
  const merged = new Map<string, { candidate: Candidate; score: number }>();
  for (const list of lists) {
    // A repeated id inside one list scores once, at its best rank.
    const seenInList = new Set<string>();
    list.forEach((candidate, index) => {
      if (seenInList.has(candidate.id)) return;
      seenInList.add(candidate.id);
      const score = 1 / (k + index + 1);
      const entry = merged.get(candidate.id);
      if (entry) entry.score += score;
      else merged.set(candidate.id, { candidate, score });
    });
  }

  // Array.prototype.sort is stable, so equal scores keep insertion order.
  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
