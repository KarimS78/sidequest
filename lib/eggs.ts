/**
 * The trophy case.
 *
 * Twelve things hidden in the app. The rule for every one of them: it has to
 * be a joke about the object on screen (a cartridge, a deck, a shelf) or a
 * line this audience has read a hundred times — never a random emoji rain.
 * Nothing here changes what the app does; the shelf works identically for
 * someone who finds none of them.
 *
 * Found trophies live in localStorage, listed in the profile, and never sync
 * anywhere: they are between the player and their own browser.
 */

export type EggId =
  | "konami"
  | "iddqd"
  | "xyzzy"
  | "blow"
  | "rrod"
  | "respects"
  | "answer"
  | "cake"
  | "barrelroll"
  | "kindly"
  | "nightowl"
  | "halflife";

export type Egg = {
  id: EggId;
  /** Shown once it is found. */
  name: string;
  /** The line the trophy card prints. */
  line: string;
  /** Shown while it is still locked — a nudge, never the answer. */
  hint: string;
};

export const EGGS: Egg[] = [
  {
    id: "konami",
    name: "Thirty lives",
    line: "Thirty lives. Still one backlog.",
    hint: "Some codes you never had to write down.",
  },
  {
    id: "iddqd",
    name: "Degreelessness mode",
    line: "God mode. The backlog cannot hurt you now.",
    hint: "Five letters that made you invincible in 1993.",
  },
  {
    id: "xyzzy",
    name: "A hollow voice",
    line: "A hollow voice says: fool.",
    hint: "The oldest magic word in the medium. Type it anywhere.",
  },
  {
    id: "blow",
    name: "The ritual",
    line: "Blew on the contacts. Works now.",
    hint: "It never actually helped. Do it to the gold strip anyway.",
  },
  {
    id: "rrod",
    name: "Three red lights",
    line: "Three red lights. Wiggle the cable, wait a year, try again.",
    hint: "Poke the deck's indicator lights until they disagree with you.",
  },
  {
    id: "respects",
    name: "Respects paid",
    line: "F. That cart served.",
    hint: "When a game is retired from the shelf, there is one key to press.",
  },
  {
    id: "answer",
    name: "The answer",
    line: "Forty-two carts. Don't panic.",
    hint: "A shelf of a very particular size.",
  },
  {
    id: "cake",
    name: "The cake",
    line: "The cake is a lie.",
    hint: "Search the shelf for something that isn't a game.",
  },
  {
    id: "barrelroll",
    name: "Barrel roll",
    line: "Do a barrel roll!",
    hint: "Peppy has been shouting it since 1997. Type what he says.",
  },
  {
    id: "kindly",
    name: "Would you kindly",
    line: "Would you kindly.",
    hint: "Press the mark in the corner. Politely. Three times.",
  },
  {
    id: "nightowl",
    name: "One more turn",
    line: "3am. One more turn, then.",
    hint: "Open the shelf at an hour you should not be awake.",
  },
  {
    id: "halflife",
    name: "Confirmed",
    line: "Half-Life 3 confirmed.",
    hint: "Search the shelf for the game that does not exist.",
  },
];

const KEY = "sq.trophies.v1";

export function loadFound(): EggId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids = new Set(EGGS.map((e) => e.id as string));
    return parsed.filter((id): id is EggId => typeof id === "string" && ids.has(id));
  } catch {
    return [];
  }
}

export function isFound(id: EggId): boolean {
  return loadFound().includes(id);
}

/**
 * Record a find and announce it. Returns false if it was already found, so
 * callers can skip re-running whatever visual effect goes with it.
 */
export function unlock(id: EggId): boolean {
  if (typeof window === "undefined") return false;
  const egg = EGGS.find((e) => e.id === id);
  if (!egg) return false;

  const found = loadFound();
  const isNew = !found.includes(id);
  if (isNew) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify([...found, id]));
    } catch {
      // private mode: the trophy is still announced, just not remembered
    }
  }

  window.dispatchEvent(new CustomEvent("sq:egg", { detail: { egg, isNew } }));
  return isNew;
}

export type EggEvent = CustomEvent<{ egg: Egg; isNew: boolean }>;
