// Backlog roast — templated, stats-driven, no model involved.
//
// Every line is gated on a condition over real library numbers, so nothing is
// ever invented: if we can't measure it, we don't joke about it. There are no
// purchase prices and no completion data, so there are no "you paid £60 for
// this" or "games finished" jokes here. What there is, since the stats grew
// up, is names: the game that got twenty minutes, the hundred-hour RPG still
// sealed, the co-op bought for friends who never came. A roast that never
// says a title is a horoscope.
//
// Tone: mocking the habit, never the person. It should land like a friend, not
// a comment section. Bilingual — the French is written as French, tutoiement,
// not a carry-over of the English.
//
// This is the path without a key, or over quota, or when the model is slow.
// The model gets the same facts (lib/ai.ts) and is asked to beat this.

import type { BacklogStats } from "@/lib/library";
import type { Locale } from "@/i18n/locale";

export type Roast = {
  /** One punchy headline verdict. */
  verdict: string;
  /** 3 roast lines. */
  lines: string[];
  /** One (slightly) encouraging closer. */
  redemption: string;
};

export type RoastResult =
  | { ok: true; roast: Roast }
  | { ok: false; error: string };

type Derived = BacklogStats & {
  neverPlayedPct: number;
  barelyPlayedPct: number;
  /** Share of total hours sunk into the single most-played game. */
  topGameShare: number;
};

/**
 * What a line is about. Two lines on the same fact read as one joke told
 * twice, and a line on the verdict's fact reads as the verdict again — so
 * the picker takes at most one line per fact, and none on the verdict's.
 */
type Fact =
  | "never"
  | "barely"
  | "shortest"
  | "big"
  | "coop"
  | "top"
  | "podium"
  | "hours"
  | "tag"
  | "shelf"
  | "count"
  | "recent"
  | "family"
  | "free"
  | "median";

type Line = {
  id: string;
  fact: Fact;
  when: (s: Derived) => boolean;
  text: Record<Locale, (s: Derived) => string>;
};

const list = (names: string[], locale: Locale) => {
  const n = names.slice(0, 3);
  if (n.length <= 1) return n.join("");
  const last = n.pop()!;
  return `${n.join(", ")} ${locale === "fr" ? "et" : "and"} ${last}`;
};

/**
 * The pool. Order is irrelevant — applicable lines are shuffled — but each
 * `when` should be narrow enough that the line always reads as earned.
 */
