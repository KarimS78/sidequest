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

      // Bill what the provider says it billed, not what we guessed. Input and
      // output are kept apart because they are priced an order of magnitude
      // apart — a single total cannot be turned back into a cost.
      recordUsage(opts.deviceId, opts.kind, {
        input: data?.usage?.input_tokens ?? 0,
        output: data?.usage?.output_tokens ?? 0,
        total: data?.usage?.total_tokens ?? 0,
      });

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

// ===================== 4. The shelf search =====================
//
// "something short I don't have to think about" — a sentence the local filter
// cannot answer, because it matches no substring of any title.
//
// The model never sees the library. It sees the vocabulary the library is
// written in (its own community tags) and answers with a FILTER, which local
// code then applies to every game. Three things fall out of that: the prompt is
// the same size for a 10-game demo and a 900-game account, a hallucinated game
// is structurally impossible, and the result is explainable — the filter it
// chose is shown back to the player.

export type AiFilter = {
  /** Tags to match, drawn from the shelf's own vocabulary. */
  tags: string[];
  /** Only games never launched. */
  unplayedOnly: boolean;
  /** Upper bound on hours already sunk in. 0 = no bound. */
  maxHours: number;
  /** Bias towards short bursts or long sittings. */
  sessionFit: "any" | "short" | "long";
  /** One line, shown as the readout: what it understood the ask to be. */
  say: string;
};

const SEARCH_SCHEMA = {
  type: "object",
  properties: {
    tags: { type: "array", items: { type: "string" } },
    unplayedOnly: { type: "boolean" },
    maxHours: { type: "integer" },
    sessionFit: { type: "string", enum: ["any", "short", "long"] },
    say: { type: "string" },
  },
  required: ["tags", "unplayedOnly", "maxHours", "sessionFit", "say"],
  additionalProperties: false,
};

export async function aiSearch(input: {
  deviceId?: string;
  query: string;
  /** The tags actually present on this shelf, most common first. */
  vocabulary: string[];
}): Promise<GenResult<AiFilter>> {
  const query = clamp(input.query, LIMITS.maxQueryChars);
  if (query.length < 3) return { ok: false, reason: "query too short" };

  const vocab = input.vocabulary.slice(0, LIMITS.maxTagsInPrompt);
  if (!vocab.length) return { ok: false, reason: "shelf has no tags to search on" };

  const prompt = [
    "Turn this player's request into a filter over their game shelf.",
    "",
    `Request: "${query}"`,
    "",
    "Tags available on this shelf (use ONLY these, copied exactly):",
    vocab.join(", "),
    "",
    "tags — up to 5 that match the request. Empty if the request is not about genre or feel.",
    "unplayedOnly — true only if they asked for something new or untouched.",
    "maxHours — 0 unless they implied a game they have barely played.",
    "sessionFit — short if they implied a quick session, long if a deep one, else any.",
    "say — one line, max 14 words, stating what you filtered for. No preamble.",
  ].join("\n");

  return generate<AiFilter>({
    kind: "search",
    deviceId: input.deviceId,
    prompt,
    // Same question over the same vocabulary is the same filter, free.
    cacheOn: { q: query.toLowerCase(), v: vocab },
    schema: SEARCH_SCHEMA,
  });
}

// ===================== 5. The portrait =====================
//
// The roast mocks the habit; this one takes the shelf seriously. Numbers and
// tag counts only — no titles beyond the top one, no prices, no ratings.

export type AiPortrait = { archetype: string; reading: string; blindSpot: string };

const PORTRAIT_SCHEMA = {
  type: "object",
  properties: {
    archetype: { type: "string" },
    reading: { type: "string" },
    blindSpot: { type: "string" },
  },
  required: ["archetype", "reading", "blindSpot"],
  additionalProperties: false,
};

