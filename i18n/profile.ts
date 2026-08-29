import type { Locale } from "./locale";
import type { EggId } from "@/lib/eggs";

/**
 * The profile.
 *
 * The old one was seven unlabelled blocks in two columns, and you could not
 * tell which of them were things the app had worked out about you and which
 * were switches you were meant to flick. So the page now says so, out loud,
 * with two headings: READINGS and SETTINGS. Everything else follows from that.
 */

const en = {
  eyebrow: "Profile",
  title: "Your shelf, read back",
  lede: "Everything here comes from the games you own and the hours already on them. Nothing is sent anywhere.",

  demoShelf: "Demo shelf",
  gamesCount: (n: number) => `${n} games`,
  sampleNote: "These are the demo numbers.",
  sampleCta: "Connect your Steam",

  numbers: {
    title: "The numbers",
    total: "Games",
    hours: "Hours played",
    sealed: "Never launched",
  },

  readings: {
    title: "What it makes of you",
    lede: "Two readings of the same numbers. One takes your shelf seriously, the other does not.",
  },

  portrait: {
    title: "The shelf, read as a person",
    cta: "Read my shelf",
    cost: (n: number) => `${n} tags · one call`,
    noTags: "No tags on the shelf yet",
    reading: "Reading the shelf…",
    blindSpot: "Blind spot",
    again: "Read again",
    againCached: "Read again · free, cached",
    failed: (why: string) =>
      `No reading — ${why}. Everything else on this page is local and unaffected.`,
    retry: "Try again",
  },

  roast: {
    title: "The warning label",
    idle: "This shelf carries a warning about its owner. Read it at your own risk.",
    cta: "Read it",
    again: "Again",
    pending: "Sharpening…",
  },

  settings: {
    title: "What you tell it",
    lede: "Two things the engine takes from you directly, and it says so on the verdict when they land.",
  },

  taste: {
    title: "Genres you actually like",
    line: "A mild nudge, deliberately weighted below the mood you pick at draw time.",
    saved: "Saved",
  },

  hidden: {
    title: "Never suggest",
    empty: "Nothing banished yet.",
    restore: "Put back",
  },

  supply: {
    title: "The AI layer",
    live: "Live",
    off: "Local only",
    liveLine: "The written verdicts, the roast and the shelf reading are coming from the model today.",
    offLine:
      "No key, and nothing is broken: the scoring engine is local and was never the part that needed a model. Every screen still works, it just phrases things from templates.",
    calls: (n: number, of: number) => `${n} of ${of} calls today`,
    budget: "Daily budget used",
    spent: "Spent today",
    ceiling: "A full day, flat out",
    detail: "The arithmetic",
    detailLine: (a: string, b: string, inP: string, outP: string) =>
      `${a} tokens in, ${b} out, priced at $${inP} and $${outP} per million. Resets at midnight UTC.`,
    /**
     * The caveat that turns this gauge from an accounting figure into a brake.
     * Printed rather than buried, because a ceiling read as site-wide when it
     * is per-instance is a number that will be wrong on the day it matters.
     */
    perInstance:
      "Counted in one server instance's memory. A serverless host runs several, and a deploy resets them — so this is a brake on runaway spend, not a ledger, and the real ceiling for the whole site is higher than the figure above.",
  },

  trophies: {
    title: "Trophies",
    found: (n: number, of: number) => `${n} of ${of} found`,
    show: "Show the case",
    hide: "Hide the case",
    locked: "Locked",
    privacy: "Kept in this browser only. Nothing is sent anywhere.",
  },
};

