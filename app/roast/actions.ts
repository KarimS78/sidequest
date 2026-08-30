"use server";

import type { AiFailCode } from "@/lib/ai-fail";
import { aiRoast, type AiLocale } from "@/lib/ai";
import type { BacklogStats } from "@/lib/library";
import type { Roast } from "@/lib/roast";

export type AiRoastResult =
  | { ok: true; roast: Roast; cached: boolean }
  /** Never an error the player sees — the caller falls back to the templates. */
  | { ok: false; reason: string; code: AiFailCode };

/** Stats in, three jabs out. The prompt is numbers only — no library, no tags. */
export async function getAiRoast(req: {
  deviceId: string;
  stats: BacklogStats;
  locale: AiLocale;
}): Promise<AiRoastResult> {
  const res = await aiRoast(req);
  if (!res.ok) return { ok: false, reason: res.reason, code: res.code };

  const { verdict, lines, redemption } = res.value;
  if (!verdict || !Array.isArray(lines) || !lines.length) {
    return { ok: false, reason: "incomplete response", code: "unusable" };
  }

  return {
    ok: true,
    cached: res.cached,
    roast: { verdict, lines: lines.slice(0, 3), redemption: redemption || "" },
  };
}
