import type { Locale } from "./locale";
import type { AiFailCode } from "@/lib/ai-fail";
import type { SteamFailCode } from "@/lib/steam";

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

  // Why an AI panel has nothing to show. Each screen wraps one of these in its
  // own sentence ("No reading — ${why}. …"), so they read as a clause, lower
  // case, no full stop. The code comes from lib/ai-fail.ts; the English log
  // string behind it never reaches a screen.
  aiFail: {
    off: "the AI is off on this deployment",
    quota: "today's AI budget is spent",
    unreachable: "the model did not answer",
    unusable: "the model answered with nothing usable",
    tooShort: "there was too little to read",
    empty: "there was nothing to read from",
  } satisfies Record<AiFailCode, string>,

  // Steam import failures. Full sentences: they are the whole message.
  steamFail: {
    emptyInput: "Enter your SteamID or profile URL.",
    vanity: "Could not resolve that Steam profile name.",
    notFound: "Steam profile not found — check the ID or URL.",
    private:
      "This Steam profile is private. In Steam → Edit Profile → Privacy Settings, set ‘My profile’ and ‘Game details’ to Public, then try again.",
    gamesPrivate:
      "Your profile is public but its game details are private. In Steam → Edit Profile → Privacy Settings, set ‘Game details’ to Public, then try again.",
    api: "Steam did not answer. Try again in a minute.",
  } satisfies Record<SteamFailCode, string>,

  install: { pitch: "Install SideQuest", install: "Install", dismiss: "Dismiss" },

  // What the OS shows once the app is installed: the store-style description,
  // the long-press shortcuts, the install-dialog screenshots.
  pwa: {
    description:
      "Tonight's game, picked from your own Steam shelf by mood and time — and a note of where you left off, for next time.",
    shortcuts: {
      draw: { name: "Run a draw", short: "Draw", description: "Pick tonight's game" },
      shelf: { name: "Open the shelf", short: "Shelf", description: "Browse the library" },
      saves: { name: "Read the saves", short: "Saves", description: "Where you left off" },
    },
    screenshots: {
      desktop: "The verdict, the settings and the shelf on a desktop",
      phone: "Tonight's draw on a phone",
    },
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

  aiFail: {
    off: "l'IA est coupée sur ce déploiement",
    quota: "le budget IA du jour est épuisé",
    unreachable: "le modèle n'a pas répondu",
    unusable: "le modèle a répondu à côté",
    tooShort: "il y avait trop peu à lire",
    empty: "il n'y avait rien à lire",
  },

  steamFail: {
    emptyInput: "Entre ton SteamID ou l'URL de ton profil.",
    vanity: "Impossible de retrouver ce nom de profil Steam.",
    notFound: "Profil Steam introuvable — vérifie l'ID ou l'URL.",
    private:
      "Ce profil Steam est privé. Dans Steam → Modifier le profil → Paramètres de confidentialité, passe « Mon profil » et « Détails des jeux » en Public, puis réessaie.",
    gamesPrivate:
      "Ton profil est public mais les détails des jeux sont privés. Dans Steam → Modifier le profil → Paramètres de confidentialité, passe « Détails des jeux » en Public, puis réessaie.",
    api: "Steam n'a pas répondu. Réessaie dans une minute.",
  },

  install: { pitch: "Installer SideQuest", install: "Installer", dismiss: "Fermer" },

  pwa: {
    description:
      "Le jeu de ce soir, choisi dans ta propre étagère Steam selon ton humeur et ton temps — et une note d'où tu t'es arrêté, pour la prochaine fois.",
    shortcuts: {
      draw: { name: "Lancer un tirage", short: "Tirage", description: "Choisir le jeu de ce soir" },
      shelf: { name: "Ouvrir l'étagère", short: "Étagère", description: "Parcourir la bibliothèque" },
      saves: { name: "Lire les reprises", short: "Reprises", description: "Où tu en étais" },
    },
    screenshots: {
      desktop: "Le verdict, les réglages et l'étagère sur un écran",
      phone: "Le tirage de ce soir sur un téléphone",
    },
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
