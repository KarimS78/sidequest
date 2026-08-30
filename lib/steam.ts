// Steam Web API client (server-only).
// Real calls when STEAM_API_KEY is set; deterministic mock otherwise so the
// demo flow works on localhost without a key.

export type SteamGame = {
  appid: number;
  name: string;
  playtimeMin: number;
  coverUrl: string;
  /** Minutes played in the last 2 weeks (Steam "recently played"). 0 if none. */
  recentMin?: number;
  /** Community tags, most-voted first. The recommendation engine's main signal. */
  tags?: string[];
};

export type SteamProfile = {
  steamId: string;
  name: string;
  avatar: string;
  profileUrl: string;
  visibility: number; // 1 = private, 3 = public (community visibility state)
};

/**
 * Why an import failed, as a code the UI translates. The message on the error
 * itself is for the log; it used to be the message on the screen, in English,
 * whatever language the screen was in.
 */
export type SteamFailCode =
  | "emptyInput"
  | "vanity"
  | "notFound"
  | "private"
  | "gamesPrivate"
  | "api";

class SteamFail extends Error {
  constructor(
    public code: SteamFailCode,
    message: string
  ) {
    super(message);
  }
}

export type SteamImportResult =
  | { ok: true; profile: SteamProfile; games: SteamGame[]; isMock: boolean }
  | { ok: false; code: SteamFailCode; error: string };

const STEAMID64_RE = /^7656119\d{10}$/;

export function coverFor(appid: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

function apiKey() {
  return process.env.STEAM_API_KEY?.trim() || null;
}

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new SteamFail("api", `Steam API ${res.status}`);
  return res.json();
}

// Accepts a SteamID64, a full profile URL, or a vanity name.
function parseInput(raw: string) {
  const v = raw.trim().replace(/\/$/, "");
  const idMatch = v.match(/(7656119\d{10})/);
  if (idMatch) return { kind: "id" as const, value: idMatch[1] };
  const vanityMatch = v.match(/steamcommunity\.com\/id\/([^/]+)/i);
  if (vanityMatch) return { kind: "vanity" as const, value: vanityMatch[1] };
  if (STEAMID64_RE.test(v)) return { kind: "id" as const, value: v };
  return { kind: "vanity" as const, value: v };
}

async function resolveVanity(name: string, key: string): Promise<string> {
  const data = await getJson(
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(
      name
    )}`
  );
  if (data?.response?.success !== 1 || !data.response.steamid) {
    throw new SteamFail("vanity", "could not resolve vanity name");
  }
  return data.response.steamid as string;
}

async function fetchProfile(
  steamId: string,
  key: string
): Promise<SteamProfile> {
  const data = await getJson(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`
  );
  const p = data?.response?.players?.[0];
  if (!p) throw new SteamFail("notFound", "profile not found");
  return {
    steamId,
    name: p.personaname ?? "Unknown",
    avatar: p.avatarfull ?? "",
    profileUrl: p.profileurl ?? "",
    visibility: p.communityvisibilitystate ?? 1,
  };
}

