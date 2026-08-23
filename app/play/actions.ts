"use server";

import { aiPick, type AiCandidate } from "@/lib/ai";

export type AiPickResult =
  | { ok: true; appid: number; reason: string; cached: boolean }
  /** Never surfaced as an error — the caller keeps the local engine's pick. */
  | { ok: false; reason: string };

/**
 * Asks the model to choose among the shortlist the local engine already
 * produced. The client sends nothing but that shortlist, so the prompt cannot
 * grow with the size of the library.
 */
export async function getAiPick(req: {
  deviceId: string;
  candidates: AiCandidate[];
  time: string;
  mood: string;
}): Promise<AiPickResult> {
  const res = await aiPick(req);
  if (!res.ok) return { ok: false, reason: res.reason };

  // Trust the shortlist, not the model, for which game this is.
  const known = req.candidates.some((c) => c.appid === res.value.appid);
  if (!known) return { ok: false, reason: "model picked outside the shortlist" };

  return { ok: true, appid: res.value.appid, reason: res.value.reason, cached: res.cached };
}