const LINES: Line[] = [
  {
    id: "never-majority",
    fact: "never",
    when: (s) => s.neverPlayedPct > 50,
    text: {
      en: (s) => `${s.neverPlayedPct}% of your library has never been launched. Bold purchase strategy.`,
      fr: (s) => `${s.neverPlayedPct} % de ta bibliothèque n'a jamais été lancée. Stratégie d'achat audacieuse.`,
    },
  },
  {
    id: "never-some",
    fact: "never",
    when: (s) => s.neverPlayedPct > 20 && s.neverPlayedPct <= 50,
    text: {
      en: (s) => `${s.neverPlayed} games have never been opened. They're not a library, they're hostages.`,
      fr: (s) => `${s.neverPlayed} jeux jamais ouverts. C'est pas une bibliothèque, c'est une prise d'otages.`,
    },
  },
  {
    id: "never-none",
    fact: "never",
    when: (s) => s.neverPlayed === 0 && s.total >= 5,
    text: {
      en: () => `You've launched every single game you own. Who hurt you, and why did it make you like this?`,
      fr: () => `T'as lancé chaque jeu que tu possèdes. Qui t'a fait du mal, et pourquoi ça t'a rendu comme ça ?`,
    },
  },
  {
    id: "barely",
    fact: "barely",
    when: (s) => s.barelyPlayed >= 3 && s.barelyPlayedPct < 30,
    text: {
      en: (s) => `${s.barelyPlayed} games got the under-two-hours treatment. You didn't play them, you interviewed them.`,
      fr: (s) => `${s.barelyPlayed} jeux ont eu droit au traitement « moins de deux heures ». Tu les as pas joués, tu leur as fait passer un entretien.`,
    },
  },
  {
    id: "barely-heavy",
    fact: "barely",
    when: (s) => s.barelyPlayedPct >= 30,
    text: {
      en: (s) => `Nearly a third of your library — ${s.barelyPlayed} games — never made it past the tutorial. Commitment issues, documented.`,
      fr: (s) => `Presque un tiers de ta bibliothèque — ${s.barelyPlayed} jeux — n'a pas dépassé le tutoriel. Problèmes d'engagement, documentés.`,
    },
  },
  {
    id: "shortest-try",
    fact: "shortest",
    when: (s) => !!s.shortestTry && s.shortestTry.minutes < 45,
    text: {
      en: (s) => `${s.shortestTry!.name}: ${s.shortestTry!.minutes} minutes. That's not a playthrough, that's a trailer you paid for.`,
      fr: (s) => `${s.shortestTry!.name} : ${s.shortestTry!.minutes} minutes. C'est pas une partie, c'est une bande-annonce que t'as payée.`,
    },
  },
  {
    id: "big-unopened",
    fact: "big",
    when: (s) => !!s.bigUnopened,
    text: {
      en: (s) => `${s.bigUnopened!.name} — tagged ${s.bigUnopened!.kind}, never launched. A hundred hours, still sealed, waiting for you to feel brave.`,
      fr: (s) => `${s.bigUnopened!.name} — tagué ${s.bigUnopened!.kind}, jamais lancé. Cent heures, toujours sous cellophane, qui attendent que tu te sentes courageux.`,
    },
  },
  {
    id: "coop-unopened",
    fact: "coop",
    when: (s) => s.coopUnopened.length >= 1,
    text: {
      en: (s) => `${list(s.coopUnopened, "en")} — multiplayer, never launched. Bought for friends who never showed up.`,
      fr: (s) => `${list(s.coopUnopened, "fr")} — du multi, jamais lancé. Acheté pour des potes qui sont jamais venus.`,
    },
  },
  {
    id: "monogamy",
    fact: "top",
    when: (s) => !!s.topGame && s.topGameShare >= 0.4,
    text: {
      en: (s) => `${s.topGame!.name} ate ${Math.round(s.topGameShare * 100)}% of your total playtime. The other ${s.total - 1} games are set dressing.`,
      fr: (s) => `${s.topGame!.name} a mangé ${Math.round(s.topGameShare * 100)} % de ton temps de jeu. Les ${s.total - 1} autres, c'est du décor.`,
    },
  },
  {
    id: "top-game",
    fact: "top",
    when: (s) => !!s.topGame && s.topGame.hours >= 100 && s.topGameShare < 0.4,
    text: {
      en: (s) => `${s.topGame!.hours}h in ${s.topGame!.name}. That's not a hobby, that's a part-time job you pay for.`,
      fr: (s) => `${s.topGame!.hours} h dans ${s.topGame!.name}. C'est pas un hobby, c'est un mi-temps que tu paies.`,
    },
  },
  {
    id: "podium",
    fact: "podium",
    when: (s) => s.podium.length === 3 && s.total >= 8 && s.podiumShare >= 0.6 && s.topGameShare < 0.4,
    text: {
      en: (s) => `Three games — ${list(s.podium.map((g) => g.name), "en")} — hold ${Math.round(s.podiumShare * 100)}% of your hours. The other ${s.total - 3} are a very expensive screensaver.`,
      fr: (s) => `Trois jeux — ${list(s.podium.map((g) => g.name), "fr")} — tiennent ${Math.round(s.podiumShare * 100)} % de tes heures. Les ${s.total - 3} autres, c'est un économiseur d'écran hors de prix.`,
    },
  },
  {
    id: "hours-huge",
    fact: "hours",
    when: (s) => s.totalHours >= 1000,
    text: {
      en: (s) => `${s.totalHours} hours logged. That's ${Math.round(s.totalHours / 24)} full days you're never getting back, and you'd do it again.`,
      fr: (s) => `${s.totalHours} heures au compteur. ${Math.round(s.totalHours / 24)} jours entiers que tu ne reverras pas. Et tu recommencerais.`,
    },
  },
  {
    id: "hours-modest",
    fact: "hours",
    when: (s) => s.totalHours < 100 && s.total >= 10,
    text: {
      en: (s) => `${s.total} games, ${s.totalHours} hours total. You collect games the way other people collect unread books.`,
      fr: (s) => `${s.total} jeux, ${s.totalHours} heures en tout. Tu collectionnes les jeux comme d'autres collectionnent les livres jamais ouverts.`,
    },
  },
  {
    id: "top-tag",
    fact: "tag",
    when: (s) => !!s.topTag,
    text: {
      en: (s) => `${s.topTag!.count} of your games are tagged “${s.topTag!.tag}”. You don't have taste, you have a type.`,
      fr: (s) => `${s.topTag!.count} de tes jeux sont tagués « ${s.topTag!.tag} ». T'as pas des goûts, t'as un type.`,
    },
  },
  {
    id: "shelf",
    fact: "shelf",
    when: (s) => s.shelfOfShame.length >= 2,
    text: {
      en: (s) => `${list(s.shelfOfShame, "en")} — still sitting there, still waiting, still judging you.`,
      fr: (s) => `${list(s.shelfOfShame, "fr")} — toujours là, toujours à attendre, toujours à te juger.`,
    },
  },
  {
    id: "hoarder",
    fact: "count",
    when: (s) => s.total >= 100,
    text: {
      en: (s) => `${s.total} games. At one a month you'd clear the backlog in ${Math.round(s.total / 12)} years, assuming you never buy another. You will.`,
      fr: (s) => `${s.total} jeux. À un par mois, tu vides le backlog en ${Math.round(s.total / 12)} ans, à condition de plus jamais en acheter. Tu vas en acheter.`,
    },
  },
  {
    id: "small-library",
    fact: "count",
    when: (s) => s.total < 10,
    text: {
      en: (s) => `Only ${s.total} games. Refreshingly restrained, or you just haven't survived a Steam sale yet.`,
      fr: (s) => `Seulement ${s.total} jeux. Sobriété admirable, ou t'as juste pas encore survécu à des soldes Steam.`,
    },
  },
  {
    id: "recent-none",
    fact: "recent",
    when: (s) => s.recentHours === 0 && s.totalHours > 20,
    text: {
      en: () => `Zero hours in the last two weeks. The backlog is safe from you, at least.`,
      fr: () => `Zéro heure ces deux dernières semaines. Au moins, le backlog est à l'abri.`,
    },
  },
  {
    id: "recent-mono",
    fact: "recent",
    when: (s) => s.recentGames.length === 1 && s.recentHours >= 5 && s.total > 1,
    text: {
      en: (s) => `${s.recentHours} hours in the last two weeks, every one of them in ${s.recentGames[0].name}. The other ${s.total - 1} games have noticed.`,
      fr: (s) => `${s.recentHours} heures ces deux dernières semaines, toutes dans ${s.recentGames[0].name}. Les ${s.total - 1} autres ont remarqué.`,
    },
  },
  {
    id: "recent-vs-never",
    fact: "recent",
    when: (s) => s.recentHours >= 3 && s.neverPlayed >= 3 && s.recentGames.length > 1,
    text: {
      en: (s) => `${s.recentHours}h played this fortnight, ${s.neverPlayed} games never launched. You're not short on time, you're short on courage.`,
      fr: (s) => `${s.recentHours} h jouées en quinze jours, ${s.neverPlayed} jeux jamais lancés. C'est pas le temps qui te manque, c'est le courage.`,
    },
  },
  {
    id: "story-hoard",
    fact: "family",
    when: (s) => s.ownedIn.story >= 4 && s.hoursIn.roguelike > s.hoursIn.story && s.hoursIn.roguelike >= 20,
    text: {
      en: (s) => `You own ${s.ownedIn.story} story-driven games and put ${s.hoursIn.roguelike}h into roguelikes. You like the idea of a plot.`,
      fr: (s) => `Tu possèdes ${s.ownedIn.story} jeux à histoire et t'as mis ${s.hoursIn.roguelike} h dans des roguelikes. T'aimes l'idée d'un scénario.`,
    },
  },
  {
    id: "multi-hoard",
    fact: "family",
    when: (s) => s.ownedIn.multiplayer >= 3 && s.totalHours > 20 && s.hoursIn.multiplayer < s.totalHours * 0.1,
    text: {
      en: (s) => `${s.ownedIn.multiplayer} multiplayer games, ${s.hoursIn.multiplayer}h between them. Your friends list is a museum too.`,
      fr: (s) => `${s.ownedIn.multiplayer} jeux multi, ${s.hoursIn.multiplayer} h à eux tous. Ta liste d'amis aussi, c'est un musée.`,
    },
  },
  {
    id: "strategy",
    fact: "family",
    when: (s) => s.ownedIn.strategy >= 3 && s.hoursIn.strategy >= 100,
    text: {
      en: (s) => `${s.hoursIn.strategy}h in strategy games. Somewhere in there was a plan for the backlog. It didn't survive contact.`,
      fr: (s) => `${s.hoursIn.strategy} h dans des jeux de stratégie. Il y avait sûrement un plan pour le backlog là-dedans. Il a pas survécu au contact.`,
    },
  },
  {
    id: "free-hours",
    fact: "free",
    when: (s) => s.freeHours >= 50 && s.freeHours >= s.totalHours * 0.3,
    text: {
      en: (s) => `${s.freeHours} of your ${s.totalHours} hours went into free-to-play games. The paid ones are subsidising the free ones.`,
      fr: (s) => `${s.freeHours} de tes ${s.totalHours} heures sont parties dans des free-to-play. Les payants financent les gratuits.`,
    },
  },
  {
    id: "median",
    fact: "median",
    when: (s) => s.medianHours < 1 && s.total >= 10,
    text: {
      en: () => `Median playtime: under an hour per game. Half of this shelf has met you exactly once.`,
      fr: () => `Temps médian : moins d'une heure par jeu. La moitié de l'étagère t'a vu exactement une fois.`,
    },
  },
];

