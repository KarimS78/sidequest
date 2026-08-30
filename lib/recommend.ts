// The recommendation engine — pure TypeScript, no network, no dependencies.
//
// Replaces the old LLM call. Every pick is explainable: the score is a sum of
// named components, and the reasons shown in the UI are generated from the
// components that actually fired, never written after the fact.
//
// Runs on the client (it needs no secret and no server round-trip), which is
// why it lives in lib/ and not behind a Server Action.

import { readMood, negatedTags } from "@/lib/mood-words";

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
  /**
   * The model's reading of `customMood` — tags drawn out of it, in the shelf's
   * own vocabulary. Supplied by the caller when the AI layer is available.
   *
   * Used only where the engine's own reading (lib/mood-words.ts) came up empty:
   * the lexicon is the steadier reader, this is the cover for phrasings it does
   * not know. With no key these are simply absent.
   */
  moodNeedles?: string[];
  /** Tags the same reading says to steer away from. Same precedence. */
  moodAvoid?: string[];
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
  data?: { tag?: string; hours?: number; text?: string; tags?: string[] };
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
  /**
   * Tags the player ruled out in so many words — "nothing scary", "rien de trop
   * dur". Scored as a penalty rather than merely left unrewarded: a refusal is
   * information, and treating it as silence is how a request for something calm
   * comes back with Elden Ring.
   */
  avoid?: string[];
  /** Per-needle specificity on this shelf, from `specificity()`. */
  spec: Map<string, number>;
  /**
   * The needles split by the sense they came from. A preset mood is one
   * group; a typed "une bonne histoire, tranquille" is two. The score is the
   * mean over groups, each saturating on its own, so answering both asks
   * beats saturating one.
   */
  groups: string[][];
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
    "Relaxing",
    "Cozy",
    "Casual",
    "Farming Sim",
    "Life Sim",
    "Simulation",
    "Sandbox",
    "Building",
    "Puzzle",
    "Cute",
    "Fishing",
  ],
  // Being told a story, or living one. "Singleplayer" and "Open World" used
  // to be in here; on a real shelf they sit on most of it, which is how a
  // Guild Wars tied with Disco Elysium for "story".
  story: [
    "Story Rich",
    "Narrative",
    "Choices Matter",
    "Visual Novel",
    "CRPG",
    "JRPG",
    "RPG",
    "Emotional",
    "Mystery",
    "Detective",
    "Cinematic",
    "Adventure",
  ],
  // Wants to be tested. Failure is the point. Not "Strategy": that is
  // thinking, which is a different ask, and it was pulling deckbuilders
  // ahead of Elden Ring for "challenge, whole evening".
  challenge: [
    "Difficult",
    "Souls-like",
    "Precision Platformer",
    "Roguelike",
    "Perma Death",
    "Competitive",
    "Boomer Shooter",
  ],
  // Instant gratification, no commitment, easy to stop after one round.
  quick: [
    "Arcade",
    "Fast-Paced",
    "Roguelite",
    "Card Game",
    "Party Game",
    "Bullet Hell",
    "Rhythm",
    "Racing",
    "Addictive",
    "Battle Royale",
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
  "Deckbuilding",
  "Party Game",
  "Bullet Hell",
  "Rhythm",
  "Racing",
  "Pinball",
  "Battle Royale",
  "Fighting",
];

/**
 * Games that punish being played in 30-minute slices. "City Builder" is here
 * because a never-launched Cities: Skylines was the engine's answer to
 * "chill, half an hour" — a city is not a thing you start in thirty minutes.
 */
const LONG_SESSION_TAGS = [
  "Open World",
  "Open World Survival Craft",
  "CRPG",
  "JRPG",
  "MMO",
  "MMORPG",
  "Massively Multiplayer",
  "4X",
  "Grand Strategy",
  "City Builder",
  "Colony Sim",
  "Base Building",
];

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
  /**
   * Weighted evidence that earns full marks. A hit is worth up to 1 — less
   * when the tag sits low in the game's list or high on everyone's shelf —
   * so two strong, specific hits saturate and five weak ones do not.
   *
   * It was a count of three. With SteamSpy's fifteen tags per game, nearly
   * everything has three of anything, and "story" came back as five games
   * tied at 40 with a draw between them: a lottery with a scoreboard.
   */
  moodSaturation: 2,
  /** Rank weight floor: a tag in 15th place still counts, for a quarter. */
  rankFloor: 0.25,
  /** How much each place down the tag list costs. */
  rankStep: 0.06,
  /** Specificity floor: a tag on every game on the shelf still counts, barely. */
  specFloor: 0.15,
  /**
   * Below this much of a sense, it did not answer that sense. The concave
   * coverage would otherwise turn one fifteenth-place tag into a fifth of a
   * full match.
   */
  senseFloor: 0.1,
  /**
   * Carrying tags the player ruled out. Sized just above the anti-repetition
   * nudge: "not this kind of thing tonight" is a firmer instruction than "you
   * saw this one on Tuesday".
   */
  avoidMax: 30,
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
  return tagHitAt(gameTags, needle)?.tag ?? null;
}

