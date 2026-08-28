"use server";

import { aiSearch, type AiFilter } from "@/lib/ai";

export type ShelfSearchResult =
  | { ok: true; filter: AiFilter; cached: boolean }
  /** Never surfaced as an error — the shelf keeps its plain name search. */
  | { ok: false; reason: string };

/**
 * Reads a sentence and hands back a filter, not a list of games.
 *
 * The library never leaves the browser: the client sends the question and the
 * tag vocabulary its own shelf is written in, and applies the returned filter
 * itself. So the prompt does not grow with the size of the library, and the
 * model cannot name a game the player does not own.
 */
export async function searchShelf(req: {
  deviceId: string;
  query: string;
  vocabulary: string[];
}): Promise<ShelfSearchResult> {
  const res = await aiSearch(req);
  if (!res.ok) return { ok: false, reason: res.reason };

  // Trust the shelf, not the model, for what a tag is: anything it invented is
  // dropped rather than matched against nothing.
  const known = new Set(req.vocabulary.map((t) => t.toLowerCase()));
  const tags = res.value.tags.filter((t) => known.has(t.trim().toLowerCase())).slice(0, 5);

  return {
    ok: true,
    cached: res.cached,
    filter: {
      ...res.value,
      tags,
      maxHours: Math.max(0, Math.min(500, Math.round(res.value.maxHours || 0))),
    },
  };
}