async function fetchOwnedGames(
  steamId: string,
  key: string
): Promise<SteamGame[]> {
  const data = await getJson(
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`
  );
  const list = data?.response?.games;
  if (!Array.isArray(list)) {
    throw new SteamFail("gamesPrivate", "game details are private");
  }
  return list
    .map(
      (g: { appid: number; name: string; playtime_forever: number }): SteamGame => ({
        appid: g.appid,
        name: g.name,
        playtimeMin: g.playtime_forever ?? 0,
        coverUrl: coverFor(g.appid),
      })
    )
    .sort((a: SteamGame, b: SteamGame) => b.playtimeMin - a.playtimeMin);
}

// Steam's "recently played" — playtime over the last 2 weeks, keyed by appid.
// This is the strongest "what were you actually into lately" signal. Best-effort:
// a private/empty result just means no recent-play data, never a hard failure.
async function fetchRecentlyPlayed(
  steamId: string,
  key: string
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  try {
    const data = await getJson(
      `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${steamId}&format=json`
    );
    const list = data?.response?.games;
    if (Array.isArray(list)) {
      for (const g of list as { appid: number; playtime_2weeks?: number }[]) {
        if (g.appid && g.playtime_2weeks) map.set(g.appid, g.playtime_2weeks);
      }
    }
  } catch {
    // Ignore — recent-play data is a bonus, not required for import to succeed.
  }
  return map;
}

// ===== Community tags — the recommendation engine's main signal =====
//
// Steam's own API exposes no tags, so we read them from SteamSpy (free, no key,
// crowd-voted tags) and fall back to the storefront's genres + categories.
// Both are public endpoints and both are rate-limited, hence the throttle below.

/** How many tags we keep per game — enough to characterise it, cheap to store. */
const TAGS_PER_GAME = 6;

/** SteamSpy asks for ~1 request/second; 250ms is the practical floor. */
const TAG_FETCH_DELAY_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tagsFromSteamSpy(appid: number): Promise<string[]> {
  const data = await getJson(
    `https://steamspy.com/api.php?request=appdetails&appid=${appid}`
  );
  // `tags` is {tag: votes} when known, and [] (not {}) when SteamSpy has none.
  const tags = data?.tags;
  if (!tags || Array.isArray(tags)) return [];
  return Object.entries(tags as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TAGS_PER_GAME)
    .map(([tag]) => tag);
}

async function tagsFromStore(appid: number): Promise<string[]> {
  const data = await getJson(
    `https://store.steampowered.com/api/appdetails?appids=${appid}&l=english`
  );
  const entry = data?.[String(appid)];
  if (!entry?.success || !entry.data) return [];
  const genres = (entry.data.genres ?? []) as { description?: string }[];
  const categories = (entry.data.categories ?? []) as { description?: string }[];
  return [...genres, ...categories]
    .map((g) => g.description)
    .filter((d): d is string => Boolean(d))
    .slice(0, TAGS_PER_GAME);
}

/**
 * Tags for one game. Never throws — a game we can't characterise is still a
 * perfectly importable game, it just scores on playtime signals alone.
 */
export async function fetchGameTags(appid: number): Promise<string[]> {
  try {
    const tags = await tagsFromSteamSpy(appid);
    if (tags.length) return tags;
  } catch {
    // fall through to the storefront
  }
  try {
    return await tagsFromStore(appid);
  } catch {
    return [];
  }
}

/**
 * Sequential, throttled tag lookup for a batch of appids. Callers drive this in
 * chunks so the UI can show progress and no single request runs long enough to
 * time out. Returns a map keyed by appid; missing/failed games map to [].
 */
export async function fetchTagsForBatch(
  appids: number[]
): Promise<Record<number, string[]>> {
  const out: Record<number, string[]> = {};
  for (let i = 0; i < appids.length; i++) {
    if (i > 0) await sleep(TAG_FETCH_DELAY_MS);
    out[appids[i]] = await fetchGameTags(appids[i]);
  }
  return out;
}

// Storefront search — used to resolve a game *name* (manual search) to a real
// appid + cover. Public endpoint, no API key needed.
export type StoreHit = { appid: number; name: string; coverUrl: string };