const VERDICTS: { fact: Fact | null; when: (s: Derived) => boolean; text: Record<Locale, (s: Derived) => string> }[] = [
  {
    fact: "never",
    when: (s) => s.neverPlayedPct > 60,
    text: {
      en: (s) => `You own ${s.total} games and have played ${s.played}. This is a museum, not a game room.`,
      fr: (s) => `Tu possèdes ${s.total} jeux et t'en as joué ${s.played}. C'est un musée, pas une salle de jeu.`,
    },
  },
  {
    fact: "big",
    when: (s) => !!s.bigUnopened && s.neverPlayedPct > 30,
    text: {
      en: (s) => `${s.bigUnopened!.name} has been sealed on this shelf long enough to count as a collectible.`,
      fr: (s) => `${s.bigUnopened!.name} est resté sous cellophane assez longtemps pour devenir un objet de collection.`,
    },
  },
  {
    fact: "barely",
    when: (s) => s.barelyPlayedPct >= 30,
    text: {
      en: () => `You don't finish games. You sample them, like a wine tasting nobody asked for.`,
      fr: () => `Tu finis pas les jeux. Tu les goûtes, comme une dégustation que personne a demandée.`,
    },
  },
  {
    fact: "top",
    when: (s) => !!s.topGame && s.topGameShare >= 0.4,
    text: {
      en: (s) => `You didn't build a library, you built a shrine to ${s.topGame!.name}.`,
      fr: (s) => `T'as pas construit une bibliothèque, t'as construit un autel à ${s.topGame!.name}.`,
    },
  },
  {
    fact: "recent",
    when: (s) => s.recentHours === 0 && s.total >= 10,
    text: {
      en: (s) => `${s.total} games, and not one of them saw you this fortnight. The shelf is winning.`,
      fr: (s) => `${s.total} jeux, et pas un t'a vu ces quinze derniers jours. L'étagère est en train de gagner.`,
    },
  },
  {
    fact: null,
    when: () => true,
    text: {
      en: (s) => `${s.total} games, ${s.totalHours} hours, and you still open Steam and stare at it for ten minutes.`,
      fr: (s) => `${s.total} jeux, ${s.totalHours} heures, et tu ouvres encore Steam pour le fixer pendant dix minutes.`,
    },
  },
];

