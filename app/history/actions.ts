"use server";

import { aiResume, type AiLocale } from "@/lib/ai";

export type ResumeResult =
  | { ok: true; where: string; next?: string; cached: boolean }
  /** Never an error the player sees — the raw note is still on the screen. */
  | { ok: false; reason: string };

/**
 * Reads the player's own old notes back to them as one line.
 *
 * This is the product's actual promise ("never forget where you left off") at
 * the moment it matters: weeks later, staring at three lines of your own
 * shorthand. It summarises those lines and nothing else — the prompt carries no
 * library, no stats, and at most three notes.
 */
export async function getResume(req: {
  deviceId: string;
  game: string;
  notes: { ago: string; raw: string }[];
  locale: AiLocale;
}): Promise<ResumeResult> {
  const res = await aiResume(req);
  if (!res.ok) return { ok: false, reason: res.reason };

  const where = res.value.where?.trim();
  if (!where) return { ok: false, reason: "empty response" };

  return { ok: true, where, next: res.value.next?.trim() || undefined, cached: res.cached };
}
