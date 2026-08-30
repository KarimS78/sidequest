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

async function getJson(url: string, timeoutMs = 10000) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
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
// Steam's own API exposes no tags. The store PAGE does: every app page lists
// its community tags, most-voted first, as `app_tag` links — the same list
// SteamSpy republishes, from the host that owns it. It is read first.
// SteamSpy is the fallback, the storefront's genres + categories the last
// resort. Every call has a timeout: a lookup that hangs is a chunk that
// never finishes, and the enricher's bar stays at 0 with no error anywhere.
//
// Found the hard way on 30/08/2026: Karim's 489-game shelf had zero tags.
// Read from Vercel, SteamSpy did not answer, `getJson` had no timeout, and
// the first chunk was still "running" when the function limit killed it.

/**
 * How many tags we keep per game. Was 6 — enough for a genre, not for a
 * mood: "Atmospheric", "Relaxing" and "Story Rich" usually sit between eighth
 * and twelfth place, and the engine weights by rank precisely so it can
 * afford to keep them.
 */
const TAGS_PER_GAME = 15;

/** A page lookup that has not answered in this long is not going to. */
const TAG_TIMEOUT_MS = 6000;

/** Store pages are served happily at this pace; SteamSpy asks for ~1/s. */
const TAG_FETCH_DELAY_MS = 150;

/** Lookups in flight at once inside a batch. */
const TAG_CONCURRENCY = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Age gate: without these cookies a mature game's page is a birthday form. */
const STORE_PAGE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; SideQuest/1.0)",
  "Accept-Language": "en",
  Cookie: "birthtime=568022401; lastagecheckage=1-January-1988; wants_mature_content=1",
};

/** The community tags on a store page, most-voted first. */
async function tagsFromStorePage(appid: number): Promise<string[]> {
  const res = await fetch(`https://store.steampowered.com/app/${appid}/?l=english`, {
    headers: STORE_PAGE_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(TAG_TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const html = await res.text();
  // A redirect to the front page (delisted app) has no app_tag at all.
  const tags: string[] = [];
  const re = /class="app_tag"[^>]*>([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && tags.length < TAGS_PER_GAME) {
    const tag = m[1].replace(/\s+/g, " ").trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

async function tagsFromSteamSpy(appid: number): Promise<string[]> {
  const data = await getJson(
    `https://steamspy.com/api.php?request=appdetails&appid=${appid}`,
    TAG_TIMEOUT_MS
  );
  // `tags` is {tag: votes} when known, and [] (not {}) when SteamSpy has none.
  const tags = data?.tags;
  if (!tags || Array.isArray(tags)) return [];
  return Object.entries(tags as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TAGS_PER_GAME)
    .map(([tag]) => tag);
}

/**
 * Storefront categories worth keeping, spelled the way community tags spell
 * them. The rest ("Steam Achievements", "Full controller support", "Remote
 * Play on TV") describe the store listing, not the game, and a shelf tagged
 * with them matches no mood anyone has.
 */
const STORE_CATEGORY_AS_TAG: Record<string, string> = {
  "Single-player": "Singleplayer",
  "Multi-player": "Multiplayer",
  "Co-op": "Co-op",
  "Online Co-op": "Online Co-Op",
  "LAN Co-op": "Local Co-Op",
  "Shared/Split Screen Co-op": "Local Co-Op",
  "Shared/Split Screen": "Split Screen",
  PvP: "PvP",
  "Online PvP": "PvP",
  MMO: "Massively Multiplayer",
  "Cross-Platform Multiplayer": "Multiplayer",
  "VR Supported": "VR",
  "VR Only": "VR",
};

async function tagsFromStore(appid: number): Promise<string[]> {
  const data = await getJson(
    `https://store.steampowered.com/api/appdetails?appids=${appid}&l=english&filters=genres,categories`,
    TAG_TIMEOUT_MS
  );
  const entry = data?.[String(appid)];
  if (!entry?.success || !entry.data) return [];
  const genres = (entry.data.genres ?? []) as { description?: string }[];
  const categories = (entry.data.categories ?? []) as { description?: string }[];
  const out: string[] = [];
  for (const g of genres) if (g.description && !out.includes(g.description)) out.push(g.description);
  for (const c of categories) {
    const tag = c.description ? STORE_CATEGORY_AS_TAG[c.description] : undefined;
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, TAGS_PER_GAME);
}

/**
 * Tags for one game. Never throws — a game we can't characterise is still a
 * perfectly importable game, it just scores on playtime signals alone.
 */
export async function fetchGameTags(appid: number): Promise<string[]> {
  for (const source of [tagsFromStorePage, tagsFromSteamSpy, tagsFromStore]) {
    try {
      const tags = await source(appid);
      if (tags.length) return tags;
    } catch {
      // next source
    }
  }
  return [];
}

/**
 * Throttled tag lookup for a batch of appids, a few in flight at once.
 * Callers drive this in chunks so the UI can show progress and no single
 * request runs long. Returns a map keyed by appid; failed games map to [].
 */
export async function fetchTagsForBatch(
  appids: number[]
): Promise<Record<number, string[]>> {
  const out: Record<number, string[]> = {};
  for (let i = 0; i < appids.length; i += TAG_CONCURRENCY) {
    if (i > 0) await sleep(TAG_FETCH_DELAY_MS);
    const group = appids.slice(i, i + TAG_CONCURRENCY);
    const tags = await Promise.all(group.map((id) => fetchGameTags(id)));
    group.forEach((id, j) => {
      out[id] = tags[j];
    });
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
