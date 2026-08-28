import type { Locale } from "./locale";

/**
 * The shelf.
 *
 * Its one confusing thing was that the same text box did two different jobs —
 * match a name, or describe a feeling to the model — with nothing on screen
 * saying which was happening. The copy here separates them explicitly.
 */

const en = {
  eyebrow: "Shelf",
  title: "Everything you own",
  count: (n: number) => `${n} games`,
  untagged: (n: number) => `${n} without tags`,
  demo: "demo shelf",

  resync: "Re-sync from Steam",
  add: "Add a game",

  search: {
    placeholder: "Find a game by name…",
    or: "Or describe what you are after and let it read the shelf for you.",
    ask: "Ask the shelf",
    asking: "Reading…",
    tooShort: "Three letters, minimum.",
  },

  sort: {
    label: "Sort",
    playtime: "Most played",
    name: "A to Z",
  },

  filter: {
    title: "What it understood",
    tags: "Tags",
    unplayed: "never launched",
    /**
     * The engine's enum, said in words — "short sessions", never the raw
     * "sessions short" that leaked through when the label interpolated it.
     * Annotated `: string` so the inferred type is not a literal union the
     * French side then fails to match.
     */
    session: (fit: "short" | "long"): string =>
      fit === "short" ? "short sessions" : "long sessions",
    relaxed: "Nothing matched all of it, so it loosened the request.",
    clear: "Clear",
    failed: (why: string) =>
      `No reading — ${why}. The shelf still searches by name, which is what you are looking at.`,
  },

  results: {
    none: "Nothing on the shelf matches that.",
    count: (n: number) => (n === 1 ? "1 game" : `${n} games`),
  },

  hours: (h: number) => `${h} h`,
  never: "never launched",

  empty: {
    title: "Nothing on the shelf",
    line: "Import your Steam library and everything you own turns up here.",
    cta: "Connect Steam",
  },
};

const fr: typeof en = {
  eyebrow: "Étagère",
  title: "Tout ce que tu possèdes",
  count: (n: number) => `${n} jeux`,
  untagged: (n: number) => `${n} sans tags`,
  demo: "étagère de démo",

  resync: "Resynchroniser depuis Steam",
  add: "Ajouter un jeu",

  search: {
    placeholder: "Trouver un jeu par son nom…",
    or: "Ou décris ce que tu cherches et laisse-le lire l'étagère pour toi.",
    ask: "Demander à l'étagère",
    asking: "Lecture…",
    tooShort: "Trois lettres, minimum.",
  },

  sort: {
    label: "Tri",
    playtime: "Les plus joués",
    name: "De A à Z",
  },

  filter: {
    title: "Ce qu'il a compris",
    tags: "Tags",
    unplayed: "jamais lancés",
    session: (fit: "short" | "long") =>
      fit === "short" ? "sessions courtes" : "sessions longues",
    relaxed: "Rien ne cochait tout, alors il a relâché la demande.",
    clear: "Effacer",
    failed: (why: string) =>
      `Pas de lecture — ${why}. L'étagère cherche toujours par nom, et c'est ce que tu regardes.`,
  },

  results: {
    none: "Rien sur l'étagère ne correspond.",
    count: (n: number) => (n === 1 ? "1 jeu" : `${n} jeux`),
  },

  hours: (h: number) => `${h} h`,
  never: "jamais lancé",

  empty: {
    title: "Rien sur l'étagère",
    line: "Importe ta bibliothèque Steam et tout ce que tu possèdes apparaît ici.",
    cta: "Connecter Steam",
  },
};

export const shelf: Record<Locale, typeof en> = { en, fr };
