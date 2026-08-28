// The recommendation engine — pure TypeScript, no network, no dependencies.
//
// Replaces the old LLM call. Every pick is explainable: the score is a sum of
// named components, and the reasons shown in the UI are generated from the
// components that actually fired, never written after the fact.
//
// Runs on the client (it needs no secret and no server round-trip), which is
// why it lives in lib/ and not behind a Server Action.

export type PickerTime = "short" | "medium" | "long";
export type PickerMood = "chill" | "story" | "challenge" | "quick";

export type PickerGame = {
  appid: number;
  name: string;
  playtimeMin: number;
  /** Minutes played in the last 2 weeks — a strong "currently into it" signal. */
  recentMin?: number;
  /** Community tags, most-voted first. Empty is fine, scoring degrades. */
  tags?: string[];
};

export type RecommendInput = {
  library: PickerGame[];
  /** Genres the player said they enjoy, from their profile. */
  favoriteGenres?: string[];
  time: PickerTime;
  /** A preset mood; omitted when the player typed their own. */
  mood?: PickerMood;
  /** Free-text mood in the player's own words — takes priority over `mood`. */
  customMood?: string;
  /** Hard exclusions — games the player just rejected ("not this one"). */
  excludeAppids?: number[];
  /** Soft avoid — recently recommended games; heavily penalised, not banned. */
  recentAppids?: number[];
};

/**
 * One badge-sized justification, generated from a scoring component.
 *
 * `label` is English and stays English: it is what the AI layer is shown and
 * what a history entry stores — data, not interface. `key` + `data` are what
 * the UI renders, which is how the same component reads in either language
 * without the engine ever knowing a language exists.
 */
export type ReasonKey =
  | "mood"
  | "custom"
  | "shortFit"
  | "longFit"
  | "momentum"
  | "never"
  | "stale"
  | "taste";

export type Reason = {
  icon: string;
  label: string;
  key: ReasonKey;
  data?: { tag?: string; hours?: number; text?: string };
};

/**
 * A reason with the arithmetic behind it. The verdict badges print `31/40`,
 * and a badge that showed a number the engine did not compute would be the one
 * lie in an app whose whole pitch is that the maths is visible.
 */
export type ScoredReason = Reason & { points: number; max: number };

/**
 * The ceiling each component can reach, so a badge has a denominator.
 *
 * Exported because the UI rebuilds a pick when the model chooses a different
 * game from the shortlist, and a denominator guessed at the call site is how
 * "15/15 momentum" became "15/40".
 */
export const REASON_MAX: Record<ReasonKey, number> = {
  mood: 40,
  custom: 40,
  shortFit: 20,
  longFit: 20,
  momentum: 15,
  never: 15,
  stale: 15,
  taste: 10,
};

/** The tags a draw is matching on, plus how to name the match afterwards. */
type NeedleSet = {
  list: string[];
  icon: string;
  label: string;
  key: Extract<ReasonKey, "mood" | "custom">;
  /** The player's own words, when they typed instead of picking a mood. */
  text?: string;
};

export type RecommendPick = {
  appid: number;
  name: string;
  /** Prose summary of `reasons`, in English — what the AI layer is shown. */
  reason: string;
  reasons: ScoredReason[];
};

export type Recommendation = {
  pick: RecommendPick;
  /**
   * 1-2 runner-ups. `reason` is the English label (what gets stored and what
   * the model is shown); `hint` is the same thing structured, so the UI can
   * say it in whichever language is on screen.
   */
  alternatives: { appid: number; name: string; reason: string; hint?: Reason }[];
};

export type RecommendResult =
  | { ok: true; recommendation: Recommendation; note?: string }
  | { ok: false; error: string };

// ===================== Tag vocabulary =====================

/**
 * Mood → the tags that signal it. Hand-written against Steam's actual tag
 * vocabulary; matching is case-insensitive and substring-based in BOTH
 * directions, so "Rogue" catches "Roguelike" and "RPG" catches "CRPG".
 */
export const MOOD_TAGS: Record<PickerMood, string[]> = {
  // Low stakes, no failure pressure — something you can put down.
  chill: [
    "Casual",
    "Cozy",
    "Relaxing",
    "Simulation",
    "Farming Sim",
    "Sandbox",
    "Building",
    "Puzzle",
  ],
  // Being told a story, or living one.
  story: [
    "Story Rich",
    "RPG",
    "Adventure",
    "Narrative",
    "Choices Matter",
    "Open World",
    "Singleplayer",
  ],
  // Wants to be tested. Failure is the point.
  challenge: [
    "Souls-like",
    "Difficult",
    "Roguelike",
    "Roguelite",
    "Precision Platformer",
    "Strategy",
  ],
  // Instant gratification, no commitment, easy to stop after one round.
  quick: [
    "Arcade",
    "Fast-Paced",
    "Roguelite",
    "Card Game",
    "Party Game",
    "Platformer",
    "Shooter",
  ],
};

