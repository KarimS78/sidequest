// Client-side persistence for the player's library + profile (V1, local-first).
// Swapped for Supabase later — keep all storage access behind these helpers so
// that migration touches one file.

export type StoredGame = {
  appid: number;
  name: string;
  playtimeMin: number;
  coverUrl: string;
  /** True for games the player added manually (not from the Steam import). */
  added?: boolean;
  /** Minutes played in the last 2 weeks, captured at import. 0/undefined = none. */
  recentMin?: number;
  /**
   * Community tags (store page, SteamSpy, storefront genres as fallbacks),
   * most-voted first. The scoring engine's main signal. Always an array after
   * `loadLibrary` — libraries stored before tags existed read back as [] and
   * can be re-enriched.
   */
  tags: string[];
  /**
   * Which reading of the tags these are. Bumped when the source or the cap
   * changes, so a shelf enriched under the old rules is read again once —
   * six tags per game were enough for a genre and not for a mood.
   */
  tagsV?: number;
};

/** The current tag reading. Games below it show up in `untaggedAppids`. */
export const TAGS_VERSION = 2;

export type StoredProfile = {
  /** Genres the player says they enjoy, used as a recommendation signal. */
  favoriteGenres: string[];
  /** The connected SteamID64, kept so we can refresh data later. */
  steamId?: string;
};

/**
 * Tags that sit on most of any real shelf and therefore say nothing about
 * it. "Singleplayer" was the dominant tag of a 41-game account (34 games),
 * and the roast called that a type. Shared with the portrait, which was
 * spending its twelve tag slots on the same nothing.
 */
export const GENERIC_TAGS = new Set(
  [
    "Singleplayer", "Multiplayer", "Indie", "Action", "Adventure", "Atmospheric",
    "Great Soundtrack", "2D", "3D", "Third Person", "First-Person", "Colorful",
    "Early Access", "Mature", "Nudity", "Violent", "Gore", "Realistic", "Stylized",
    "Replay Value", "Moddable", "Controller", "Family Friendly", "Old School",
    "Character Customization", "Cinematic", "Beautiful", "Dark", "Female Protagonist",
    "Exploration", "Cartoon", "Cartoony", "Cute", "Funny", "Comedy", "Classic",
    "Combat", "Masterpiece", "Addictive", "Physics", "Procedural Generation",
    "Perma Death", "Isometric", "Top-Down", "Side Scroller", "Hand-drawn",
  ].map((t) => t.toLowerCase())
);

export function isGenericTag(tag: string): boolean {
  return GENERIC_TAGS.has(tag.trim().toLowerCase());
}

/** A game family, read off the top of a tag list. */
export type Family = "story" | "roguelike" | "multiplayer" | "strategy";

const FAMILY_TAGS: Record<Family, string[]> = {
  story: ["story rich", "narrative", "choices matter", "visual novel", "jrpg", "crpg"],
  roguelike: ["roguelike", "roguelite", "deckbuilding", "roguelike deckbuilder", "action roguelike"],
  multiplayer: ["multiplayer", "co-op", "online co-op", "pvp", "massively multiplayer", "battle royale", "mmorpg", "local co-op"],
  strategy: ["strategy", "turn-based strategy", "4x", "grand strategy", "city builder", "management", "tactical"],
};

/** Which families a game belongs to, judged on its six most-voted tags only. */
export function familiesOf(tags: string[]): Family[] {
  const top = tags.slice(0, 6).map((t) => t.trim().toLowerCase());
  return (Object.keys(FAMILY_TAGS) as Family[]).filter((f) =>
    top.some((t) => FAMILY_TAGS[f].includes(t))
  );
}

/**
 * Tags near the top of a list that mark a game as a big one, biggest first:
 * a sealed hundred-hour JRPG is a better jab than a sealed open world.
 */
const BIG_TAGS = ["mmorpg", "4x", "grand strategy", "jrpg", "crpg", "rpg", "open world", "story rich"];

/**
 * Derived backlog metrics — feeds the roast, the portrait and the profile.
 *
 * Everything here is measured, never guessed: there are no prices, no
 * completion data and no dates beyond "played in the last two weeks". What
 * there is, is enough to name names — the game that got twenty minutes, the
 * hundred-hour RPG still sealed, the co-op bought for friends who never came.
 */
