import type { Locale } from "./locale";

/**
 * Saves.
 *
 * The old screen listed pulls. But "where did I leave off" is a question about
 * Hollow Knight, not about a Tuesday — three sittings on one game are three
 * lines about one save file, and showing them as three sibling rows was the
 * reason the screen did not read. So the list is grouped by game now, and the
 * wording follows: a card is a game, and the draws are its history.
 */

const en = {
  eyebrow: "Saves",
  title: "Where you left off",
  lede: "Every draw lands here with whatever you wrote afterwards. Weeks later, that note is the only thing standing between you and starting over.",

  counts: (games: number, draws: number) =>
    `${games} ${games === 1 ? "game" : "games"} · ${draws} ${draws === 1 ? "draw" : "draws"}`,

  clear: "Clear history",
  clearConfirm: "Delete everything?",
  clearYes: "Yes, delete",
  clearNo: "Keep it",

  played: "Played",
  skipped: "Not played",
  lastDrawn: (ago: string) => `Last drawn ${ago}`,
  drawCount: (n: number) => (n === 1 ? "1 draw" : `${n} draws`),

  noteTitle: "Your note",
  noNote: "No note left on this one.",

  readBack: {
    cta: "Where was I",
    notes: (n: number) => (n === 1 ? "1 note" : `${n} notes`),
    reading: "Reading your notes back…",
    next: "Next",
    failed: (why: string) =>
      `Could not read it back — ${why}. Your own note is above, which is the copy that matters.`,
  },

  history: {
    show: "All draws",
    hide: "Hide draws",
  },

  ago: {
    now: "just now",
    minutes: (n: number) => `${n} min ago`,
    hours: (n: number) => `${n} h ago`,
    days: (n: number) => `${n} d ago`,
  },

  empty: {
    title: "Nothing saved yet",
    line: "Every game the board picks lands here, with the note you leave on it.",
    cta: "Run a draw",
  },
};

const fr: typeof en = {
  eyebrow: "Reprises",
  title: "Où tu en étais",
  lede: "Chaque tirage atterrit ici avec ce que tu as écrit après. Des semaines plus tard, cette note est la seule chose entre toi et un redémarrage à zéro.",

  counts: (games: number, draws: number) =>
    `${games} ${games === 1 ? "jeu" : "jeux"} · ${draws} ${draws === 1 ? "tirage" : "tirages"}`,

  clear: "Vider l'historique",
  clearConfirm: "Tout supprimer ?",
  clearYes: "Oui, supprimer",
  clearNo: "Garder",

  played: "Joué",
  skipped: "Pas joué",
  lastDrawn: (ago: string) => `Dernier tirage ${ago}`,
  drawCount: (n: number) => (n === 1 ? "1 tirage" : `${n} tirages`),

  noteTitle: "Ta note",
  noNote: "Aucune note sur celui-là.",

  readBack: {
    cta: "J'en étais où",
    notes: (n: number) => (n === 1 ? "1 note" : `${n} notes`),
    reading: "Relecture de tes notes…",
    next: "Ensuite",
    failed: (why: string) =>
      `Relecture impossible — ${why}. Ta note est juste au-dessus, et c'est elle qui compte.`,
  },

  history: {
    show: "Tous les tirages",
    hide: "Masquer les tirages",
  },

  ago: {
    now: "à l'instant",
    minutes: (n: number) => `il y a ${n} min`,
    hours: (n: number) => `il y a ${n} h`,
    days: (n: number) => `il y a ${n} j`,
  },

  empty: {
    title: "Rien d'enregistré",
    line: "Chaque jeu que le plateau choisit atterrit ici, avec la note que tu lui laisses.",
    cta: "Lancer un tirage",
  },
};

export const saves: Record<Locale, typeof en> = { en, fr };
