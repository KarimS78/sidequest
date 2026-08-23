"use server";

import {
  fetchTagsForBatch,
  importSteamLibrary,
  searchStore,
  type SteamImportResult,
  type StoreHit,
} from "@/lib/steam";

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

// Free-text manual search ("I also play X on Epic/console").
export async function searchGamesToAdd(
  term: string
): Promise<{ games: StoreHit[] }> {
  return { games: await searchStore(term, 6) };
}