const REDEMPTIONS: { when: (s: Derived) => boolean; text: Record<Locale, (s: Derived) => string> }[] = [
  {
    when: (s) => s.neverPlayed > 0,
    text: {
      en: (s) => `The good news: ${s.neverPlayed} unopened games means ${s.neverPlayed} chances at a new favourite. Pick one tonight.`,
      fr: (s) => `La bonne nouvelle : ${s.neverPlayed} jeux jamais ouverts, c'est ${s.neverPlayed} chances de trouver un nouveau favori. Choisis-en un ce soir.`,
    },
  },
  {
    when: (s) => s.recentGames.length > 0 && s.recentGames[0].hours >= 3,
    text: {
      en: (s) => `You did put ${s.recentGames[0].hours}h into ${s.recentGames[0].name} this fortnight. That's a streak. Keep it.`,
      fr: (s) => `T'as quand même mis ${s.recentGames[0].hours} h dans ${s.recentGames[0].name} ces quinze jours. C'est une série. Garde-la.`,
    },
  },
  {
    when: (s) => !!s.topGame,
    text: {
      en: (s) => `In your defence, ${s.topGame!.hours}h in one game means you do know how to love something. Try it on a second one.`,
      fr: (s) => `À ta décharge, ${s.topGame!.hours} h dans un seul jeu, ça prouve que tu sais aimer. Essaie sur un deuxième.`,
    },
  },
  {
    when: () => true,
    text: {
      en: () => `Honestly? Anyone who owns this many games has excellent problems.`,
      fr: () => `Franchement ? Quelqu'un qui possède autant de jeux a d'excellents problèmes.`,
    },
  },
];