export type BacklogStats = {
  total: number;
  played: number; // games with any playtime
  neverPlayed: number;
  barelyPlayed: number; // started but under 2h
  totalHours: number;
  topGame?: { name: string; hours: number };
  /** Top three by hours. */
  podium: { name: string; hours: number }[];
  /** Share of all hours inside the podium, 0..1. */
  podiumShare: number;
  /** Most common meaningful tag — generic ones excluded. */
  topTag?: { tag: string; count: number };
  /** Top five meaningful tags. */
  genres: { tag: string; count: number }[];
  /** A few never-played game names, for flavour. */
  shelfOfShame: string[];
  /** The played game that got the least time: the shortest first date. */
  shortestTry?: { name: string; minutes: number };
  /** A never-launched game that is plainly a big one, with the tag that says so. */
  bigUnopened?: { name: string; kind: string };
  /** Never-launched games whose top tags are multiplayer: bought for friends. */
  coopUnopened: string[];
  /** Hours in the last two weeks, and the games they went into. */
  recentHours: number;
  recentGames: { name: string; hours: number }[];
  /** Owned and played, by family, for "six story games, 300h in a card game". */
  ownedIn: Record<Family, number>;
  hoursIn: Record<Family, number>;
  /** Hours sunk into games that cost nothing. */
  freeHours: number;
  /** Median hours per owned game. */
  medianHours: number;
};

const LIBRARY_KEY = "sidequest:library";
const PROFILE_KEY = "sidequest:profile";
const BLACKLIST_KEY = "sidequest:blacklist";

export const GENRE_OPTIONS = [
  "Action",
  "RPG",
  "Story-rich",
  "Open world",
  "Shooter",
  "Strategy",
  "Roguelike",
  "Metroidvania",
  "Cozy / relaxing",
  "Multiplayer",
  "Indie",
  "Soulslike",
] as const;

/**
 * The stored value of a stated taste — English, always. It is a key the engine
 * and the model both match on, so it is data; `d.profile.taste.genres` holds
 * what the chip actually says on screen.
 */
export type Genre = (typeof GENRE_OPTIONS)[number];

/**
 * The shelf's own tag vocabulary, most common first.
 *
 * This is the only thing about the library that ever leaves the browser: the
 * words, not the games. The shelf search and the draw's typed mood both send it
 * and both apply the answer locally, which is why a 900-game account costs
 * exactly the same prompt as the ten-game demo — and why neither can come back
 * naming a game the player does not own.
 */