const fr: typeof en = {
  eyebrow: "Profil",
  title: "Ton étagère, relue",
  lede: "Tout ce qui suit sort des jeux que tu possèdes et des heures déjà dessus. Rien n'est envoyé nulle part.",

  demoShelf: "Étagère de démo",
  gamesCount: (n: number) => `${n} jeux`,
  sampleNote: "Ce sont les chiffres de la démo.",
  sampleCta: "Connecte ton Steam",

  numbers: {
    title: "Les chiffres",
    total: "Jeux",
    hours: "Heures jouées",
    sealed: "Jamais lancés",
  },

  readings: {
    title: "Ce qu'il en déduit",
    lede: "Deux lectures des mêmes chiffres. L'une prend ton étagère au sérieux, l'autre pas du tout.",
  },

  portrait: {
    title: "L'étagère, lue comme quelqu'un",
    cta: "Lire mon étagère",
    cost: (n: number) => `${n} tags · un appel`,
    noTags: "Aucun tag sur l'étagère pour l'instant",
    reading: "Lecture de l'étagère…",
    blindSpot: "Angle mort",
    again: "Relire",
    againCached: "Relire · gratuit, en cache",
    failed: (why: string) =>
      `Pas de lecture — ${why}. Tout le reste de cette page est local et intact.`,
    retry: "Réessayer",
  },

  roast: {
    title: "L'étiquette d'avertissement",
    idle: "Cette étagère porte un avertissement sur son propriétaire. À lire à tes risques.",
    cta: "La lire",
    again: "Encore",
    pending: "Affûtage…",
  },

  settings: {
    title: "Ce que tu lui dis",
    lede: "Deux choses que le moteur prend directement de toi, et il le dit sur le verdict quand elles pèsent.",
  },

  taste: {
    title: "Les genres que tu aimes vraiment",
    line: "Un léger coup de pouce, volontairement pesé sous l'humeur que tu choisis au moment du tirage.",
    saved: "Enregistré",
  },

  hidden: {
    title: "Ne jamais proposer",
    empty: "Personne de banni pour l'instant.",
    restore: "Remettre",
  },

  supply: {
    title: "La couche IA",
    live: "En ligne",
    off: "Local seulement",
    liveLine: "Les verdicts rédigés, le roast et la lecture d'étagère sortent du modèle aujourd'hui.",
    offLine:
      "Pas de clé, et rien n'est cassé : le moteur de score est local et n'a jamais été la partie qui avait besoin d'un modèle. Tous les écrans marchent, ils formulent juste à partir de gabarits.",
    calls: (n: number, of: number) => `${n} appels sur ${of} aujourd'hui`,
    budget: "Budget du jour consommé",
    spent: "Dépensé aujourd'hui",
    ceiling: "Une journée à plein régime",
    detail: "Le détail du calcul",
    detailLine: (a: string, b: string, inP: string, outP: string) =>
      `${a} tokens en entrée, ${b} en sortie, au prix de ${inP} $ et ${outP} $ le million. Remise à zéro à minuit UTC.`,
    perInstance:
      "Compté dans la mémoire d'une seule instance serveur. Un hébergeur serverless en fait tourner plusieurs, et un déploiement les remet à zéro — c'est donc un frein contre l'emballement, pas une comptabilité, et le vrai plafond du site entier est plus haut que le chiffre ci-dessus.",
  },

  trophies: {
    title: "Trophées",
    found: (n: number, of: number) => `${n} trouvés sur ${of}`,
    show: "Ouvrir la vitrine",
    hide: "Fermer la vitrine",
    locked: "Verrouillé",
    privacy: "Gardés dans ce navigateur seulement. Rien n'est envoyé nulle part.",
  },
};

export const profile: Record<Locale, typeof en> = { en, fr };

/* ============================================================
   The twelve trophies, in both languages.

   Two of them used to be jokes about a cartridge deck that no longer
   exists on screen. A hint that points at an object the app does not
   have is not a hint, it is a dead end — so those two now point at the
   verdict panel, which is where the gesture actually lives.
   ============================================================ */

type EggCopy = { name: string; line: string; hint: string };