/** Deterministic-in, shuffled-out: same stats, different jab each time. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function derive(s: BacklogStats): Derived {
  return {
    ...s,
    neverPlayedPct: s.total ? Math.round((s.neverPlayed / s.total) * 100) : 0,
    barelyPlayedPct: s.total ? Math.round((s.barelyPlayed / s.total) * 100) : 0,
    topGameShare:
      s.topGame && s.totalHours > 0 ? s.topGame.hours / s.totalHours : 0,
  };
}

/** Three lines, each on a different fact, none on the verdict's. */
function pickLines(s: Derived, verdictFact: Fact | null, locale: Locale): string[] {
  const used = new Set<Fact>(verdictFact ? [verdictFact] : []);
  const out: string[] = [];
  for (const line of shuffle(LINES.filter((l) => l.when(s)))) {
    if (used.has(line.fact)) continue;
    used.add(line.fact);
    out.push(line.text[locale](s));
    if (out.length === 3) break;
  }
  // A tiny shelf may not have three facts to joke about; a repeat beats a gap.
  if (out.length < 3) {
    for (const line of shuffle(LINES.filter((l) => l.when(s)))) {
      const text = line.text[locale](s);
      if (!out.includes(text)) out.push(text);
      if (out.length === 3) break;
    }
  }
  return out;
}

export function roastBacklog(stats: BacklogStats, locale: Locale = "en"): RoastResult {
  if (!stats.total) {
    // Not shown: the screen renders its own "empty shelf" line.
    return { ok: false, error: "empty shelf" };
  }

  const s = derive(stats);
  const verdict = VERDICTS.find((v) => v.when(s))!;

  return {
    ok: true,
    roast: {
      verdict: verdict.text[locale](s),
      lines: pickLines(s, verdict.fact, locale),
      redemption: shuffle(REDEMPTIONS.filter((r) => r.when(s)))[0].text[locale](s),
    },
  };
}
