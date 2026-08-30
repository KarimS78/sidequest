"use server";

import type { AiFailCode } from "@/lib/ai-fail";
import { aiPortrait, aiStatus, budgetSnapshot, type AiLocale, type AiPortrait } from "@/lib/ai";
import { PRICE_PER_MTOK } from "@/lib/ai-guard";

export type AiStatus = {
  on: boolean;
  why: string;
  calls: number;
  callsLimit: number;
  tokens: number;
  tokensLimit: number;
  /** Split in/out, because they are billed an order of magnitude apart. */
  inputTokens: number;
  outputTokens: number;
  /** Dollars spent today, from the counts the provider reported. */
  spentUsd: number;
  /** Dollars a full day would cost — what the ceiling above is actually worth. */
  ceilingUsd: number;
  /** The price list the two numbers above are computed from. */
  price: { input: number; output: number };
};

/**
 * What the AI layer has spent today, for the readout on the profile.
 *
 * The numbers are the real ones out of lib/ai-guard.ts — the same counters the
 * quota check reads, not an estimate. Nothing here identifies a device or
 * exposes the key: it is the machine reporting its own consumption, which is
 * the whole point of a service panel.
 *
 * It reports in dollars as well as tokens now. A token budget is a number only
 * the person who wrote the guard can price; "$0.004 spent today, $0.05 if it
 * runs flat out" is the same fact in the unit that decides whether this feature
 * stays switched on.
 *
 * Caveat worth knowing when you read it: those counters live in module memory,
 * so on a serverless host each instance keeps its own tally and a deploy zeroes
 * them. It is a brake, not an accounting ledger (see "Dette connue").
 */
export async function getAiStatus(): Promise<AiStatus> {
  const status = aiStatus();
  const budget = budgetSnapshot();

  return {
    on: status.on,
    why: status.why,
    calls: budget.calls,
    callsLimit: budget.callsLimit,
    tokens: budget.tokens,
    tokensLimit: budget.tokensLimit,
    inputTokens: budget.inputTokens,
    outputTokens: budget.outputTokens,
    spentUsd: budget.spentUsd,
    ceilingUsd: budget.ceilingUsd,
    price: { input: PRICE_PER_MTOK.input, output: PRICE_PER_MTOK.output },
  };
}

export type PortraitResult =
  | { ok: true; portrait: AiPortrait; cached: boolean }
  /** Never an error the player sees — the panel simply doesn't appear. */
  | { ok: false; reason: string; code: AiFailCode };

/**
 * The shelf read as a person, from counts only.
 *
 * The roast next to it mocks the habit; this takes the same numbers seriously,
 * which is the reason both can exist on one screen without being the same
 * feature twice.
 */
export async function getAiPortrait(req: {
  deviceId: string;
  stats: {
    total: number;
    played: number;
    neverPlayed: number;
    barelyPlayed: number;
    totalHours: number;
    topGame?: { name: string; hours: number };
  };
  tags: { tag: string; count: number }[];
  stated: string[];
  locale: AiLocale;
}): Promise<PortraitResult> {
  const res = await aiPortrait(req);
  if (!res.ok) return { ok: false, reason: res.reason, code: res.code };

  const { archetype, reading, blindSpot } = res.value;
  if (!archetype?.trim() || !reading?.trim()) {
    return { ok: false, reason: "incomplete response", code: "unusable" };
  }

  return {
    ok: true,
    cached: res.cached,
    portrait: {
      archetype: archetype.trim(),
      reading: reading.trim(),
      blindSpot: blindSpot?.trim() ?? "",
    },
  };
}
