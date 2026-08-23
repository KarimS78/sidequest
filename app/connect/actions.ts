"use server";

import {
  fetchTagsForBatch,
  importSteamLibrary,
  searchStore,
  type SteamImportResult,
  type StoreHit,
} from "@/lib/steam";
import { suggestGames } from "@/lib/ai";

// Community tags for a chunk of the library. The client walks the library in
// small chunks so it can show progress and no single request runs long — the
// lookup is throttled server-side and takes ~250ms per game.
export async function enrichTags(
  appids: number[]
): Promise<Record<number, string[]>> {
  return fetchTagsForBatch(appids.slice(0, 25));
}

export async function connectSteam(
  _prev: SteamImportResult | null,
  formData: FormData
): Promise<SteamImportResult> {
  const input = String(formData.get("steam") ?? "");
  return importSteamLibrary(input);
}

export type SuggestedGame = StoreHit & { reason: string };

// AI suggests game *names* by taste; we resolve each to a real appid + cover via
// Steam search and drop anything already owned. Returns ready-to-add cards.
export async function suggestGamesToAdd(req: {
  ownedNames: string[];
  ownedAppids: number[];
  favoriteGenres: string[];
}): Promise<{ ok: boolean; games: SuggestedGame[]; error?: string }> {
  const res = await suggestGames({
    ownedNames: req.ownedNames,
    favoriteGenres: req.favoriteGenres,
  });
  if (!res.ok) return { ok: false, games: [], error: res.error };

  const ownedIds = new Set(req.ownedAppids);
  const seen = new Set<number>();

  const resolved = await Promise.all(
    res.suggestions.map(async (s) => {
      const hit = (await searchStore(s.name, 1))[0];
      return hit ? { ...hit, reason: s.reason } : null;
    })
  );

  const games = resolved.filter((g): g is SuggestedGame => {
    if (!g || ownedIds.has(g.appid) || seen.has(g.appid)) return false;
    seen.add(g.appid);
    return true;
  });

  return { ok: true, games };
}

// Free-text manual search ("I also play X on Epic/console").
export async function searchGamesToAdd(
  term: string
): Promise<{ games: StoreHit[] }> {
  return { games: await searchStore(term, 6) };
}
