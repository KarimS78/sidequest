// AI layer (server-only). Google Gemini via REST — no SDK, no extra deps.
//
// The local engine (lib/recommend.ts, lib/roast.ts) is NOT replaced by this: it
// still ranks, and it is the fallback for every call. The AI's job is judgement
// and phrasing on top of a shortlist the engine already produced. That ordering
// is what keeps prompts small and bounded — the model never sees a whole
// library, only the dozen games worth arguing about.
//
// Every call: capped input (lib/ai-guard.ts), cached, quota-checked, capped
// output, 8s timeout. On any failure the caller uses the local result.

import {
  LIMITS,
  cacheGet,
  cacheKey,
  cacheSet,
  checkQuota,
  clamp,
  recordUsage,
  type CallKind,
} from "@/lib/ai-guard";

// flash-lite: the cheapest model that reasons well enough for a 12-item choice,
// and the most generous free-tier quota.
const MODEL = "gemini-2.5-flash-lite";

function apiKey() {
  return process.env.GEMINI_API_KEY?.trim() || null;
}

/** Kill switch — set AI_ENABLED=false to run fully local without pulling the key. */
function enabled() {
  return process.env.AI_ENABLED !== "false" && !!apiKey();
}

type GenResult<T> =
  | { ok: true; value: T; cached: boolean }
  | { ok: false; reason: string };

/**
 * One bounded round-trip. Returns a reason rather than throwing — callers are
 * expected to degrade, not to handle errors.
 */
async function generate<T>(opts: {
  kind: CallKind;
  deviceId?: string;
  prompt: string;
  schema: object;
  temperature: number;
  cacheOn: unknown;
}): Promise<GenResult<T>> {
  const key = apiKey();
  if (!enabled() || !key) return { ok: false, reason: "AI is off" };

  const ck = cacheKey(opts.kind, opts.cacheOn);
  const hit = cacheGet<T>(ck);
  if (hit) return { ok: true, value: hit, cached: true };

  const quota = checkQuota(opts.deviceId, opts.kind);
  if (!quota.ok) return { ok: false, reason: quota.reason };

  const body = {
    contents: [{ parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature,
      maxOutputTokens: LIMITS.maxOutputTokens[opts.kind],
      responseMimeType: "application/json",
      responseSchema: opts.schema,
    },
  };

  for (let attempt = 0; attempt <= LIMITS.retries; attempt++) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), LIMITS.timeoutMs);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify(body),
          signal: abort.signal,
        }
      );

      // 4xx is never retried — a quota or bad-request error costs the same twice.
      if (!res.ok) {
        if (res.status >= 500 && attempt < LIMITS.retries) continue;
        return { ok: false, reason: `provider ${res.status}` };
      }

      const data = await res.json();

      // Bill what the provider says it billed, not what we guessed.
      const usage = data?.usageMetadata;
      recordUsage(opts.deviceId, opts.kind, usage?.totalTokenCount ?? 0);

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { ok: false, reason: "empty response" };

      const value = JSON.parse(text) as T;
      cacheSet(ck, value);
      return { ok: true, value, cached: false };
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      if (!aborted && attempt < LIMITS.retries) continue;
      return { ok: false, reason: aborted ? "timed out" : "network error" };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, reason: "exhausted retries" };
}

// ===================== 1. The pick =====================
//
// The engine hands over its shortlist with the reasons each game scored on. The
// model picks ONE and writes the sentence. It cannot invent a game: the appid
// must come from the list, and the caller snaps it back to the library anyway.

export type AiCandidate = {
  appid: number;
  name: string;
  /** Compact signal line built from the engine's components, e.g. "Story Rich; 9h recently". */
  signals: string;
};

export type AiPick = { appid: number; reason: string };

const PICK_SCHEMA = {
  type: "object",
  properties: {
    appid: { type: "integer" },
    reason: { type: "string" },
  },
  required: ["appid", "reason"],
};

