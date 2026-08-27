"use server";

import { aiStatus, budgetSnapshot } from "@/lib/ai";

export type AiStatus = {
  on: boolean;
  why: string;
  calls: number;
  callsLimit: number;
  tokens: number;
  tokensLimit: number;
};

/**
 * What the AI layer has spent today, for the readout on the profile.
 *
 * The numbers are the real ones out of lib/ai-guard.ts — the same counters the
 * quota check reads, not an estimate. Nothing here identifies a device or
 * exposes the key: it is the machine reporting its own consumption, which is
 * the whole point of a service panel.
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
  };
}