/**
 * Games that fit a small window — one round and you're out.
 * "Roguelike" is in here alongside "Roguelite" because Steam's dominant tag for
 * the whole run-based family is "Roguelike", and a run is the canonical short
 * session. The two spellings don't substring-match each other.
 */
const SHORT_SESSION_TAGS = [
  "Short",
  "Short Sessions",
  "Arcade",
  "Roguelite",
  "Roguelike",
  "Card Game",
  "Party Game",
];

/** Games that punish being played in 30-minute slices. */
const LONG_SESSION_TAGS = ["Open World", "CRPG", "MMO", "4X", "Grand Strategy"];

/**
 * The same two lists, for screens outside the deck.
 *
 * The shelf's plain-language search resolves "something short" against these —
 * the alternative was a second, quietly different idea of what "short" means,
 * living in a component. One definition, two readers.
 */
export const SESSION_TAGS = {
  short: SHORT_SESSION_TAGS,
  long: LONG_SESSION_TAGS,
} as const;

// ===================== Scoring weights =====================
// Kept together so the engine's behaviour can be tuned in one place.

const W = {
  /** Mood is what the player actually asked for — the dominant term. */
  moodMax: 40,
  /** Matching this many mood tags already earns full marks. */
  moodSaturation: 3,
  timeBase: 10,
  timeBonusPerTag: 5,
  timeMalusPerTag: 6,
  timeBonusCap: 2,
  timeMin: -12,
  timeMax: 20,
  momentumBase: 5,
  momentumPerHour: 2,
  momentumMax: 15,
  /** Never launched — the backlog rescue. */
  rediscoveryNever: 15,
  /** Barely touched and not played lately. */
  rediscoveryStale: 8,
  /** Threshold under which a game counts as "barely touched" (minutes). */
  staleUnderMin: 600,
  /** Recently recommended — strong nudge away, not a ban. */
  repeatPenalty: -25,
  /** Profile genres, a mild preference next to the mood the player just picked. */
  tasteMax: 10,
} as const;

// ===================== Tag matching =====================

const norm = (s: string) => s.trim().toLowerCase();

/** Substring match in both directions: "Rogue" ↔ "Roguelike". */
function tagHits(gameTags: string[], needle: string): string | null {
  const n = norm(needle);
  if (!n) return null;
  for (const tag of gameTags) {
    const t = norm(tag);
    if (t.includes(n) || n.includes(t)) return tag;
  }
  return null;
}

/**
 * Does this game answer to any of these tags? The engine's matching rule, made
 * public so the shelf filters by the same reading of a tag that the deck scores
 * by — "Rogue" catching "Roguelike" in one place and not the other would be a
 * bug you could only find by staring at both files.
 */
export function matchesAnyTag(gameTags: string[], needles: string[]): boolean {
  return needles.some((n) => tagHits(gameTags, n) !== null);
}

/** Every needle that matched, with the game tag that matched it. */
function matchTags(
  gameTags: string[],
  needles: string[]
): { needle: string; tag: string }[] {
  const out: { needle: string; tag: string }[] = [];
  for (const needle of needles) {
    const tag = tagHits(gameTags, needle);
    if (tag) out.push({ needle, tag });
  }
  return out;
}

const STOPWORDS = new Set([
  "and", "but", "the", "for", "with", "something", "some", "want", "feel",
  "feeling", "kind", "sort", "like", "little", "bit", "really", "very",
  "just", "not", "into", "that", "this", "play", "game", "games", "mood",
]);

