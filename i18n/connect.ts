import type { Locale } from "./locale";

/** Connecting Steam, adding games by hand, reading tags, and being offline. */

const en = {
  back: "Shelf",
  eyebrow: "Import",
  title: "Connect Steam",
  lede: "Bring in your real library and the hours already on it. No password, no OAuth — just the ID on a public profile.",

  demoMode: {
    title: "Demo mode",
    line: "No STEAM_API_KEY is configured, so this shows a sample shelf — not your real Steam account. Add a key to import your actual games.",
  },

  form: {
    label: "Your Steam profile",
    line: "Paste your SteamID64, your profile URL, or your custom URL name. The profile has to be public for playtime to be readable.",
    placeholder: "76561198… or steamcommunity.com/id/yourname",
    submit: "Import",
    preview: "Preview",
    pending: "Reading…",
    hint: "If you only know your name, steamid.io will find your SteamID64.",
  },

  imported: {
    mock: "Demo data — no key set, so this is a sample shelf.",
    connected: "Connected",
    games: (n: number) => `${n} games`,
    top: "By playtime",
    more: (n: number) => `+${n} more on the shelf`,
  },

  add: {
    title: "Add one by hand",
    line: "Steam is not your whole shelf. Add what you play on Epic, on a console, or just love — the board draws from those too.",
    placeholder: "Search a game — “God of War”, “Forza”…",
    searching: "Searching…",
    added: "On the shelf",
    addIt: "Add it",
    count: (n: number) => `${n} games`,
    countAdded: (n: number) => `${n} added by you`,
    cta: "Draw one",
  },

  tags: {
    title: "Tag data",
    line: (n: number) =>
      `SideQuest scores your games on their community tags — genre, pace, feel. ${n} ${
        n === 1 ? "game is" : "games are"
      } missing theirs.`,
    read: (n: number) => `Read ${n} ${n === 1 ? "tag set" : "tag sets"}`,
    progress: "throttled public API, a few seconds each",
    done: "Tags read — the board now scores on genre and feel, not just playtime.",
  },

  offline: {
    title: "No signal",
    line: "Your shelf is still here. Reconnect and SideQuest picks up where you left off.",
  },
};

const fr: typeof en = {
  back: "Étagère",
  eyebrow: "Import",
  title: "Connecter Steam",
  lede: "Récupère ta vraie bibliothèque et les heures déjà dessus. Pas de mot de passe, pas d'OAuth — juste l'identifiant d'un profil public.",

  demoMode: {
    title: "Mode démo",
    line: "Aucune STEAM_API_KEY n'est configurée, donc ceci affiche une étagère d'exemple — pas ton vrai compte Steam. Ajoute une clé pour importer tes jeux.",
  },

  form: {
    label: "Ton profil Steam",
    line: "Colle ton SteamID64, l'URL de ton profil, ou ton nom d'URL personnalisée. Le profil doit être public pour que le temps de jeu soit lisible.",
    placeholder: "76561198… ou steamcommunity.com/id/tonnom",
    submit: "Importer",
    preview: "Aperçu",
    pending: "Lecture…",
    hint: "Si tu ne connais que ton nom, steamid.io retrouve ton SteamID64.",
  },

  imported: {
    mock: "Données de démo — aucune clé configurée, c'est une étagère d'exemple.",
    connected: "Connecté",
    games: (n: number) => `${n} jeux`,
    top: "Par temps de jeu",
    more: (n: number) => `+${n} autres sur l'étagère`,
  },

  add: {
    title: "En ajouter un à la main",
    line: "Steam n'est pas toute ton étagère. Ajoute ce que tu joues sur Epic, sur console, ou que tu aimes juste — le plateau tire dedans aussi.",
    placeholder: "Chercher un jeu — « God of War », « Forza »…",
    searching: "Recherche…",
    added: "Sur l'étagère",
    addIt: "Ajouter",
    count: (n: number) => `${n} jeux`,
    countAdded: (n: number) => `${n} ajoutés par toi`,
    cta: "En tirer un",
  },

  tags: {
    title: "Données de tags",
    line: (n: number) =>
      `SideQuest note tes jeux sur leurs tags communautaires — genre, rythme, ambiance. ${n} ${
        n === 1 ? "jeu n'a pas" : "jeux n'ont pas"
      } les siens.`,
    read: (n: number) => `Lire ${n} ${n === 1 ? "jeu de tags" : "jeux de tags"}`,
    progress: "API publique bridée, quelques secondes chacun",
    done: "Tags lus — le plateau note maintenant sur le genre et l'ambiance, pas seulement sur les heures.",
  },

  offline: {
    title: "Pas de réseau",
    line: "Ton étagère est toujours là. Reconnecte-toi et SideQuest reprend où tu en étais.",
  },
};

export const connect: Record<Locale, typeof en> = { en, fr };
