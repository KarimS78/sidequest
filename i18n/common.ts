import type { Locale } from "./locale";

// Shared vocabulary: the words that appear on more than one screen.
//
// Tone, both languages: a friend who knows your library, not a product. Short
// sentences, no "unlock your potential", no exclamation marks. French is the
// tutoiement, and it is written as French — never a word-for-word carry-over of
// the English, which is how "Pull" would have become "Tirer sur".

const en = {
  brand: "SideQuest",
  tagline: "Never forget where you left off",

  // Session lengths. The mono label is what sits inside the segmented control,
  // so it stays short enough not to wrap at 360px.
  time: {
    short: { label: "30 MIN", full: "half an hour" },
    medium: { label: "1–2 H", full: "an hour or two" },
    long: { label: "EVENING", full: "a whole evening" },
  },

  mood: {
    chill: { label: "Chill", hint: "nothing that can kill you" },
    story: { label: "Story", hint: "somewhere to disappear into" },
    challenge: { label: "Challenge", hint: "something that fights back" },
    quick: { label: "Quick", hint: "in and out" },
  },

  moodPlaceholder: "…or type it: “cosy but not boring”",

  actions: {
    draw: "PULL",
    drawAgain: "PULL AGAIN",
    dice: "Or let the clock decide",
    launch: "Launch on Steam",
    reroll: "Not this one",
    never: "Never again",
    played: "Played",
    markPlayed: "Mark as played",
    cancel: "Cancel",
    save: "Save",
    close: "Close",
    back: "Back",
    retry: "Try again",
  },

  // Score component names. The landing explains them; the verdict badges use
  // the same six words, so a badge is never a term the visitor has not met.
  components: {
    mood: "MOOD",
    session: "SESSION",
    momentum: "MOMENTUM",
    rediscovery: "REDISCOVERY",
    taste: "TASTE",
    repeat: "NO REPEATS",
  },

  units: {
    hours: (h: number) => `${h} H`,
    games: (n: number) => (n === 1 ? "1 game" : `${n} games`),
    onTheClock: (h: number) => `${h} H ON THE CLOCK`,
  },

  empty: {
    noLibrary: "There is nothing on your shelf yet.",
    noLibraryCta: "Load the demo library",
    importCta: "Import from Steam",
  },

  langSwitch: "Language",
};

const fr: typeof en = {
  brand: "SideQuest",
  tagline: "Ne perds plus jamais le fil",

  time: {
    short: { label: "30 MIN", full: "une demi-heure" },
    medium: { label: "1–2 H", full: "une heure ou deux" },
    long: { label: "SOIRÉE", full: "toute une soirée" },
  },

  mood: {
    chill: { label: "Peinard", hint: "rien qui puisse te tuer" },
    story: { label: "Histoire", hint: "un endroit où disparaître" },
    challenge: { label: "Défi", hint: "un truc qui répond" },
    quick: { label: "Vite fait", hint: "j'entre, je sors" },
  },

  moodPlaceholder: "…ou écris-le : « cosy mais pas mou »",

  actions: {
    draw: "TIRER",
    drawAgain: "RELANCER",
    dice: "Ou laisse l'heure qu'il est décider",
    launch: "Lancer sur Steam",
    reroll: "Pas celui-là",
    never: "Plus jamais",
    played: "Joué",
    markPlayed: "Marquer comme joué",
    cancel: "Annuler",
    save: "Enregistrer",
    close: "Fermer",
    back: "Retour",
    retry: "Réessayer",
  },

  components: {
    mood: "HUMEUR",
    session: "SESSION",
    momentum: "ÉLAN",
    rediscovery: "REDÉCOUVERTE",
    taste: "GOÛTS",
    repeat: "SANS REDITE",
  },

  units: {
    hours: (h: number) => `${h} H`,
    games: (n: number) => (n === 1 ? "1 jeu" : `${n} jeux`),
    onTheClock: (h: number) => `${h} H AU COMPTEUR`,
  },

  empty: {
    noLibrary: "Ton étagère est encore vide.",
    noLibraryCta: "Charger la bibliothèque de démo",
    importCta: "Importer depuis Steam",
  },

  langSwitch: "Langue",
};

export const common: Record<Locale, typeof en> = { en, fr };

const navEn = {
  tabs: {
    play: "Tonight",
    shelf: "Shelf",
    saves: "Saves",
    you: "You",
  },
  aria: "Main",
  home: "Home",
};

const navFr: typeof navEn = {
  tabs: {
    play: "Ce soir",
    shelf: "Étagère",
    saves: "Reprises",
    you: "Profil",
  },
  aria: "Principale",
  home: "Accueil",
};

export const nav: Record<Locale, typeof navEn> = { en: navEn, fr: navFr };
