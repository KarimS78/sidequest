// AI layer (server-only). OpenAI Responses API via REST — no SDK, no extra deps.
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

// nano: the cheapest model that reasons well enough for a 12-item choice.
// $0.05 / 1M in, $0.40 / 1M out — the prompts here run 120-350 tokens, so a
// call costs a small fraction of a cent.
const MODEL = "gpt-5-nano";
const ENDPOINT = "https://api.openai.com/v1/responses";

function apiKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

/** Kill switch — set AI_ENABLED=false to run fully local without pulling the key. */
function enabled() {
  return process.env.AI_ENABLED !== "false" && !!apiKey();
}

type GenResult<T> =
  | { ok: true; value: T; cached: boolean }
  | { ok: false; reason: string };

// Optional request fields the API may reject depending on the model snapshot
// (`reasoning` and `store` are both model-dependent on the nano tier). Rather
// than pin a guess, we send them, and on a 400 that names one we drop it here
// and never send it again for the life of the process.
const droppedFields = new Set<string>();

/** Which optional field, if any, a 400 is complaining about. */
function unsupportedField(errorBody: string): string | null {
  const lower = errorBody.toLowerCase();
  if (!lower.includes("unsupported") && !lower.includes("unknown parameter")) return null;
  for (const field of ["reasoning", "store"]) {
    if (!droppedFields.has(field) && lower.includes(field)) return field;
  }
  return null;
}

/**
 * The visible text of a Responses API reply.
 *
 * `output` is a list of items — a reasoning item may come first — and the text
 * lives inside the `message` item. A refusal is a legitimate outcome, not a
 * crash: it comes back as a reason and the caller degrades to local.
 */
function outputText(data: unknown): { ok: true; text: string } | { ok: false; reason: string } {
  const output = (data as { output?: unknown[] })?.output;
  if (!Array.isArray(output)) return { ok: false, reason: "no output" };

  for (const item of output) {
    const it = item as { type?: string; content?: unknown[] };
    if (it?.type !== "message" || !Array.isArray(it.content)) continue;
    for (const block of it.content) {
      const b = block as { type?: string; text?: string };
      if (b?.type === "output_text" && b.text) return { ok: true, text: b.text };
      if (b?.type === "refusal") return { ok: false, reason: "refused" };
    }
  }
  return { ok: false, reason: "empty response" };
}

/**
 * One bounded round-trip. Returns a reason rather than throwing — callers are
 * expected to degrade, not to handle errors.
 */
async function generate<T>(opts: {
  kind: CallKind;
  deviceId?: string;
  prompt: string;
  schema: object;
  cacheOn: unknown;
}): Promise<GenResult<T>> {
  const key = apiKey();
  if (!enabled() || !key) return { ok: false, reason: "AI is off" };

  const ck = cacheKey(opts.kind, opts.cacheOn);
  const hit = cacheGet<T>(ck);
  if (hit) return { ok: true, value: hit, cached: true };

  const quota = checkQuota(opts.deviceId, opts.kind);
  if (!quota.ok) return { ok: false, reason: quota.reason };

  // No temperature: the gpt-5 family only accepts its default. Variety in the
  // roast now comes from the prompt, not from a sampling knob.
  const body = (): Record<string, unknown> => ({
    model: MODEL,
    input: opts.prompt,
    // Counts reasoning tokens too, not just the visible answer — see LIMITS.
    max_output_tokens: LIMITS.maxOutputTokens[opts.kind],
    // Nothing here is worth thinking about for ten seconds; minimal keeps the
    // reasoning tokens (billed as output) near zero and the answer fast.
    ...(droppedFields.has("reasoning") ? {} : { reasoning: { effort: "minimal" } }),
    // Don't leave the player's session notes sitting in a dashboard.
    ...(droppedFields.has("store") ? {} : { store: false }),
    text: {
      format: {
        type: "json_schema",
        name: opts.kind,
        schema: opts.schema,
        strict: true,
      },
    },
  });

  // One extra attempt is reserved for dropping a rejected optional field, so a
  // model that refuses `reasoning` still answers on the first user-visible call.
  let degradations = 1;

  for (let attempt = 0; attempt <= LIMITS.retries; attempt++) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), LIMITS.timeoutMs);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        cache: "no-store",
        body: JSON.stringify(body()),
        signal: abort.signal,
      });

      // 4xx is never retried — a quota or bad-request error costs the same
      // twice. The one exception is a field this model doesn't accept: drop it
      // and go again, once.
      if (!res.ok) {
        if (res.status === 400 && degradations > 0) {
          const field = unsupportedField(await res.text());
          if (field) {
            droppedFields.add(field);
            degradations--;
            attempt--;
            continue;
          }
        }
        if (res.status >= 500 && attempt < LIMITS.retries) continue;
        return { ok: false, reason: `provider ${res.status}` };
      }

      const data = await res.json();

      // Bill what the provider says it billed, not what we guessed.
      recordUsage(opts.deviceId, opts.kind, data?.usage?.total_tokens ?? 0);

      // Reasoning that eats the whole ceiling returns 200 with no text at all.
      if (data?.status === "incomplete") {
        const why = data?.incomplete_details?.reason ?? "unknown";
        return { ok: false, reason: `incomplete: ${why}` };
      }

      const text = outputText(data);
      if (!text.ok) return text;

      const value = JSON.parse(text.text) as T;
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

// Strict mode: every property listed in `required`, no extras allowed.
const PICK_SCHEMA = {
  type: "object",
  properties: {
    appid: { type: "integer" },
    reason: { type: "string" },
  },
  required: ["appid", "reason"],
  additionalProperties: false,
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
  additionalProperties: false,
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
    // The sampling knob is gone on this model, so variety has to be asked for.
    "Pick an unexpected angle rather than the obvious one. PG-13. No slurs. Short sentences.",
  ].join("\n");

  return generate<AiRoast>({
    kind: "roast",
    deviceId: input.deviceId,
    prompt,
    schema: ROAST_SCHEMA,
    // Cache on the stats: a repeat roast of an unchanged library comes back free.
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
  additionalProperties: false,
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
    cacheOn: { g: input.game, r: raw },
  });
}

export { budgetSnapshot } from "@/lib/ai-guard";