/**
 * The same match, with where in the list it landed.
 *
 * SteamSpy orders tags by votes, so the position is the community saying how
 * much the tag is the game: "Horror" first on Dredge is the point of Dredge,
 * "Horror" fifteenth on Vampire Survivors is a technicality. The engine
 * treated both as one hit and answered "I want to be scared" with a
 * bullet-hell.
 */
function tagHitAt(gameTags: string[], needle: string): { tag: string; rank: number } | null {
  const n = norm(needle);
  if (!n) return null;
  // Exact first: "RPG" should land on a game's "RPG" before its "MMORPG".
  for (let i = 0; i < gameTags.length; i++) {
    if (norm(gameTags[i]) === n) return { tag: gameTags[i], rank: i };
  }
  for (let i = 0; i < gameTags.length; i++) {
    const t = norm(gameTags[i]);
    // Needle inside tag: "Rogue" → "Roguelike", "RPG" → "CRPG". Tag inside
    // needle only as a plural or a suffix ("metroidvanias" → "Metroidvania"),
    // so it has to be a prefix: a game tagged "Platformer" is not a precision
    // platformer, a game tagged "Building" is not a base builder, and a game
    // tagged "RPG" is not a CRPG — all three were scoring as if.
    if (t.includes(n) || (n.startsWith(t) && n.length - t.length <= 2)) {
      return { tag: gameTags[i], rank: i };
    }
  }
  return null;
}

/** 1 at the top of the list, sliding to the floor around fifteenth place. */
function rankWeight(rank: number): number {
  return Math.max(W.rankFloor, 1 - rank * W.rankStep);
}

/**
 * How much a needle says about a game on THIS shelf: 1 when it is rare, near
 * nothing when it is on everything. "Singleplayer" sits on 34 of 41 games on
 * a real account; matching it is not information. Computed once per draw.
 */
