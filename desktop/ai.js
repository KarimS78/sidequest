// OpenAI call for the overlay. Vision + game-specific system prompt + wiki
// grounding. Kept standalone (no build step).
//
// Every request goes through ./guard.js, which is the overlay's half of the
// rule the web app follows in lib/ai-guard.ts: clamp the input, cap the output,
// count what was actually billed, cache, and never hang. Read that file for why
// the numbers differ from the web app's.
const https = require("https");
const guard = require("./guard");

// Same model as the web app, so the whole product runs on one key. If reading
// the screenshot ever disappoints, this is the single line to change:
// gpt-5-mini costs 5x more per token and sees game screens noticeably better.
const MODEL = "gpt-5-nano";
const ENDPOINT = "https://api.openai.com/v1/responses";

// Strict mode: every property required, no extras.
const HELP_SCHEMA = {
  type: "object",
  properties: {
    game: { type: "string" },
    answer: { type: "string" },
    steps: { type: "array", items: { type: "string" } },
  },
  required: ["game", "answer", "steps"],
  additionalProperties: false,
};

function buildPrompt({ profile, question, wikiContext }) {
  return [
    profile.system,
    "",
    wikiContext
      ? "Reference material from the game's wiki — treat this as your source of truth and prefer it over guessing:\n\"\"\"\n" +
        wikiContext +
        "\n\"\"\""
      : "",
    "",
    "A screenshot of the player's current screen is attached. Use it ONLY to understand the player's situation (location, enemy, menu, gear, quest). " +
      "Do NOT simply describe what is on screen — pure screen commentary has zero value.",
    "",
    question
      ? `The player's question: "${question}"`
      : "The player pressed the help bind without typing a question. From their on-screen situation and your knowledge of this game, give the single most useful piece of progression or combat help right now.",
    "",
    "Rules:",
    "- Give specific, actionable, game-aware help: mechanics, strategy, what to use, where to go.",
    "- Ground answers in the wiki reference when present. If it's not covered and you're unsure, say so briefly rather than inventing.",
    "- Be concise — this renders in a small overlay.",
    "Respond with: game (the title), answer (1-2 sentences of direct help), steps (2-4 short actionable steps).",
  ]
    .filter(Boolean)
    .join("\n");
}

function postJson(url, body, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    // Without this the overlay spins forever on a stalled connection, in front
    // of a game, with no way to tell it is stuck.
    req.setTimeout(guard.LIMITS.timeoutMs, () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (e) =>
      reject(
        e.message === "timeout"
          ? new Error("OpenAI took too long. Press the bind again.")
          : e
      )
    );
    req.write(payload);
    req.end();
  });
}

/** The visible text of a Responses API reply — a reasoning item may come first. */
function outputText(json) {
  for (const item of json?.output || []) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const block of item.content) {
      if (block?.type === "output_text" && block.text) return block.text;
      if (block?.type === "refusal") throw new Error("The model declined to answer that.");
    }
  }
  return null;
}

// { apiKey, question, imageBase64, profile, wikiContext } -> { game, answer, steps }
async function askOverlay({ apiKey, question, imageBase64, profile, wikiContext }) {
  const game = profile?.name || "Unknown";

  if (!apiKey) {
    return {
      game,
      answer: "No OPENAI_API_KEY found. Add it to .env.local in the project root.",
      steps: ["Set OPENAI_API_KEY", "Restart SideQuest", "Press the bind again"],
    };
  }

  // Clamp before anything else: both of these land verbatim in the prompt, and
  // the wiki text arrives from a page we do not control.
  question = guard.clamp(question, guard.LIMITS.maxQuestionChars);
  wikiContext = guard.clamp(wikiContext, guard.LIMITS.maxWikiChars);

  // Same screen, same question, within the minute — this is the double-tap of
  // the bind, and it should not cost anything.
  const ck = guard.cacheKey({ question, game, imageBase64 });
  const cached = guard.cacheGet(ck);
  if (cached) return cached;

  // A refusal here is a shaped answer, not an error: it renders in the overlay
  // the same way help does, which is what you want mid-game.
  const allowed = guard.check();
  if (!allowed.ok) {
    return { game, answer: allowed.reason, steps: [] };
  }
  guard.markSent();

  const content = [{ type: "input_text", text: buildPrompt({ profile, question, wikiContext }) }];
  if (imageBase64) {
    content.push({
      type: "input_image",
      image_url: `data:image/jpeg;base64,${imageBase64}`,
      detail: "auto",
    });
  }

  const { status, body } = await postJson(
    ENDPOINT,
    {
      model: MODEL,
      input: [{ role: "user", content }],
      // Reading a screenshot deserves a little thought, but not ten seconds of it.
      reasoning: { effort: "low" },
      // A wrong answer here is worse than a truncated one; leave room for both
      // the reasoning tokens and the answer.
      max_output_tokens: guard.LIMITS.maxOutputTokens,
      // The screenshot is the player's screen. It does not get retained.
      store: false,
      text: {
        format: { type: "json_schema", name: "overlay_help", schema: HELP_SCHEMA, strict: true },
      },
    },
    apiKey
  );

  if (status !== 200) {
    throw new Error(`OpenAI API ${status} — ${body.slice(0, 160)}`);
  }

  const json = JSON.parse(body);

  // Bill what the provider says it billed, and do it before any early return —
  // a truncated answer is still a paid one.
  guard.record(json?.usage?.total_tokens ?? 0);

  if (json?.status === "incomplete") {
    throw new Error(`Answer cut short (${json?.incomplete_details?.reason || "unknown"}).`);
  }

  const text = outputText(json);
  if (!text) throw new Error("Empty response from OpenAI.");
  const parsed = JSON.parse(text);
  const result = {
    game: parsed.game || game,
    answer: parsed.answer || "",
    steps: Array.isArray(parsed.steps) ? parsed.steps : [],
  };
  guard.cacheSet(ck, result);
  return result;
}

module.exports = { askOverlay, usage: guard.snapshot };