export async function aiPick(input: {
  deviceId?: string;
  candidates: AiCandidate[];
  time: string;
  mood: string;
}): Promise<GenResult<AiPick>> {
  // Hard cap: the prompt size is a function of this number and nothing else.
  const candidates = input.candidates.slice(0, LIMITS.maxCandidates);
  if (!candidates.length) return { ok: false, reason: "no candidates" };

  const mood = clamp(input.mood, LIMITS.maxMoodChars);
  const lines = candidates.map((c) => `${c.appid} | ${c.name} | ${c.signals}`).join("\n");

  const prompt = [
    "Pick the single best game for this player right now, from the shortlist only.",
    "",
    `Time available: ${input.time}`,
    `Mood: ${mood || "unspecified"}`,
    "",
    "Shortlist (appid | name | why it scored):",
    lines,
    "",
    "Return the appid and one sentence, max 25 words, saying why THIS game for THIS",
    "time and mood. Be concrete about the game. No preamble, no hedging.",
  ].join("\n");

  return generate<AiPick>({
    kind: "pick",
    deviceId: input.deviceId,
    prompt,
    schema: PICK_SCHEMA,
    temperature: 0.7,
    // Same shortlist + same ask = same answer, free.
    cacheOn: { c: candidates.map((c) => c.appid), t: input.time, m: mood },
  });
}

// ===================== 2. The roast =====================
//
// Numbers only — no game list, no tags. The whole prompt is ~120 tokens.

export type AiRoast = { verdict: string; lines: string[]; redemption: string };

const ROAST_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string" },
    lines: { type: "array", items: { type: "string" } },
    redemption: { type: "string" },
  },
  required: ["verdict", "lines", "redemption"],
};

export async function aiRoast(input: {
  deviceId?: string;
  stats: {
    total: number;
    played: number;
    neverPlayed: number;
    barelyPlayed: number;
    totalHours: number;
    topGame?: { name: string; hours: number };
    topTag?: { tag: string; count: number };
  };
}): Promise<GenResult<AiRoast>> {
  const s = input.stats;
  const facts = [
    `owned:${s.total}`,
    `played:${s.played}`,
    `never launched:${s.neverPlayed}`,
    `under 2h:${s.barelyPlayed}`,
    `total hours:${s.totalHours}`,
    s.topGame ? `most played:${s.topGame.name} (${s.topGame.hours}h)` : "",
    s.topTag ? `dominant tag:${s.topTag.tag} (${s.topTag.count} games)` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const prompt = [
    "Roast this player's Steam backlog. Mock the habit, never the person — they should laugh.",
    "Use only these numbers. Invent nothing: you do not know prices, ratings or whether anything was finished.",
    "",
    facts,
    "",
    "Return: verdict (one headline), lines (exactly 3 jabs using the real numbers), redemption (one line, slightly hopeful).",
    "PG-13. No slurs. Short sentences.",
  ].join("\n");

  return generate<AiRoast>({
    kind: "roast",
    deviceId: input.deviceId,
    prompt,
    schema: ROAST_SCHEMA,
    // High temperature is the point here, so cache on the stats and let a
    // repeat roast of an unchanged library come back free.
    temperature: 1.0,
    cacheOn: facts,
  });
}

// ===================== 3. The session note =====================
//
// Turns what the player typed after playing into the "Last time" line. It
// summarises THEIR words — it never invents progress they didn't describe.

export type AiNote = { lastTime: string; whatsNext: string };

const NOTE_SCHEMA = {
  type: "object",
  properties: {
    lastTime: { type: "string" },
    whatsNext: { type: "string" },
  },
  required: ["lastTime", "whatsNext"],
};

export async function aiSessionNote(input: {
  deviceId?: string;
  game: string;
  raw: string;
}): Promise<GenResult<AiNote>> {
  const raw = clamp(input.raw, LIMITS.maxNoteChars);
  if (raw.length < 8) return { ok: false, reason: "note too short to summarise" };

  const prompt = [
    `The player just finished a session of ${clamp(input.game, 80)} and wrote this:`,
    `"""${raw}"""`,
    "",
    "Rewrite it as two short lines for when they come back weeks later:",
    "lastTime — where they left off, max 20 words.",
    "whatsNext — the obvious next step, max 15 words, ONLY if their note implies one.",
    "If it implies nothing, make whatsNext an empty string. Never invent progress they did not describe.",
  ].join("\n");

  return generate<AiNote>({
    kind: "note",
    deviceId: input.deviceId,
    prompt,
    schema: NOTE_SCHEMA,
    temperature: 0.3,
    cacheOn: { g: input.game, r: raw },
  });
}

export { budgetSnapshot } from "@/lib/ai-guard";