export function vocabularyOf(library: { tags?: string[] }[]): string[] {
  const counts = new Map<string, number>();
  for (const g of library) {
    for (const t of g.tags ?? []) {
      const tag = t.trim();
      if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

function cover(appid: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

/**
 * Portrait art, the shape a cartridge label wants. Derived from the appid at
 * render time rather than stored, so libraries imported before the redesign
 * get it for free. Not every appid has one — callers fall back to the name.
 */
export function portraitFor(appid: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
}

/**
 * The wide key art. The verdict panel is one game filling the frame, and this
 * is the only Steam asset shaped for that. Rarer than the header, so callers
 * fall back to `coverUrl` and then to type.
 */
export function heroFor(appid: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_hero.jpg`;
}

/** The 460x215 header — the right weight for a thumbnail in a row. */
export function headerFor(appid: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

// Used when the player hasn't imported a real library yet, so the picker still
// demos end-to-end. Mirrors the mock Steam import, tags included, so the scoring
// engine behaves exactly as it would on a real enriched library.
export const SAMPLE_LIBRARY: StoredGame[] = [
  { appid: 1086940, name: "Baldur's Gate 3", playtimeMin: 6180, coverUrl: cover(1086940), recentMin: 540, tags: ["RPG", "Choices Matter", "Story Rich", "Turn-Based Combat", "CRPG", "Adventure"] },
  { appid: 1245620, name: "Elden Ring", playtimeMin: 4720, coverUrl: cover(1245620), recentMin: 220, tags: ["Souls-like", "Open World", "Difficult", "RPG", "Dark Fantasy", "Action"] },
  { appid: 367520, name: "Hollow Knight", playtimeMin: 1490, coverUrl: cover(367520), tags: ["Metroidvania", "Souls-like", "Platformer", "Difficult", "Atmospheric", "Indie"] },
  { appid: 1091500, name: "Cyberpunk 2077", playtimeMin: 320, coverUrl: cover(1091500), tags: ["Cyberpunk", "Open World", "RPG", "Story Rich", "Atmospheric", "Singleplayer"] },
  { appid: 1174180, name: "Red Dead Redemption 2", playtimeMin: 2880, coverUrl: cover(1174180), tags: ["Open World", "Story Rich", "Adventure", "Western", "Realistic", "Singleplayer"] },
  { appid: 105600, name: "Terraria", playtimeMin: 940, coverUrl: cover(105600), tags: ["Sandbox", "Building", "Survival", "Crafting", "Co-op", "Pixel Graphics"] },
  { appid: 292030, name: "The Witcher 3: Wild Hunt", playtimeMin: 5210, coverUrl: cover(292030), tags: ["Open World", "RPG", "Story Rich", "Atmospheric", "Choices Matter", "Fantasy"] },
  { appid: 1145360, name: "Hades", playtimeMin: 1130, coverUrl: cover(1145360), tags: ["Roguelike", "Action Roguelike", "Fast-Paced", "Difficult", "Great Soundtrack", "Indie"] },
  { appid: 271590, name: "Grand Theft Auto V", playtimeMin: 760, coverUrl: cover(271590), tags: ["Open World", "Action", "Multiplayer", "Crime", "Shooter", "Third Person"] },
  { appid: 413150, name: "Stardew Valley", playtimeMin: 2010, coverUrl: cover(413150), tags: ["Farming Sim", "Relaxing", "Pixel Graphics", "Sandbox", "Casual", "Simulation"] },
];

export function saveLibrary(games: StoredGame[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(games));
}

export function loadLibrary(): StoredGame[] | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LIBRARY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    // Back-compat: libraries stored before tags existed have no `tags` field.
    // Normalise here so nothing downstream has to guard for it — the picker's
    // "missing tags" affordance then offers to re-enrich them.
    return (parsed as StoredGame[]).map((g) => ({
      ...g,
      tags: Array.isArray(g.tags) ? g.tags : [],
    }));
  } catch {
    return null;
  }
}

/**
 * Games whose tags need (re)reading: none at all, or read under an older
 * rule. The enricher's queue.
 */
export function untaggedAppids(library: StoredGame[]): number[] {
  return library
    .filter((g) => !g.tags?.length || (g.tagsV ?? 1) < TAGS_VERSION)
    .map((g) => g.appid);
}

/** Merge freshly fetched tags into the stored library and persist. */
export function applyTags(tagsByAppid: Record<number, string[]>): StoredGame[] {
  const current = loadLibrary() ?? [];
  const next = current.map((g) => {
    const tags = tagsByAppid[g.appid];
    // A game the sources know nothing about is stamped too: otherwise it
    // stays in the queue and every visit offers to read it again.
    if (!(g.appid in tagsByAppid)) return g;
    return tags?.length ? { ...g, tags, tagsV: TAGS_VERSION } : { ...g, tagsV: TAGS_VERSION };
  });
  saveLibrary(next);
  return next;
}

// Append a manually-added game if it isn't already in the library, and persist.
// Returns the updated library.
export function addGameToLibrary(game: {
  appid: number;
  name: string;
  coverUrl: string;
}): StoredGame[] {
  const current = loadLibrary() ?? [];
  if (current.some((g) => g.appid === game.appid)) return current;
  const next = [
    ...current,
    {
      appid: game.appid,
      name: game.name,
      coverUrl: game.coverUrl,
      playtimeMin: 0,
      added: true,
      // Enriched on the next tag pass, like any other untagged game.
      tags: [],
    },
  ];
  saveLibrary(next);
  return next;
}

// ----- Blacklist: games the player never wants recommended again -----
// Kept separate from the library so hiding a game from the picker doesn't remove
// it from their actual Steam library view.

export function loadBlacklist(): number[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(BLACKLIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}

export function addToBlacklist(appid: number): number[] {
  const next = [...new Set([...loadBlacklist(), appid])];
  if (typeof window !== "undefined") {
    localStorage.setItem(BLACKLIST_KEY, JSON.stringify(next));
  }
  return next;
}

export function removeFromBlacklist(appid: number): number[] {
  const next = loadBlacklist().filter((id) => id !== appid);
  if (typeof window !== "undefined") {
    localStorage.setItem(BLACKLIST_KEY, JSON.stringify(next));
  }
  return next;
}

export function computeBacklogStats(library: StoredGame[]): BacklogStats {
  const total = library.length;
  const played = library.filter((g) => g.playtimeMin > 0).length;
  const neverPlayed = library.filter((g) => g.playtimeMin === 0).length;
  const barelyPlayed = library.filter(
    (g) => g.playtimeMin > 0 && g.playtimeMin < 120
  ).length;
  const totalMin = library.reduce((s, g) => s + g.playtimeMin, 0);
  const totalHours = Math.round(totalMin / 60);
  const hours = (min: number) => Math.round(min / 60);

  const byHours = [...library].sort((a, b) => b.playtimeMin - a.playtimeMin);
  const top = byHours[0];
  const topGame =
    top && top.playtimeMin > 0
      ? { name: top.name, hours: hours(top.playtimeMin) }
      : undefined;
  const podium = byHours
    .filter((g) => g.playtimeMin > 0)
    .slice(0, 3)
    .map((g) => ({ name: g.name, hours: hours(g.playtimeMin) }));
  const podiumMin = byHours.slice(0, 3).reduce((s, g) => s + g.playtimeMin, 0);
  const podiumShare = totalMin > 0 ? podiumMin / totalMin : 0;

  const never = library.filter((g) => g.playtimeMin === 0);
  const shelfOfShame = never.slice(0, 6).map((g) => g.name);

  // Most frequent meaningful tag — only once it actually recurs, so a two-game
  // coincidence never becomes "your genre".
  const counts = new Map<string, number>();
  for (const g of library) {
    for (const tag of g.tags ?? []) {
      if (!isGenericTag(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const genres = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
  const topTag = genres[0] && genres[0].count >= 3 ? genres[0] : undefined;

  const tried = library
    .filter((g) => g.playtimeMin > 0)
    .sort((a, b) => a.playtimeMin - b.playtimeMin)[0];
  const shortestTry = tried ? { name: tried.name, minutes: tried.playtimeMin } : undefined;

  // The biggest thing still sealed: the never-launched game whose top four
  // tags carry the biggest "big" tag. The tag is kept so the joke can say
  // what kind of big.
  let bigUnopened: BacklogStats["bigUnopened"];
  let bigRank = BIG_TAGS.length;
  for (const g of never) {
    for (const t of (g.tags ?? []).slice(0, 4)) {
      const rank = BIG_TAGS.indexOf(t.trim().toLowerCase());
      if (rank !== -1 && rank < bigRank) {
        bigRank = rank;
        bigUnopened = { name: g.name, kind: t };
      }
    }
  }

  const coopUnopened = never
    .filter((g) => familiesOf(g.tags ?? []).includes("multiplayer"))
    .slice(0, 3)
    .map((g) => g.name);

  const recentMin = library.reduce((s, g) => s + (g.recentMin ?? 0), 0);
  const recentHours = Math.round(recentMin / 60);
  const recentGames = [...library]
    .filter((g) => (g.recentMin ?? 0) > 0)
    .sort((a, b) => (b.recentMin ?? 0) - (a.recentMin ?? 0))
    .slice(0, 3)
    .map((g) => ({ name: g.name, hours: Math.max(1, hours(g.recentMin ?? 0)) }));

  const ownedIn: Record<Family, number> = { story: 0, roguelike: 0, multiplayer: 0, strategy: 0 };
  const hoursIn: Record<Family, number> = { story: 0, roguelike: 0, multiplayer: 0, strategy: 0 };
  let freeMin = 0;
  for (const g of library) {
    for (const f of familiesOf(g.tags ?? [])) {
      ownedIn[f] += 1;
      hoursIn[f] += g.playtimeMin;
    }
    if ((g.tags ?? []).some((t) => t.trim().toLowerCase() === "free to play")) {
      freeMin += g.playtimeMin;
    }
  }
  for (const f of Object.keys(hoursIn) as Family[]) hoursIn[f] = hours(hoursIn[f]);

  const sortedMin = library.map((g) => g.playtimeMin).sort((a, b) => a - b);
  const mid = Math.floor(sortedMin.length / 2);
  const medianMin = sortedMin.length
    ? sortedMin.length % 2
      ? sortedMin[mid]
      : (sortedMin[mid - 1] + sortedMin[mid]) / 2
    : 0;

  return {
    total,
    played,
    neverPlayed,
    barelyPlayed,
    totalHours,
    topGame,
    podium,
    podiumShare,
    topTag,
    genres,
    shelfOfShame,
    shortestTry,
    bigUnopened,
    coopUnopened,
    recentHours,
    recentGames,
    ownedIn,
    hoursIn,
    freeHours: hours(freeMin),
    medianHours: Math.round((medianMin / 60) * 10) / 10,
  };
}

// Merge so updating one field (e.g. genres) never wipes another (e.g. steamId).
export function saveProfile(patch: Partial<StoredProfile>) {
  if (typeof window === "undefined") return;
  const next = { ...loadProfile(), ...patch };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
}

export function loadProfile(): StoredProfile {
  if (typeof window === "undefined") return { favoriteGenres: [] };
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return { favoriteGenres: [] };
  try {
    const parsed = JSON.parse(raw) as StoredProfile;
    return { favoriteGenres: parsed.favoriteGenres ?? [], steamId: parsed.steamId };
  } catch {
    return { favoriteGenres: [] };
  }
}
