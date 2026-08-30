// Reading a mood written in the player's own words, in French or English,
// without a model.
//
// The old reading was a substring search over tag names, and it failed on
// almost any real sentence. "I want to be scared" matched nothing, because no
// Steam tag contains the word "scared". Every French phrase matched nothing
// twice over: the tokenizer split on anything outside [a-z0-9-], so "détente"
// arrived as "tente", and even intact French words never appear in an English
// tag vocabulary.
//
// So the words the player uses and the words Steam tags with are two different
// vocabularies, and something has to translate between them. This file is that
// translation, written out by hand: senses, each with the words that signal it
// in both languages, and the Steam tags they point at.
//
// Deliberately a lookup table and not a model. It is the floor — it runs with
// no key, no quota, no network and no latency, and it is what answers when the
// model is unavailable. lib/ai.ts layers real comprehension on top; this makes
// sure the layer underneath is not zero.

/**
 * Accents folded, lowercased, apostrophes resolved. Without this, French never
 * survives tokenizing — "détente" arrives as "tente".
 *
 * The two apostrophes are not the same problem and cannot share a rule. An
 * English contraction is one word with a hole in it, so "don't" has to close up
 * into "dont" or the phrase table never sees it. A French elision is two words
 * stuck together, so "l'histoire" has to open out into "l histoire" or the word
 * "histoire" is lost. The letter count before the mark tells them apart.
 */
