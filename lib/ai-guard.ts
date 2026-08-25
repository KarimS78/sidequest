// Cost control for the AI layer (server-only).
//
// The key is Karim's, so every call has to be bounded before it is made. Four
// independent guards, in the order they fire:
//
//   1. INPUT   — nothing unbounded ever reaches a prompt (candidate count,
//                free-text length, stat lines are all capped here).
//   2. CACHE   — identical inputs never bill twice.
//   3. QUOTA   — per-device and global ceilings, counted in calls AND in the
//                tokens the provider actually reports back.
//   4. OUTPUT  — maxOutputTokens per call kind, enforced provider-side.
//
// When any guard trips the caller falls back to the local engine. A tripped
// guard is never an error the player sees — it degrades, it doesn't fail.
//
// KNOWN LIMIT: the counters live in module memory. On a serverless host each
// instance keeps its own tally and a deploy resets them, so these are a brake,
// not a ledger. Swap `store` for Supabase/Redis when the app gets a database —
// everything else here stays as-is.

export type CallKind = "pick" | "roast" | "note";

/**
 * Every number that costs money, in one place.
 * Tuned for gpt-5-nano ($0.05 / 1M in, $0.40 / 1M out): hitting the global
 * ceiling below every single day costs roughly $0.05 a day.
 */
export const LIMITS = {
  /** Candidates sent to the model. The local engine ranks; the AI only chooses. */
  maxCandidates: 12,
  /** Free-text mood, trimmed hard — it lands verbatim in the prompt. */
  maxMoodChars: 80,
  /** Raw session note the player typed, before summarising. */
  maxNoteChars: 600,

  /**
   * Output ceiling per call kind, enforced by the provider.
   *
   * On a reasoning model this budget covers the thinking tokens too, not just
   * the visible answer: too tight and the call comes back `incomplete` with no
   * text at all. Sized with that headroom — the answers stay short because the
   * prompts ask for short answers, and tokens never generated cost nothing.
   */
  maxOutputTokens: { pick: 400, roast: 600, note: 300 } as Record<CallKind, number>,

  /** Calls per device per day. */
  perDevicePerDay: { pick: 40, roast: 10, note: 30 } as Record<CallKind, number>,

  /** Total tokens (in + out) across every device, per day. The real ceiling. */
  globalTokensPerDay: 400_000,
  /** Total calls across every device, per day. */
  globalCallsPerDay: 600,

  /** Give up on a call rather than let it hang. */
  timeoutMs: 8_000,
  /** Only 5xx is retried, once. 4xx never is — retrying a quota error is free money burnt. */
  retries: 1,

  /** Cache entries kept, and for how long. */
  cacheMax: 300,
  cacheTtlMs: 24 * 60 * 60 * 1000,
} as const;

// ---------------------------------------------------------------- day rollover

function today() {
  return new Date().toISOString().slice(0, 10);
}

type Store = {
  day: string;
  globalCalls: number;
  globalTokens: number;
  perDevice: Map<string, Partial<Record<CallKind, number>>>;
};

let store: Store = { day: today(), globalCalls: 0, globalTokens: 0, perDevice: new Map() };

function rollover() {
  const d = today();
  if (store.day !== d) {
    store = { day: d, globalCalls: 0, globalTokens: 0, perDevice: new Map() };
  }
}

// ---------------------------------------------------------------------- quota

export type Verdict = { ok: true } | { ok: false; reason: string };

/** Cheap sanity check on the id the client sends — never trust it as identity. */
function normDevice(id: string | undefined): string {
  const v = (id ?? "").trim().slice(0, 64);
  return /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : "anonymous";
}

export function checkQuota(deviceId: string | undefined, kind: CallKind): Verdict {
  rollover();

  if (store.globalTokens >= LIMITS.globalTokensPerDay) {
    return { ok: false, reason: "daily token budget spent" };
  }
  if (store.globalCalls >= LIMITS.globalCallsPerDay) {
    return { ok: false, reason: "daily call budget spent" };
  }

  const used = store.perDevice.get(normDevice(deviceId))?.[kind] ?? 0;
  if (used >= LIMITS.perDevicePerDay[kind]) {
    return { ok: false, reason: `daily ${kind} limit reached for this device` };
  }
  return { ok: true };
}

/** Called after every completed request, with what the provider actually billed. */
export function recordUsage(
  deviceId: string | undefined,
  kind: CallKind,
  tokens: number
) {
  rollover();
  const id = normDevice(deviceId);
  const row = store.perDevice.get(id) ?? {};
  row[kind] = (row[kind] ?? 0) + 1;
  store.perDevice.set(id, row);
  store.globalCalls += 1;
  store.globalTokens += Math.max(0, tokens);
}

/** For the /profile debug readout and for tests. */
export function budgetSnapshot() {
  rollover();
  return {
    day: store.day,
    calls: store.globalCalls,
    callsLimit: LIMITS.globalCallsPerDay,
    tokens: store.globalTokens,
    tokensLimit: LIMITS.globalTokensPerDay,
    devices: store.perDevice.size,
  };
}

// ---------------------------------------------------------------------- cache

type Entry = { value: unknown; at: number };
const cache = new Map<string, Entry>();

/** Stable, order-independent hash of whatever identifies a request. */
export function cacheKey(kind: CallKind, parts: unknown): string {
  const json = JSON.stringify(parts);
  let h = 2166136261;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${kind}:${(h >>> 0).toString(36)}:${json.length}`;
}

export function cacheGet<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > LIMITS.cacheTtlMs) {
    cache.delete(key);
    return null;
  }
  // refresh recency (Map preserves insertion order — re-set moves it to the end)
  cache.delete(key);
  cache.set(key, hit);
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown) {
  cache.set(key, { value, at: Date.now() });
  while (cache.size > LIMITS.cacheMax) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// ------------------------------------------------------------------ sanitising

/** Collapse whitespace and cap length — everything user-typed goes through this. */
export function clamp(text: string | undefined, max: number): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
