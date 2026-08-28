"use server";

import { aiPick, aiSessionNote, type AiCandidate, type AiLocale } from "@/lib/ai";

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
  locale: AiLocale;
}): Promise<AiPickResult> {
  const res = await aiPick(req);
  if (!res.ok) return { ok: false, reason: res.reason };

  // Trust the shortlist, not the model, for which game this is.
  const known = req.candidates.some((c) => c.appid === res.value.appid);
  if (!known) return { ok: false, reason: "model picked outside the shortlist" };

  return { ok: true, appid: res.value.appid, reason: res.value.reason, cached: res.cached };
}

/**
 * Condenses what the player typed after a session into the "Last time" line.
 *
 * Always succeeds: if the model is unavailable or the note is too short to be
 * worth a call, their own words are handed straight back. The raw text is kept
 * either way — this only ever adds a tidied version alongside it.
 */
export async function summariseNote(req: {
  deviceId: string;
  game: string;
  raw: string;
  locale: AiLocale;
}): Promise<{ lastTime: string; whatsNext?: string; summarised: boolean }> {
  const raw = req.raw.trim();
  const res = await aiSessionNote(req);
  if (!res.ok) return { lastTime: raw, summarised: false };

  return {
    lastTime: res.value.lastTime?.trim() || raw,
    whatsNext: res.value.whatsNext?.trim() || undefined,
    summarised: true,
  };
}