export function fold(s: string): string {
  return s
    .replace(/[’ʼ`]/g, "'")
    .replace(/([a-zA-Z]{2,})'([a-zA-Z])/g, "$1$2")
    .replace(/'/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Words carrying no intent, in both languages. They are dropped before the raw
 * tokens are used as tag needles, so "je veux un jeu" does not go looking for a
 * tag called "veux".
 */
export const STOPWORDS = new Set([
  // English
  "and", "but", "the", "for", "with", "something", "some", "want", "feel",
  "feeling", "kind", "sort", "like", "little", "bit", "really", "very",
  "just", "not", "into", "that", "this", "play", "game", "games", "mood",
  "tonight", "would", "could", "have", "been", "about", "some", "any",
  "give", "please", "need", "looking", "look", "today", "right", "now",
  // French
  "avec", "sans", "pour", "quelque", "chose", "truc", "envie", "veux",
  "voudrais", "cherche", "jeu", "jeux", "soir", "soiree", "genre", "plutot",
  "assez", "trop", "peu", "des", "les", "une", "aux", "que", "qui", "quoi",
  "dans", "mais", "pas", "non", "moi", "suis", "etre", "faire", "fait",
  "aujourd", "aujourdhui", "hui", "maintenant", "vraiment", "bien", "tres", "sur",
]);

/**
 * Words that flip the sense that follows them.
 *
 * "sans réfléchir" and "réfléchir" point at opposite shelves, and a lexicon
 * that cannot tell them apart is the shelf search's inverted-filter bug all
 * over again — it would answer a request for something mindless with Strategy
 * and Puzzle, which is exactly the game the player said they did not want.
 */
const NEGATORS = new Set([
  "pas", "sans", "non", "aucun", "aucune", "ni", "jamais", "rien", "eviter",
  "evite", "moins", "sauf", "hormis",
  "not", "no", "without", "dont", "don", "nothing", "avoid", "never", "less",
]);

/**
 * Where a negation stops.
 *
 * A fixed window of N tokens was the first attempt and it was wrong in both
 * directions: too short and "je veux pas d'un truc qui demande de réfléchir"
 * left `thinky` standing four words later, too long and the negation bled into
 * the next clause. A negation runs to the end of its clause instead, which is
 * how the sentence actually reads.
 */
const CLAUSE_BREAKS = new Set(["mais", "et", "ou", "puis", "but", "and", "or", "then"]);

type Sense = {
  /** Stable id, used to explain what was understood. */
  id: string;
  /**
   * Steam tags this sense points at. Order matters only in that the first is
   * the one shown when the sense is named back to the player.
   */
  tags: string[];
  /** Single words, already folded. */
  words: string[];
  /** Multi-word triggers, already folded; matched against the whole phrase. */
  phrases?: string[];
  /**
   * The sense this one turns into when it is refused.
   *
   * "I don't have to think about it" and "rien de trop dur" are not requests
   * for nothing — they are requests for the other thing. Without this, ruling
   * something out only removes candidates and the draw falls back to playtime,
   * which reads as the app ignoring what was typed.
   */
  opposite?: string;
};

/**
 * The senses.
 *
 * Tags are real Steam community tags, because that is what the enricher writes
 * onto the library — inventing a tidier vocabulary here would match nothing.
 */
export const MOOD_SENSES: Sense[] = [
  {
    id: "calm",
    opposite: "fast",
    tags: ["Relaxing", "Casual", "Cozy", "Simulation", "Farming Sim", "Sandbox"],
    words: [
      "chill", "relax", "relaxing", "relaxant", "calm", "calme", "cozy", "cosy",
      "comfy", "detente", "tranquille", "tranquil", "zen", "doux", "douce",
      "reposant", "repos", "souffler", "decompresser", "decompression",
      "peaceful", "gentle", "soothing", "unwind", "mellow", "pose",
    ],
    phrases: ["low key", "low-key", "wind down", "sans prise de tete"],
  },
  {
    id: "mindless",
    opposite: "thinky",
    tags: ["Casual", "Arcade", "Relaxing", "Sandbox", "Idle"],
    words: ["mindless", "brainless", "automatique", "simple", "facile", "easy", "bete"],
    phrases: [
      "no thinking", "not have to think", "dont have to think", "without thinking",
      "sans reflechir", "pas reflechir", "sans penser", "pas penser",
      "sans me prendre la tete", "eteindre le cerveau", "turn my brain off",
      "brain off", "pas la tete a", "la tete a rien", "pas le courage",
      "not up for", "cant be bothered", "cannot be bothered",
    ],
  },
  {
    id: "scary",
    tags: ["Horror", "Survival Horror", "Psychological Horror"],
    words: [
      "scared", "scary", "horror", "spooky", "creepy", "frightening", "terrifying",
      "fear", "dread", "peur", "horreur", "flippant", "angoissant", "effrayant",
      "terrifiant", "frisson", "frissons", "glauque", "epouvante", "cauchemar",
    ],
  },
  {
    id: "story",
    // Not "Singleplayer": it lives under `alone`, and here it handed every
    // game on the shelf a crumb of story that a concave score then inflated.
    tags: [
      "Story Rich", "Narrative", "Choices Matter", "Visual Novel", "Mystery",
      "Detective", "Emotional", "Cinematic", "Adventure",
    ],
    words: [
      "story", "narrative", "plot", "characters", "lore", "writing", "immersive",
      "histoire", "narratif", "narration", "scenario", "recit", "intrigue",
      "personnages", "immersif", "immersion", "raconte",
    ],
    phrases: ["story rich", "good story", "belle histoire", "bonne histoire"],
  },
  {
    id: "hard",
    opposite: "calm",
    tags: ["Difficult", "Souls-like", "Roguelike", "Precision Platformer"],
    words: [
      "hard", "difficult", "difficile", "challenging", "challenge", "punishing",
      "punitif", "brutal", "tough", "hardcore", "souls", "exigeant", "dur",
      "corse", "defi", "souffrir", "rageant", "sueur",
    ],
    phrases: ["kick my ass", "me defoncer", "en chier"],
  },
  {
    id: "fast",
    opposite: "calm",
    tags: ["Fast-Paced", "Action", "Arcade", "Shooter", "Roguelite"],
    words: [
      "fast", "frantic", "frenetique", "adrenaline", "twitch", "snappy", "intense",
      "nerveux", "rapide", "rythme", "vif", "punchy", "explosif", "defouler",
      "defouloir", "speed", "blast", "hectic", "nerveuse",
    ],
    phrases: ["fast paced", "fast-paced", "me defouler", "se defouler"],
  },
  {
    id: "thinky",
    opposite: "mindless",
    tags: ["Puzzle", "Strategy", "Turn-Based Strategy", "Management", "Tactical"],
    words: [
      "puzzle", "strategy", "strategie", "tactique", "tactical", "cerebral",
      "reflexion", "reflechir", "enigme", "enigmes", "gestion", "management",
      "planning", "brain", "cerveau", "thinking", "think", "logique",
    ],
    phrases: ["casse tete", "casse-tete", "turn based", "turn-based", "tour par tour"],
  },
  {
    id: "social",
    tags: ["Multiplayer", "Co-op", "Online Co-Op", "PvP"],
    words: [
      "multiplayer", "multijoueur", "coop", "friends", "amis", "potes", "online",
      "ensemble", "together", "pvp", "multi", "coequipiers",
    ],
    phrases: ["co op", "co-op", "with friends", "avec des potes", "avec des amis", "en ligne"],
  },
  {
    id: "alone",
    tags: ["Singleplayer"],
    words: ["solo", "alone", "seul", "singleplayer", "single"],
    phrases: ["by myself", "tout seul", "dans mon coin"],
  },
  {
    id: "explore",
    tags: ["Open World", "Exploration", "Adventure", "Atmospheric"],
    words: [
      "explore", "exploration", "explorer", "wander", "roam", "travel", "voyage",
      "aventure", "adventure", "decouvrir", "decouverte", "balade", "vaste",
    ],
    phrases: ["open world", "monde ouvert", "grand monde", "get lost", "me perdre"],
  },
  {
    id: "build",
    tags: ["Building", "Crafting", "Base Building", "Sandbox", "City Builder", "Farming Sim"],
    words: [
      "build", "building", "craft", "crafting", "sandbox", "construire",
      "construction", "batir", "fabriquer", "ferme", "farm", "farming", "jardin",
      "ville", "city", "base", "amenager", "optimiser",
    ],
    phrases: ["base building", "city builder", "constructeur de ville"],
  },
  {
    id: "funny",
    tags: ["Funny", "Comedy", "Party Game"],
    words: [
      "funny", "humour", "humor", "comedy", "silly", "laugh", "absurd", "drole",
      "marrant", "rigolo", "delire", "absurde", "wtf", "debile",
    ],
    phrases: ["fait rire", "make me laugh"],
  },
  {
    id: "emotional",
    tags: ["Emotional", "Story Rich", "Atmospheric", "Great Soundtrack"],
    words: [
      "emotional", "sad", "cry", "touching", "melancholic", "melancolique",
      "emouvant", "triste", "emotion", "touchant", "pleurer", "bouleversant",
    ],
    phrases: ["feel something", "me faire pleurer", "prendre aux tripes"],
  },
  {
    id: "atmosphere",
    tags: ["Atmospheric", "Great Soundtrack", "Beautiful", "Exploration"],
    words: [
      "atmosphere", "atmospheric", "ambiance", "vibes", "aesthetic", "beautiful",
      "beau", "belle", "contemplatif", "contemplative", "musique", "soundtrack",
      "esthetique", "poetique", "planant",
    ],
    phrases: ["bande son", "bande-son", "great soundtrack", "jolie direction artistique"],
  },
  {
    id: "shoot",
    tags: ["Shooter", "FPS", "Action", "First-Person"],
    words: [
      "shoot", "shooter", "fps", "gun", "guns", "war", "guerre", "tirer",
      "flingue", "flinguer", "combat", "militaire", "tir",
    ],
    phrases: ["first person", "first-person"],
  },
  {
    id: "retro",
    tags: ["Pixel Graphics", "Retro", "Classic", "Arcade"],
    words: [
      "retro", "pixel", "oldschool", "nostalgic", "nostalgie", "classic",
      "classique", "vieux", "ancien", "arcade", "vintage",
    ],
    phrases: ["old school", "old-school", "comme avant"],
  },
  {
    id: "progress",
    tags: ["RPG", "Action RPG", "Loot", "Open World"],
    words: [
      "rpg", "jdr", "loot", "grind", "leveling", "level", "progression",
      "niveau", "niveaux", "stats", "competences", "personnage",
    ],
    phrases: ["monter en niveau", "level up", "faire du loot"],
  },
  {
    id: "survive",
    tags: ["Survival", "Zombies", "Post-apocalyptic", "Crafting"],
    words: [
      "survive", "survival", "survie", "survivre", "zombie", "zombies",
      "apocalypse", "apocalyptique", "ressources",
    ],
    phrases: ["post apocalyptic", "post-apocalyptique"],
  },
  {
    id: "race",
    tags: ["Racing", "Sports", "Driving", "Automobile Sim"],
    words: [
      "race", "racing", "car", "cars", "driving", "sport", "sports", "course",
      "voiture", "voitures", "conduite", "conduire", "foot", "football", "soccer",
      "pilotage",
    ],
  },
  {
    id: "weird",
    tags: ["Experimental", "Psychedelic", "Surreal", "Indie"],
    words: [
      "weird", "strange", "artsy", "experimental", "unusual", "trippy", "bizarre",
      "etrange", "original", "chelou", "ovni",
    ],
  },
];

/** Every folded trigger word that belongs to some sense. */
const TRIGGER_WORDS = new Map<string, string[]>();
for (const s of MOOD_SENSES) {
  for (const w of s.words) {
    const ids = TRIGGER_WORDS.get(w) ?? [];
    ids.push(s.id);
    TRIGGER_WORDS.set(w, ids);
  }
}

const SENSE_BY_ID = new Map(MOOD_SENSES.map((s) => [s.id, s]));

export type MoodReading = {
  /** Tag needles to score on, in library-agnostic form. */
  needles: string[];
  /** Sense ids that fired, for explaining the reading back. */
  senses: string[];
  /** Sense ids the player explicitly ruled out. */
  negated: string[];
  /** Words that were not stopwords and not triggers — kept as literal needles. */
  literals: string[];
  /**
   * The same needles, one list per sense that fired (literals form a group of
   * their own). "une bonne histoire, tranquille" is two asks, and a game that
   * answers both should beat one that saturates a single one — which is what
   * happened when the lists were flattened: Stardew Valley, on calm alone,
   * outscored every story game on the shelf.
   */
  groups: string[][];
};

/**
 * Read a free-text mood.
 *
 * Returns needles, not a verdict: whether any of them land is a question about
 * this player's library, and that is answered in lib/recommend.ts where the
 * library actually is.
 */
export function readMood(text: string): MoodReading {
  const folded = fold(text);

  // Split keeping the separators, so a comma or a full stop can end a negation
  // the same way "mais" does: "pas d'horreur, plutôt du calme" must not leave
  // `calm` negated by a "pas" from the clause before.
  const parts = folded.split(/([^a-z0-9-]+)/);
  const tokens: string[] = [];
  const negatedAt = new Set<number>();
  let negating = false;
  for (const part of parts) {
    if (!part) continue;
    if (/^[a-z0-9-]/.test(part)) {
      if (CLAUSE_BREAKS.has(part)) negating = false;
      if (negating) negatedAt.add(tokens.length);
      if (NEGATORS.has(part)) negating = true;
      tokens.push(part);
    } else if (/[.,;:!?]/.test(part)) {
      negating = false;
    }
  }

  const fired = new Set<string>();
  const negated = new Set<string>();
  const literals: string[] = [];

  tokens.forEach((t, i) => {
    const ids = TRIGGER_WORDS.get(t);
    if (ids) {
      for (const id of ids) (negatedAt.has(i) ? negated : fired).add(id);
      return;
    }
    // Not a trigger and not noise: it may be a tag name typed verbatim
    // ("roguelike", "metroidvania"), which the tag matcher can still use.
    if (t.length >= 3 && !STOPWORDS.has(t) && !NEGATORS.has(t) && !negatedAt.has(i)) {
      literals.push(t);
    }
  });

  // Phrases are checked against the whole string, so "don't have to think"
  // reads as one sense rather than three unrelated words.
  for (const s of MOOD_SENSES) {
    for (const p of s.phrases ?? []) {
      if (!folded.includes(p)) continue;
      // A phrase carrying its own negation ("sans reflechir") is listed on the
      // sense it means, so it fires rather than negates.
      fired.add(s.id);
    }
  }

  // An explicit "no X" wins over an incidental mention of X.
  for (const id of negated) fired.delete(id);

  // A refusal that has an opposite is a request for the opposite — but only
  // when nothing was asked for outright. "un truc dur mais pas long" already
  // said what it wants; inventing `calm` from the "pas" would contradict it.
  if (!fired.size) {
    for (const id of negated) {
      const opp = SENSE_BY_ID.get(id)?.opposite;
      if (opp && !negated.has(opp)) fired.add(opp);
    }
  }

  const needles: string[] = [];
  const groups: string[][] = [];
  for (const id of fired) {
    const group: string[] = [];
    for (const tag of SENSE_BY_ID.get(id)?.tags ?? []) {
      if (!needles.includes(tag)) needles.push(tag);
      group.push(tag);
    }
    if (group.length) groups.push(group);
  }
  const lits: string[] = [];
  for (const l of literals) {
    if (!needles.includes(l)) needles.push(l);
    lits.push(l);
  }
  if (lits.length) groups.push(lits);

  return {
    needles,
    senses: [...fired],
    negated: [...negated],
    literals,
    groups,
  };
}

/**
 * Tags a sense rules out, so a negated sense can be kept out of the score
 * rather than merely not added. "nothing scary" should push horror down, not
 * leave it neutral.
 */
export function negatedTags(senseIds: string[]): string[] {
  const out: string[] = [];
  for (const id of senseIds) {
    for (const tag of SENSE_BY_ID.get(id)?.tags ?? []) {
      if (!out.includes(tag)) out.push(tag);
    }
  }
  return out;
}