/** Free-text mood → candidate tag needles. */
export function moodTokens(text: string): string[] {
  return [
    ...new Set(
      norm(text)
        .split(/[^a-z0-9-]+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    ),
  ];
}

// ===================== Scoring =====================

type Component = {
  key: "mood" | "time" | "momentum" | "rediscovery" | "taste" | "repeat";
  points: number;
  reason?: Reason;
};

type Scored = {
  game: PickerGame;
  score: number;
  components: Component[];
};

const TIME_LABEL: Record<PickerTime, string> = {
  short: "a quick 30-minute window",
  medium: "a 1–2 hour session",
  long: "a full evening",
};

const MOOD_ICON: Record<PickerMood, string> = {
  chill: "🌙",
  story: "📖",
  challenge: "⚔️",
  quick: "⚡",
};

function scoreGame(
  game: PickerGame,
  input: RecommendInput,
  needles: NeedleSet | null,
  recent: Set<number>
): Scored {
  const tags = game.tags ?? [];
  const components: Component[] = [];

  // --- Mood (or free-text) match: the dominant term ---
  if (needles && tags.length) {
    const hits = matchTags(tags, needles.list);
    if (hits.length) {
      const points =
        Math.min(1, hits.length / W.moodSaturation) * W.moodMax;
      components.push({
        key: "mood",
        points,
        reason: {
          icon: needles.icon,
          label: `${hits[0].tag} — ${needles.label}`,
          key: needles.key,
          data: { tag: hits[0].tag, text: needles.text },
        },
      });
    }
  }

  // --- Session length fit ---
  {
    const shortHits = matchTags(tags, SHORT_SESSION_TAGS).length;
    const longHits = matchTags(tags, LONG_SESSION_TAGS).length;
    const cap = (n: number) => Math.min(n, W.timeBonusCap);

    let points: number = W.timeBase;
    let label: string | null = null;
    let key: Extract<ReasonKey, "shortFit" | "longFit"> | null = null;

    if (input.time === "short") {
      points +=
        cap(shortHits) * W.timeBonusPerTag - cap(longHits) * W.timeMalusPerTag;
      if (shortHits) { label = "Made for short bursts"; key = "shortFit"; }
      else if (longHits) label = "Wants more room than you have";
    } else if (input.time === "long") {
      points +=
        cap(longHits) * W.timeBonusPerTag - cap(shortHits) * W.timeMalusPerTag;
      if (longHits) { label = "Rewards a long sitting"; key = "longFit"; }
      else if (shortHits) label = "Over before the evening is";
    }
    // `medium` stays at the neutral base — almost anything fits 1–2 hours.

    points = Math.max(W.timeMin, Math.min(W.timeMax, points));
    components.push({
      key: "time",
      points,
      reason:
        points > W.timeBase && label && key
          ? {
              icon: "🕐",
              label: `${label} — fits ${TIME_LABEL[input.time]}`,
              key,
            }
          : undefined,
    });
  }

  // --- Momentum: you're already in it, keep going ---
  const recentMin = game.recentMin ?? 0;
  if (recentMin > 0) {
    const hours = recentMin / 60;
    const points = Math.min(
      W.momentumMax,
      W.momentumBase + hours * W.momentumPerHour
    );
    components.push({
      key: "momentum",
      points,
      reason: {
        icon: "🔥",
        label: `${Math.max(1, Math.round(hours))}h in the last 2 weeks — you're mid-run`,
        key: "momentum",
        data: { hours: Math.max(1, Math.round(hours)) },
      },
    });
  }

  // --- Rediscovery: rescue the backlog ---
  // No last-played date is stored, so "not played in a while" is approximated
  // by "nothing in the last 2 weeks" — the only recency signal Steam gives us.
  if (game.playtimeMin === 0) {
    components.push({
      key: "rediscovery",
      points: W.rediscoveryNever,
      reason: {
        icon: "💤",
        label: "Never launched — still in its wrapper",
        key: "never",
      },
    });
  } else if (game.playtimeMin < W.staleUnderMin && recentMin === 0) {
    components.push({
      key: "rediscovery",
      points: W.rediscoveryStale,
      reason: {
        icon: "💤",
        label: `Only ${Math.round(game.playtimeMin / 60)}h in — you never gave it a real shot`,
        key: "stale",
        data: { hours: Math.round(game.playtimeMin / 60) },
      },
    });
  }

  // --- Profile taste: a mild nudge, well below the mood just chosen ---
  const favorites = input.favoriteGenres ?? [];
  if (favorites.length && tags.length) {
    const hits = matchTags(tags, favorites);
    if (hits.length) {
      components.push({
        key: "taste",
        points: Math.min(1, hits.length / 2) * W.tasteMax,
        reason: {
          icon: "🎯",
          label: `${hits[0].tag} — one of your favourite genres`,
          key: "taste",
          data: { tag: hits[0].tag },
        },
      });
    }
  }

  // --- Anti-repetition ---
  if (recent.has(game.appid)) {
    components.push({ key: "repeat", points: W.repeatPenalty });
  }

  return {
    game,
    score: components.reduce((s, c) => s + c.points, 0),
    components,
  };
}

// ===================== Draw =====================

/**
 * Weighted pick from the top candidates. Not the #1 every time — the spin has
 * to stay a spin. Weights are squared so a clear winner usually wins, while a
 * near-tie stays a genuine toss-up.
 */
function weightedPick<T>(items: { item: T; score: number }[]): T {
  if (items.length === 1) return items[0].item;
  const min = Math.min(...items.map((i) => i.score));
  const weights = items.map((i) => Math.pow(i.score - min + 1, 2));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i].item;
  }
  return items[items.length - 1].item;
}

/** How many top-scored games the draw considers. */
const SHORTLIST = 5;

// ===================== Public API =====================

