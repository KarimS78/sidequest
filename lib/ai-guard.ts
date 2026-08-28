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

/**
 * Every place the app is allowed to spend.
 *
 *   pick     — choose one game out of the engine's shortlist, and say why
 *   roast    — three jabs about the backlog, from the numbers only
 *   note     — tidy what the player typed after a session
 *   search   — turn "something short I don't have to think about" into a filter
 *   portrait — what the shelf says about the player
 *   resume   — where they left off, read back out of their own old notes
 */
export type CallKind = "pick" | "roast" | "note" | "search" | "portrait" | "resume";

/**
 * What gpt-5-nano costs, per 1M tokens. The only two numbers in this app that
 * are money — kept next to the counters that use them, so a price change is one
 * edit and the gauge on the profile stops lying the same minute.
 */
export const PRICE_PER_MTOK = { input: 0.05, output: 0.4 } as const;

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
  /** A shelf search the player typed. */
  maxQueryChars: 120,
  /**
   * Tags offered to a search call. The model never sees the library: it sees
   * the vocabulary the library is written in and answers with a filter, so the
   * prompt is the same size for a 10-game demo and a 900-game account.
   */
  maxTagsInPrompt: 40,
  /** Past notes handed to a resume call. Older than that is not "where you left off". */
  maxNotesInPrompt: 3,

  /**
   * Output ceiling per call kind, enforced by the provider.
   *
   * On a reasoning model this budget covers the thinking tokens too, not just
   * the visible answer: too tight and the call comes back `incomplete` with no
   * text at all. Sized with that headroom — the answers stay short because the
   * prompts ask for short answers, and tokens never generated cost nothing.
   */
  maxOutputTokens: {
    pick: 400,
    roast: 600,
    note: 300,
    search: 350,
    portrait: 700,
    resume: 350,
  } as Record<CallKind, number>,

  /**
   * Calls per device per day. Roughly "how often is this worth asking": a
   * search gets typed all evening, a portrait is worth reading once a week.
   */
  perDevicePerDay: {
    pick: 40,
    roast: 10,
    note: 30,
    search: 30,
    portrait: 6,
    resume: 20,
  } as Record<CallKind, number>,

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
  /** Split, because input and output are billed an order of magnitude apart. */
  inputTokens: number;
  outputTokens: number;
  perDevice: Map<string, Partial<Record<CallKind, number>>>;
};

function emptyStore(day: string): Store {
  return {
    day,
    globalCalls: 0,
    globalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    perDevice: new Map(),
  };
}

let store: Store = emptyStore(today());

function rollover() {
  const d = today();
  if (store.day !== d) store = emptyStore(d);
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

/** What the provider says it billed. Missing fields count as zero, never as a guess. */
export type Usage = { input: number; output: number; total: number };

/** Called after every completed request, with what the provider actually billed. */
export function recordUsage(
  deviceId: string | undefined,
  kind: CallKind,
  usage: Usage
) {
  rollover();
  const id = normDevice(deviceId);
  const row = store.perDevice.get(id) ?? {};
  row[kind] = (row[kind] ?? 0) + 1;
  store.perDevice.set(id, row);
  store.globalCalls += 1;
  store.globalTokens += Math.max(0, usage.total);
  store.inputTokens += Math.max(0, usage.input);
  store.outputTokens += Math.max(0, usage.output);
}

/** Dollars, from token counts the provider reported. */
export function costUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * PRICE_PER_MTOK.input +
    (outputTokens / 1_000_000) * PRICE_PER_MTOK.output
  );
}

/** For the AI supply readout on the profile, and for tests. */
export function budgetSnapshot() {
  rollover();

  // Price the rest of the day at the mix actually observed. Before any call
  // lands there is no mix, so use the shape the prompts are designed for
  // (roughly 3:1 in favour of input) rather than let the ceiling read as $0.16
  // in the morning and $0.04 by the evening.
  const seen = store.inputTokens + store.outputTokens;
  const outShare = seen > 0 ? store.outputTokens / seen : 0.25;

  return {
    day: store.day,
    calls: store.globalCalls,
    callsLimit: LIMITS.globalCallsPerDay,
    tokens: store.globalTokens,
    tokensLimit: LIMITS.globalTokensPerDay,
    inputTokens: store.inputTokens,
    outputTokens: store.outputTokens,
    /** Spent so far today. */
    spentUsd: costUsd(store.inputTokens, store.outputTokens),
    /** What burning the whole daily token budget would cost at that mix. */
    ceilingUsd: costUsd(
      LIMITS.globalTokensPerDay * (1 - outShare),
      LIMITS.globalTokensPerDay * outShare
    ),
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
