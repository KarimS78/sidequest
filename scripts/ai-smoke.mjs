/**
 * Smoke test for the OpenAI layer — one real call per shape the app sends.
 *
 *   node scripts/ai-smoke.mjs
 *
 * Reads OPENAI_API_KEY from .env.local (or the environment). Costs a fraction
 * of a cent. It exists because three request fields are model-dependent and
 * cannot be verified from the docs alone: `reasoning.effort`, `store`, and
 * strict `text.format`. If one of them is rejected on this model, this script
 * says which — and lib/ai.ts already drops `reasoning` / `store` by itself at
 * runtime, so a rejection is a note to take, not an outage.
 */
import { readFileSync } from "node:fs";

const MODEL = "gpt-5-nano";
const ENDPOINT = "https://api.openai.com/v1/responses";

function key() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  try {
    const line = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("OPENAI_API_KEY="));
    return line ? line.slice("OPENAI_API_KEY=".length).trim() : null;
  } catch {
    return null;
  }
}

const SCHEMA = {
  type: "object",
  properties: { appid: { type: "integer" }, reason: { type: "string" } },
  required: ["appid", "reason"],
  additionalProperties: false,
};

async function call(label, body) {
  const started = Date.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  const text = await res.text();
  const ms = Date.now() - started;

  if (!res.ok) {
    console.log(`✗ ${label} — HTTP ${res.status} in ${ms}ms\n  ${text.slice(0, 300)}\n`);
    return null;
  }

  const json = JSON.parse(text);
  const message = (json.output || []).find((i) => i.type === "message");
  const out = (message?.content || []).find((c) => c.type === "output_text")?.text;
  const u = json.usage || {};
  const reasoning = u.output_tokens_details?.reasoning_tokens ?? 0;

  console.log(
    `${out ? "✓" : "✗"} ${label} — ${ms}ms, status ${json.status}` +
      `, ${u.input_tokens} in / ${u.output_tokens} out (${reasoning} reasoning)`
  );
  if (json.status === "incomplete") {
    console.log(`  incomplete: ${json.incomplete_details?.reason} — raise max_output_tokens`);
  }
  console.log(`  ${out ? out.replace(/\s+/g, " ").slice(0, 200) : "(no visible text)"}\n`);
  return json;
}

const prompt = [
  "Pick the single best game for this player right now, from the shortlist only.",
  "",
  "Time available: 45 minutes",
  "Mood: something short and satisfying",
  "",
  "Shortlist (appid | name | why it scored):",
  "1145360 | Hades | Roguelike; 20-40min runs; 6h recently",
  "413150 | Stardew Valley | Cosy; open-ended; never launched",
  "1174180 | Red Dead Redemption 2 | Story Rich; long sessions; 3h in",
  "",
  "Return the appid and one sentence, max 25 words, saying why THIS game for THIS",
  "time and mood. Be concrete about the game. No preamble, no hedging.",
].join("\n");

const format = {
  format: { type: "json_schema", name: "pick", schema: SCHEMA, strict: true },
};

if (!key()) {
  console.error("No OPENAI_API_KEY — put it in .env.local or the environment.");
  process.exit(1);
}

console.log(`Model: ${MODEL}\n`);

// 1. Exactly what lib/ai.ts sends.
await call("full request (reasoning:minimal + store:false + strict schema)", {
  input: prompt,
  max_output_tokens: 400,
  reasoning: { effort: "minimal" },
  store: false,
  text: format,
});

// 2. Without `reasoning` — the first thing the runtime drops on a 400.
await call("without reasoning", {
  input: prompt,
  max_output_tokens: 400,
  store: false,
  text: format,
});

// 3. The old ceiling, to show what a too-tight budget looks like.
await call("tight budget (max_output_tokens: 220)", {
  input: prompt,
  max_output_tokens: 220,
  reasoning: { effort: "minimal" },
  store: false,
  text: format,
});