export async function searchStore(term: string, limit = 5): Promise<StoreHit[]> {
  const q = term.trim();
  if (!q) return [];
  try {
    const data = await getJson(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
        q
      )}&l=english&cc=US`
    );
    const items = Array.isArray(data?.items) ? data.items : [];
    return items
      .filter((it: { type?: string; id?: number }) => it.type === "app" && it.id)
      .slice(0, limit)
      .map((it: { id: number; name: string }): StoreHit => ({
        appid: it.id,
        name: it.name,
        coverUrl: coverFor(it.id),
      }));
  } catch {
    return [];
  }
}

export async function importSteamLibrary(
  rawInput: string
): Promise<SteamImportResult> {
  const raw = rawInput?.trim();
  if (!raw) return { ok: false, code: "emptyInput", error: "empty input" };

  const key = apiKey();
  if (!key) return mockImport(raw);

  try {
    const parsed = parseInput(raw);
    const steamId =
      parsed.kind === "id"
        ? parsed.value
        : await resolveVanity(parsed.value, key);
    const profile = await fetchProfile(steamId, key);
    if (profile.visibility !== 3) {
      return { ok: false, code: "private", error: "profile is private" };
    }
    const games = await fetchOwnedGames(steamId, key);
    const recent = await fetchRecentlyPlayed(steamId, key);
    const withRecent = games.map((g) => ({ ...g, recentMin: recent.get(g.appid) ?? 0 }));
    return { ok: true, profile, games: withRecent, isMock: false };
  } catch (e) {
    return {
      ok: false,
      code: e instanceof SteamFail ? e.code : "api",
      error: e instanceof Error ? e.message : "Steam import failed.",
    };
  }
}

// ----- Mock (no API key) -----
// Tags mirror each game's real top Steam community tags, so the sample flow
// exercises the scoring engine exactly like an enriched real library would.
const MOCK_GAMES: SteamGame[] = [
  { appid: 1086940, name: "Baldur's Gate 3", playtimeMin: 6180, coverUrl: coverFor(1086940), recentMin: 540, tags: ["RPG", "Choices Matter", "Story Rich", "Turn-Based Combat", "CRPG", "Adventure"] },
  { appid: 1245620, name: "Elden Ring", playtimeMin: 4720, coverUrl: coverFor(1245620), recentMin: 220, tags: ["Souls-like", "Open World", "Difficult", "RPG", "Dark Fantasy", "Action"] },
  { appid: 367520, name: "Hollow Knight", playtimeMin: 1490, coverUrl: coverFor(367520), tags: ["Metroidvania", "Souls-like", "Platformer", "Difficult", "Atmospheric", "Indie"] },
  { appid: 1091500, name: "Cyberpunk 2077", playtimeMin: 320, coverUrl: coverFor(1091500), tags: ["Cyberpunk", "Open World", "RPG", "Story Rich", "Atmospheric", "Singleplayer"] },
  { appid: 1174180, name: "Red Dead Redemption 2", playtimeMin: 2880, coverUrl: coverFor(1174180), tags: ["Open World", "Story Rich", "Adventure", "Western", "Realistic", "Singleplayer"] },
  { appid: 105600, name: "Terraria", playtimeMin: 940, coverUrl: coverFor(105600), tags: ["Sandbox", "Building", "Survival", "Crafting", "Co-op", "Pixel Graphics"] },
  { appid: 292030, name: "The Witcher 3: Wild Hunt", playtimeMin: 5210, coverUrl: coverFor(292030), tags: ["Open World", "RPG", "Story Rich", "Atmospheric", "Choices Matter", "Fantasy"] },
  { appid: 1145360, name: "Hades", playtimeMin: 1130, coverUrl: coverFor(1145360), tags: ["Roguelike", "Action Roguelike", "Fast-Paced", "Difficult", "Great Soundtrack", "Indie"] },
  { appid: 271590, name: "Grand Theft Auto V", playtimeMin: 760, coverUrl: coverFor(271590), tags: ["Open World", "Action", "Multiplayer", "Crime", "Shooter", "Third Person"] },
  { appid: 413150, name: "Stardew Valley", playtimeMin: 2010, coverUrl: coverFor(413150), tags: ["Farming Sim", "Relaxing", "Pixel Graphics", "Sandbox", "Casual", "Simulation"] },
];

function mockImport(_raw: string): SteamImportResult {
  // Deliberately does NOT echo the user's input — this is sample data, not
  // their real account. Naming it after their profile would be misleading.
  return {
    ok: true,
    isMock: true,
    profile: {
      steamId: "—",
      name: "Sample Player",
      avatar: "",
      profileUrl: "https://steamcommunity.com/",
      visibility: 3,
    },
    games: MOCK_GAMES,
  };
}