const eggsEn: Record<EggId, EggCopy> = {
  konami: {
    name: "Thirty lives",
    line: "Thirty lives. Still one backlog.",
    hint: "Some codes you never had to write down.",
  },
  iddqd: {
    name: "Degreelessness mode",
    line: "God mode. The backlog cannot hurt you now.",
    hint: "Five letters that made you invincible in 1993.",
  },
  xyzzy: {
    name: "A hollow voice",
    line: "A hollow voice says: fool.",
    hint: "The oldest magic word in the medium. Type it anywhere.",
  },
  blow: {
    name: "The ritual",
    line: "Blew on it. Works now.",
    hint: "It never actually helped. Do it to tonight's cover anyway. Three times.",
  },
  rrod: {
    name: "Three red lights",
    line: "Three red lights. Wiggle the cable, wait a year, try again.",
    hint: "Prod the scores on a verdict until three of them have been poked.",
  },
  respects: {
    name: "Respects paid",
    line: "F. That one served.",
    hint: "When a game is banished from the shelf, there is one key to press.",
  },
  answer: {
    name: "The answer",
    line: "Forty-two games. Don't panic.",
    hint: "A shelf of a very particular size.",
  },
  cake: {
    name: "The cake",
    line: "The cake is a lie. The backlog is not.",
    hint: "Ask the shelf for something that isn't a game.",
  },
  barrelroll: {
    name: "Do a barrel roll",
    line: "Do a barrel roll. Peppy has been shouting it since 1997.",
    hint: "Peppy has been shouting it since 1997. Type what he says.",
  },
  kindly: {
    name: "Ask nicely",
    line: "Asked nicely. Three times.",
    hint: "Press the mark in the corner. Politely. Three times.",
  },
  nightowl: {
    name: "Night owl",
    line: "Drawing at 3am. The shelf is not judging. Much.",
    hint: "Some hours are their own confession.",
  },
  halflife: {
    name: "The long wait",
    line: "Still counting.",
    hint: "A number this audience has been waiting on for two decades.",
  },
};

const eggsFr: Record<EggId, EggCopy> = {
  konami: {
    name: "Trente vies",
    line: "Trente vies. Toujours un seul backlog.",
    hint: "Certains codes, tu n'as jamais eu besoin de les noter.",
  },
  iddqd: {
    name: "Mode invincible",
    line: "God mode. Le backlog ne peut plus rien contre toi.",
    hint: "Cinq lettres qui te rendaient invincible en 1993.",
  },
  xyzzy: {
    name: "Une voix caverneuse",
    line: "Une voix caverneuse dit : idiot.",
    hint: "Le plus vieux mot magique du médium. Tape-le n'importe où.",
  },
  blow: {
    name: "Le rituel",
    line: "Soufflé dessus. Ça remarche.",
    hint: "Ça n'a jamais servi à rien. Fais-le quand même sur la jaquette du soir. Trois fois.",
  },
  rrod: {
    name: "Trois lumières rouges",
    line: "Trois lumières rouges. Bouge le câble, attends un an, réessaie.",
    hint: "Tripote les scores d'un verdict jusqu'à en avoir poussé trois.",
  },
  respects: {
    name: "Hommage rendu",
    line: "F. Celui-là a servi.",
    hint: "Quand un jeu est banni de l'étagère, il y a une touche à presser.",
  },
  answer: {
    name: "La réponse",
    line: "Quarante-deux jeux. Pas de panique.",
    hint: "Une étagère d'une taille très particulière.",
  },
  cake: {
    name: "Le gâteau",
    line: "Le gâteau est un mensonge. Le backlog, non.",
    hint: "Demande à l'étagère quelque chose qui n'est pas un jeu.",
  },
  barrelroll: {
    name: "Fais un tonneau",
    line: "Fais un tonneau. Peppy le hurle depuis 1997.",
    hint: "Peppy le hurle depuis 1997. Tape ce qu'il dit.",
  },
  kindly: {
    name: "Demander gentiment",
    line: "Demandé gentiment. Trois fois.",
    hint: "Presse la marque dans le coin. Poliment. Trois fois.",
  },
  nightowl: {
    name: "Oiseau de nuit",
    line: "Un tirage à 3h du matin. L'étagère ne juge pas. Trop.",
    hint: "Certaines heures sont un aveu à elles seules.",
  },
  halflife: {
    name: "La longue attente",
    line: "On compte toujours.",
    hint: "Un chiffre que ce public attend depuis vingt ans.",
  },
};

export const eggCopy: Record<Locale, Record<EggId, EggCopy>> = {
  en: eggsEn,
  fr: eggsFr,
};