export async function aiPortrait(input: {
  deviceId?: string;
  stats: {
    total: number;
    played: number;
    neverPlayed: number;
    barelyPlayed: number;
    totalHours: number;
    topGame?: { name: string; hours: number };
  };
  /** Top tags by how many games carry them. */
  tags: { tag: string; count: number }[];
  /** The genres the player claims to like, from their profile. */
  stated: string[];
}): Promise<GenResult<AiPortrait>> {
  const s = input.stats;
  const tags = input.tags
    .slice(0, 12)
    .map((t) => `${t.tag}:${t.count}`)
    .join(", ");
  const stated = input.stated.slice(0, 8).join(", ") || "none stated";

  const facts = [
    `owned:${s.total}`,
    `played:${s.played}`,
    `never launched:${s.neverPlayed}`,
    `under 2h:${s.barelyPlayed}`,
    `total hours:${s.totalHours}`,
    s.topGame ? `most played:${s.topGame.name} (${s.topGame.hours}h)` : "",
    `shelf tags: ${tags}`,
    `says they like: ${stated}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    "Read this Steam shelf and tell the player what kind of player it describes.",
    "Use only these facts. Invent no games, no prices, no ratings, no completion.",
    "",
    facts,
    "",
    "archetype — a two or three word label for this player. Specific, not flattering filler.",
    "reading — max 35 words on what the tags and the hours actually say about their taste.",
    "blindSpot — max 20 words: what the shelf shows they avoid, or where the stated taste and the hours disagree.",
    "Plain, observant, no hype. Second person.",
  ].join("\n");

  return generate<AiPortrait>({
    kind: "portrait",
    deviceId: input.deviceId,
    prompt,
    schema: PORTRAIT_SCHEMA,
    cacheOn: facts,
  });
}

// ===================== 6. The resume =====================
//
// Weeks later, the notes the player left are still their own words in their own
// shorthand. This reads them back as one line of "here is where you were" — the
// literal promise on the tin, "never forget where you left off".

export type AiResume = { where: string; next: string };

const RESUME_SCHEMA = {
  type: "object",
  properties: {
    where: { type: "string" },
    next: { type: "string" },
  },
  required: ["where", "next"],
  additionalProperties: false,
};

export async function aiResume(input: {
  deviceId?: string;
  game: string;
  /** Newest first: what they wrote, and how long ago. */
  notes: { ago: string; raw: string }[];
}): Promise<GenResult<AiResume>> {
  const notes = input.notes
    .slice(0, LIMITS.maxNotesInPrompt)
    .map((n) => `- ${clamp(n.ago, 24)}: ${clamp(n.raw, LIMITS.maxNoteChars)}`)
    .filter((line) => line.length > 12);

  if (!notes.length) return { ok: false, reason: "no notes to read back" };

  const prompt = [
    `A player is coming back to ${clamp(input.game, 80)} after a break.`,
    "These are the notes they left themselves, newest first:",
    ...notes,
    "",
    "where — max 25 words, second person, where they were when they stopped.",
    "next — max 15 words, the first thing to do on booting it up, ONLY if the notes imply one; otherwise an empty string.",
    "Use their words. Never invent progress, items, characters or objectives they did not write down.",
  ].join("\n");

  return generate<AiResume>({
    kind: "resume",
    deviceId: input.deviceId,
    prompt,
    schema: RESUME_SCHEMA,
    cacheOn: { g: input.game, n: notes },
  });
}

export { budgetSnapshot } from "@/lib/ai-guard";

/**
 * Whether the AI layer is live, and why not when it isn't — for the readout on
 * the profile. Deliberately says nothing about the key beyond present/absent:
 * the answer crosses to the client, so it carries a boolean and never a value.
 */
export function aiStatus(): { on: boolean; why: string } {
  if (process.env.AI_ENABLED === "false") {
    return { on: false, why: "Switched off — AI_ENABLED is false." };
  }
  if (!apiKey()) {
    return { on: false, why: "No OPENAI_API_KEY. Every screen runs on the local engine." };
  }
  return { on: true, why: `Live on ${MODEL}.` };
}
