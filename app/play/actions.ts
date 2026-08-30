"use server";

import type { AiFailCode } from "@/lib/ai-fail";
import {
  aiMood,
  aiPick,
  aiSessionNote,
  type AiCandidate,
  type AiLocale,
} from "@/lib/ai";

export type AiPickResult =
  | { ok: true; appid: number; reason: string; cached: boolean }
  /** Never surfaced as an error — the caller keeps the local engine's pick. */
  | { ok: false; reason: string; code: AiFailCode };

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
  if (!res.ok) return { ok: false, reason: res.reason, code: res.code };

  // Trust the shortlist, not the model, for which game this is.
  const known = req.candidates.some((c) => c.appid === res.value.appid);
  if (!known) return { ok: false, reason: "model picked outside the shortlist", code: "unusable" };

  return { ok: true, appid: res.value.appid, reason: res.value.reason, cached: res.cached };
}

export type MoodReadResult =
  | { ok: true; tags: string[]; avoid: string[]; say: string; cached: boolean }
  /** Never surfaced as an error — the engine reads the words itself instead. */
  | { ok: false; reason: string; code: AiFailCode };

/**
 * Reads a mood the player typed, against the vocabulary their own shelf is
 * written in.
 *
 * Same contract as the shelf search: the library stays in the browser, only its
 * tag words are sent, and what comes back is tags rather than titles. The
 * engine still does the scoring, so a draw explained by this reading prints the
 * same real arithmetic as one explained by a preset.
 */
export async function readTypedMood(req: {
  deviceId: string;
  mood: string;
  vocabulary: string[];
  locale: AiLocale;
}): Promise<MoodReadResult> {
  const res = await aiMood(req);
  if (!res.ok) return { ok: false, reason: res.reason, code: res.code };

  // Trust the shelf, not the model, for what a tag is — and for how it is
  // spelt. The model answers "story rich" as readily as "Story Rich"; matching
  // is case-insensitive downstream, but the shelf's own spelling is what ends
  // up on screen and in a history entry.
  const canonical = new Map(req.vocabulary.map((t) => [t.toLowerCase(), t]));
  const clean = (list: string[]) =>
    list
      .map((t) => canonical.get(t.trim().toLowerCase()))
      .filter((t): t is string => Boolean(t));

  const tags = clean(res.value.tags ?? []).slice(0, 4);
  // A tag on both lists is a contradiction the prompt forbids; if it happens
  // anyway, what they asked for wins over what it guessed they meant.
  const picked = new Set(tags.map((t) => t.toLowerCase()));
  const proposed = clean(res.value.avoid ?? []).filter(
    (t) => !picked.has(t.toLowerCase())
  );

  /*
   * A long `avoid` is not a strong opinion, it is the shelf's own vocabulary
   * handed back.
   *
   * Asked for "un truc pour décompresser", the model returned four sensible
   * tags and then copied all 38 tags of the shelf into `avoid` — including the
   * four it had just chosen. Applied, that penalises every game the player owns
   * and turns the mood into noise. The prompt forbids it and the prompt is not
   * enough, so the shape of the answer is checked here: a refusal names a few
   * things, and anything past a handful is an echo, not a refusal.
   */
  const avoid = proposed.length > 5 ? [] : proposed.slice(0, 3);

  if (!tags.length && !avoid.length) return { ok: false, reason: "nothing usable", code: "unusable" };

  return { ok: true, tags, avoid, say: res.value.say?.trim() ?? "", cached: res.cached };
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