/** Prose summary for the pick card, built from the reasons that fired. */
function prose(reasons: Reason[], time: PickerTime): string {
  if (!reasons.length) {
    return `A fair shout for ${TIME_LABEL[time]} — nothing in your library stood out, so this one's the roll of the dice.`;
  }
  const parts = reasons.map((r) => r.label.replace(/ — /g, ", "));
  return `${parts.join(". ")}.`;
}

export function recommendGame(input: RecommendInput): RecommendResult {
  if (!input.library?.length) {
    return {
      ok: false,
      error: "Import your Steam library first so I have something to pick from.",
    };
  }

  // Drop rejected games — but never empty the pool. If the player rejected
  // everything, fall back to the full library rather than dead-ending.
  const exclude = new Set(input.excludeAppids ?? []);
  const filtered = input.library.filter((g) => !exclude.has(g.appid));
  const pool = filtered.length ? filtered : input.library;

  // Free text wins over the preset mood, but only if any of its words actually
  // land on a tag somewhere in the library — otherwise it's noise, and saying so
  // beats silently scoring on a word nobody tagged.
  const custom = input.customMood?.trim();
  let note: string | undefined;
  let needles: NeedleSet | null = null;

  if (custom) {
    const tokens = moodTokens(custom);
    const lands = tokens.some((t) =>
      pool.some((g) => tagHits(g.tags ?? [], t))
    );
    if (lands) {
      needles = {
        list: tokens,
        icon: "✨",
        label: `matches “${custom}”`,
        key: "custom",
        text: custom,
      };
    } else {
      note = `Nothing in your library is tagged anything like “${custom}”, so I picked on time and playtime instead. Try a genre word — “roguelike”, “cozy”, “story”.`;
    }
  } else if (input.mood) {
    needles = {
      list: MOOD_TAGS[input.mood],
      icon: MOOD_ICON[input.mood],
      label: "your mood",
      key: "mood",
    };
  }

  const recent = new Set(input.recentAppids ?? []);
  const scored = pool
    .map((g) => scoreGame(g, input, needles, recent))
    .sort((a, b) => b.score - a.score);

  const shortlist = scored.slice(0, SHORTLIST);
  const winner = weightedPick(
    shortlist.map((s) => ({ item: s, score: s.score }))
  );

  // Reasons: the components that actually earned points, best first, capped at
  // four so the card stays readable.
  const reasons: ScoredReason[] = winner.components
    .filter((c) => c.points > 0 && c.reason)
    .sort((a, b) => b.points - a.points)
    .slice(0, 4)
    .map((c) => {
      const reason = c.reason as Reason;
      return {
        ...reason,
        points: Math.round(c.points),
        max: REASON_MAX[reason.key],
      };
    });

  const alternatives = shortlist
    .filter((s) => s.game.appid !== winner.game.appid)
    .slice(0, 2)
    .map((s) => {
      const top = s.components
        .filter((c) => c.points > 0 && c.reason)
        .sort((a, b) => b.points - a.points)[0];
      return {
        appid: s.game.appid,
        name: s.game.name,
        reason: top?.reason?.label ?? `Also fits ${TIME_LABEL[input.time]}.`,
        hint: top?.reason,
      };
    });

  return {
    ok: true,
    note,
    recommendation: {
      pick: {
        appid: winner.game.appid,
        name: winner.game.name,
        reason: prose(reasons, input.time),
        reasons,
      },
      alternatives,
    },
  };
}

/**
 * The top candidates, each flattened to one short signal line.
 *
 * This is what the AI layer is allowed to see: never the library, only the
 * games worth arguing about plus the reasons they scored. Prompt size is a
 * function of `limit` and nothing else.
 */
export function shortlist(
  input: RecommendInput,
  limit = SHORTLIST
): { appid: number; name: string; signals: string }[] {
  return explain(input)
    .slice(0, limit)
    .map((s) => ({
      appid: s.game.appid,
      name: s.game.name,
      signals:
        s.components
          .filter((c) => c.points > 0 && c.reason)
          .sort((a, b) => b.points - a.points)
          .map((c) => c.reason!.label.split(" — ")[0])
          .join("; ") || "no strong signal",
    }));
}

/**
 * Scores without drawing — the shortlist with its full breakdown. Used to
 * inspect and tune the engine.
 */
export function explain(input: RecommendInput) {
  const recent = new Set(input.recentAppids ?? []);
  const custom = input.customMood?.trim();
  const needles: NeedleSet | null = custom
    ? {
        list: moodTokens(custom),
        icon: "✨",
        label: `matches “${custom}”`,
        key: "custom",
        text: custom,
      }
    : input.mood
      ? {
          list: MOOD_TAGS[input.mood],
          icon: MOOD_ICON[input.mood],
          label: "your mood",
          key: "mood",
        }
      : null;

  return input.library
    .map((g) => scoreGame(g, input, needles, recent))
    .sort((a, b) => b.score - a.score);
}
