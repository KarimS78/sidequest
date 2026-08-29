import type { Locale } from "./locale";

// The draw screen: the controls on the left, the verdict on the right.

const en = {
  heading: "Tonight",
  setup: {
    title: "Set the board",
    time: "How long have you got?",
    mood: "What are you in the mood for?",
    custom: "Type it instead",
    customBack: "Back to the moods",
  },

  idle: {
    label: "Nothing drawn yet",
    title: "One game, in about three seconds.",
    line: "Tell it your window and your mood. It reads the shelf, weighs six things, and commits to one.",
  },

  rolling: "Drawing",
  verdictLabel: "Tonight",

  alternatives: {
    title: "Also in the running",
  },

  /** Prefixes the model's one-line reading of what the player typed. */
  moodReadLabel: "Read as",

  /** Shown when free text matched nothing in the library. */
  moodMiss: (text: string) =>
    `Nothing on your shelf is tagged anything like “${text}”, so this one went on time and playtime instead. Try a genre word — roguelike, cosy, story.`,

  lastNote: {
    title: "Where you left off",
    next: "Next",
  },

  note: {
    prompt: "What did you get done?",
    placeholder: "Beat the boss, stuck on the third vault…",
    saved: "Saved",
  },

  empty: {
    title: "Nothing on the shelf",
    line: "Import your Steam library and every game you own becomes something it can draw from.",
    cta: "Connect Steam",
  },

  errors: {
    pickFirst: "Pick a mood, or type one, before you draw.",
  },

  sample: "Demo library — ten games, nothing imported yet.",
};

const fr: typeof en = {
  heading: "Ce soir",
  setup: {
    title: "Règle le plateau",
    time: "Tu as combien de temps ?",
    mood: "T'as envie de quoi ?",
    custom: "Écris-le plutôt",
    customBack: "Revenir aux humeurs",
  },

  idle: {
    label: "Rien de tiré",
    title: "Un jeu, en trois secondes environ.",
    line: "Donne-lui ton créneau et ton humeur. Il lit l'étagère, pèse six choses, et s'engage sur un seul.",
  },

  rolling: "Tirage",
  verdictLabel: "Ce soir",

  alternatives: {
    title: "Aussi en lice",
  },

  moodReadLabel: "Compris comme",

  moodMiss: (text: string) =>
    `Rien sur ton étagère n'est taggé quoi que ce soit comme « ${text} », alors le tirage s'est fait sur le temps et les heures jouées. Essaie un mot de genre — roguelike, cosy, histoire.`,

  lastNote: {
    title: "Où tu en étais",
    next: "Ensuite",
  },

  note: {
    prompt: "T'as avancé sur quoi ?",
    placeholder: "Boss battu, bloqué au troisième caveau…",
    saved: "Enregistré",
  },

  empty: {
    title: "Rien sur l'étagère",
    line: "Importe ta bibliothèque Steam et chaque jeu que tu possèdes devient une carte qu'il peut tirer.",
    cta: "Connecter Steam",
  },

  errors: {
    pickFirst: "Choisis une humeur, ou écris-en une, avant de tirer.",
  },

  sample: "Bibliothèque de démo — dix jeux, rien d'importé.",
};

export const draw: Record<Locale, typeof en> = { en, fr };