function specificity(needles: string[], pool: PickerGame[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!pool.length) return out;
  for (const n of needles) {
    const hits = pool.filter((g) => tagHitAt(g.tags ?? [], n)).length;
    out.set(n, Math.max(W.specFloor, 1 - hits / pool.length));
  }
  return out;
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

/** Every needle that matched, with the game tag that matched it and its rank. */
function matchTags(
  gameTags: string[],
  needles: string[]
): { needle: string; tag: string; rank: number }[] {
  const out: { needle: string; tag: string; rank: number }[] = [];
  const claimed = new Set<string>();
  for (const needle of needles) {
    const hit = tagHitAt(gameTags, needle);
    // One claim per tag: "CRPG" and "JRPG" both reach "RPG", and a session
    // list counted the one tag twice.
    if (hit && !claimed.has(hit.tag)) {
      claimed.add(hit.tag);
      out.push({ needle, ...hit });
    }
  }
  return out;
}

/**
 * Weighted evidence for a set of needles: each hit counts for its rank on the
 * game times its specificity on the shelf. Sorted strongest first, so the
 * badge names the tag that actually carried the score.
 */
function evidence(
  gameTags: string[],
  needles: string[],
  spec: Map<string, number>
): { total: number; hits: { needle: string; tag: string; weight: number }[] } {
  // One claim per game tag: "RPG", "CRPG" and "JRPG" are three needles, and a
  // game's single "JRPG" tag answered all three, counting three times.
  const byTag = new Map<string, { needle: string; tag: string; weight: number }>();
  for (const h of matchTags(gameTags, needles)) {
    const weight = rankWeight(h.rank) * (spec.get(h.needle) ?? 1);
    const prev = byTag.get(h.tag);
    if (!prev || prev.weight < weight) byTag.set(h.tag, { needle: h.needle, tag: h.tag, weight });
  }
  const hits = [...byTag.values()].sort((a, b) => b.weight - a.weight);
  return { total: hits.reduce((s, h) => s + h.weight, 0), hits };
}

// The free-text reading — stopwords, negation and the bilingual sense lexicon
// — lives in lib/mood-words.ts. It left this file when it stopped being a
// tokenizer: a substring search over tag names could not answer a sentence.

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
    const hits = evidence(tags, needles.list, needles.spec);
    const avoided = needles.avoid?.length
      ? evidence(tags, needles.avoid, needles.spec)
      : { total: 0, hits: [] };
    // Mean over senses of the square root of each one's saturation: concave,
    // so half of two asks beats all of one. A plain mean scored "une bonne
    // histoire, tranquille" the same for Stardew Valley (calm, no story) as
    // for Dredge (some of each), and playtime broke the tie the wrong way.
    const groups = needles.groups.length ? needles.groups : [needles.list];
    const coverage =
      groups.reduce((s, g) => {
        const sat = Math.min(1, evidence(tags, g, needles.spec).total / W.moodSaturation);
        return s + (sat < W.senseFloor ? 0 : Math.sqrt(sat));
      }, 0) / groups.length;
    const reward = coverage * W.moodMax;
    const malus = Math.min(1, avoided.total / W.moodSaturation) * W.avoidMax;

    if (hits.hits.length) {
      components.push({
        key: "mood",
        points: reward - malus,
        reason: {
          icon: needles.icon,
          label: `${hits.hits[0].tag} — ${needles.label}`,
          key: needles.key,
          data: {
            tag: hits.hits[0].tag,
            text: needles.text,
            // Every tag that scored, strongest first. The shortlist shows the
            // model these: with one tag per game it could not see that Dredge
            // answered both halves of "une bonne histoire, tranquille" and
            // took Stardew Valley for the story.
            tags: hits.hits.slice(0, 3).map((h) => h.tag),
          },
        },
      });
    } else if (malus) {
      // Nothing to celebrate, something to avoid. Scored, but given no reason:
      // the verdict lists why this game won, and "carries a tag you ruled out"
      // is never a why for a game that did.
      components.push({ key: "mood", points: -malus });
    }
  }

  // --- Session length fit ---
  {
    // Rank-weighted like the mood: "Open World" in first place is a game
    // built around it, in twelfth it is a large map.
    const weigh = (list: string[]) =>
      matchTags(tags, list).reduce((s, h) => s + rankWeight(h.rank), 0);
    const shortHits = weigh(SHORT_SESSION_TAGS);
    const longHits = weigh(LONG_SESSION_TAGS);
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

/**
 * What a typed mood is scored on — read once, so every caller reads it the same.
 *
 * `explain` rebuilds the badges when the model picks a different game from the
 * shortlist, so it and `recommendGame` have to agree exactly. They did not: one
 * unioned the two readings and the other still replaced, and the same phrase
 * scored 50 through the draw and 37 through the rebuild. Same bug family as a
 * denominator guessed at the call site, and the same fix — one function.
 *
 * The lexicon wins where it has an opinion; the model fills the silence.
 *
 * Unioning the two was the first try and it was measurably worse. The lexicon
 * is deterministic and right about the words it knows. The model is neither: on
 * gpt-5-nano the same phrase does not read the same twice — "je veux souffrir"
 * came back Difficult + Souls-like once and Open World + RPG the next — and a
 * union lets one bad reading outvote a good one. Asked for "rien de trop long,
 * j'ai pas la tête à ça", the lexicon said Casual/Relaxing and the model added
 * tags for an immersive epic; unioned, the draw answered Elden Ring.
 *
 * So the model is not a co-author, it is the cover for sentences nobody could
 * write a lexicon for. When the lexicon fires, the reading is also free,
 * instant and identical every time — and identical with or without a key.
 *
 * Returns null when the shelf has nothing to say to any of it.
 */
function customNeedles(
  custom: string,
  input: RecommendInput,
  pool: PickerGame[]
): NeedleSet | null {
  const local = readMood(custom);

  // Only needles this shelf can answer to. A word nobody tagged is not a
  // preference, it is noise, and scoring on it would spread 40 points evenly
  // over games that have nothing to do with the ask.
  const lands = (t: string) => pool.some((g) => tagHits(g.tags ?? [], t));

  const localList = local.needles.filter(lands);
  const list = localList.length ? localList : (input.moodNeedles ?? []).filter(lands);
  const groups = localList.length
    ? local.groups.map((g) => g.filter(lands)).filter((g) => g.length)
    : [list];

  const localAvoid = negatedTags(local.negated).filter(lands);
  const avoid = (localAvoid.length ? localAvoid : (input.moodAvoid ?? []).filter(lands))
    // What was asked for wins over what either reading guessed to rule out.
    .filter((t) => !list.some((l) => l.toLowerCase() === t.toLowerCase()));

  // A refusal with nothing asked for is still a usable instruction.
  if (!list.length && !avoid.length) return null;

  return {
    list,
    icon: "✨",
    label: `matches “${custom}”`,
    key: "custom",
    text: custom,
    avoid,
    spec: specificity([...list, ...avoid], pool),
    groups,
  };
}

/** The preset-mood needle set, with its specificity measured on this shelf. */
function presetNeedles(mood: PickerMood, pool: PickerGame[]): NeedleSet {
  return {
    list: MOOD_TAGS[mood],
    icon: MOOD_ICON[mood],
    label: "your mood",
    key: "mood",
    spec: specificity(MOOD_TAGS[mood], pool),
    groups: [MOOD_TAGS[mood]],
  };
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
    needles = customNeedles(custom, input, pool);
    if (!needles) {
      note = `Nothing in your library is tagged anything like “${custom}”, so I picked on time and playtime instead. Try a genre word — “roguelike”, “cozy”, “story”.`;
    }
  } else if (input.mood) {
    needles = presetNeedles(input.mood, pool);
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
          .map((c) => {
            const r = c.reason!;
            const head = r.data?.tags?.length ? r.data.tags.join(", ") : r.label.split(" — ")[0];
            // The points make the ranking legible: "mood 22/40" next to
            // "mood 8/40" says why the first line is first.
            return c.key === "mood" ? `${head} (mood ${Math.round(c.points)}/${W.moodMax})` : head;
          })
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
    ? customNeedles(custom, input, input.library)
    : input.mood
      ? presetNeedles(input.mood, input.library)
      : null;

  return input.library
    .map((g) => scoreGame(g, input, needles, recent))
    .sort((a, b) => b.score - a.score);
}
