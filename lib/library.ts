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
   * Community tags (SteamSpy, storefront genres as fallback), most-voted first.
   * The scoring engine's main signal. Always an array after `loadLibrary` —
   * libraries stored before tags existed read back as [] and can be re-enriched.
   */
  tags: string[];
};

export type StoredProfile = {
  /** Genres the player says they enjoy, used as a recommendation signal. */
  favoriteGenres: string[];
  /** The connected SteamID64, kept so we can refresh data later. */
  steamId?: string;
};

/** Derived backlog metrics — feeds the Roast (and, later, Gaming DNA). */
export type BacklogStats = {
  total: number;
  played: number; // games with any playtime
  neverPlayed: number;
  barelyPlayed: number; // started but under 2h
  totalHours: number;
  topGame?: { name: string; hours: number };
  /** The tag that shows up most across the library — their de-facto genre. */
  topTag?: { tag: string; count: number };
  /** A few never-played game names, for flavour. */
  shelfOfShame: string[];
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

/** Games we have no tags for — the re-enrichment queue. */
export function untaggedAppids(library: StoredGame[]): number[] {
  return library.filter((g) => !g.tags?.length).map((g) => g.appid);
}

/** Merge freshly fetched tags into the stored library and persist. */
export function applyTags(tagsByAppid: Record<number, string[]>): StoredGame[] {
  const current = loadLibrary() ?? [];
  const next = current.map((g) => {
    const tags = tagsByAppid[g.appid];
    return tags?.length ? { ...g, tags } : g;
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
  const totalHours = Math.round(
    library.reduce((s, g) => s + g.playtimeMin, 0) / 60
  );
  const top = [...library].sort((a, b) => b.playtimeMin - a.playtimeMin)[0];
  const topGame =
    top && top.playtimeMin > 0
      ? { name: top.name, hours: Math.round(top.playtimeMin / 60) }
      : undefined;
  const shelfOfShame = library
    .filter((g) => g.playtimeMin === 0)
    .slice(0, 6)
    .map((g) => g.name);

  // Most frequent tag across the library — only meaningful once tags exist and
  // it actually recurs, so a two-game coincidence never becomes "your genre".
  const counts = new Map<string, number>();
  for (const g of library) {
    for (const tag of g.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const [tag, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const topTag = tag && count >= 3 ? { tag, count } : undefined;

  return {
    total,
    played,
    neverPlayed,
    barelyPlayed,
    totalHours,
    topGame,
    topTag,
    shelfOfShame,
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
