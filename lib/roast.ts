// Backlog roast — templated, stats-driven, no model involved.
//
// Every line is gated on a condition over real library numbers, so nothing is
// ever invented: if we can't measure it, we don't joke about it. Notably we
// have no purchase prices and no completion data, so there are no "you paid
// £60 for this" or "games finished" jokes here.
//
// Tone: mocking the habit, never the person. It should land like a friend, not
// a comment section.

import type { BacklogStats } from "@/lib/library";

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

type Punchline = {
  id: string;
  when: (s: Derived) => boolean;
  line: (s: Derived) => string;
};

/**
 * The pool. Order is irrelevant — applicable lines are shuffled — but each
 * `when` should be narrow enough that the line always reads as earned.
 */
const PUNCHLINES: Punchline[] = [
  {
    id: "never-majority",
    when: (s) => s.neverPlayedPct > 50,
    line: (s) =>
      `${s.neverPlayedPct}% of your library has never been launched. Bold purchase strategy.`,
  },
  {
    id: "never-some",
    when: (s) => s.neverPlayedPct > 20 && s.neverPlayedPct <= 50,
    line: (s) =>
      `${s.neverPlayed} games have never been opened. They're not a library, they're hostages.`,
  },
  {
    id: "never-none",
    when: (s) => s.neverPlayed === 0 && s.total >= 5,
    line: () =>
      `You've actually launched every single game you own. Who hurt you, and why did it make you like this?`,
  },
  {
    id: "barely",
    when: (s) => s.barelyPlayed >= 3,
    line: (s) =>
      `${s.barelyPlayed} games got the under-two-hours treatment. You didn't play them, you interviewed them.`,
  },
  {
    id: "barely-heavy",
    when: (s) => s.barelyPlayedPct >= 30,
    line: (s) =>
      `Nearly a third of your library — ${s.barelyPlayed} games — never made it past the tutorial. Commitment issues, documented.`,
  },
  {
    id: "monogamy",
    when: (s) => !!s.topGame && s.topGameShare >= 0.4,
    line: (s) =>
      `${s.topGame!.name} ate ${Math.round(s.topGameShare * 100)}% of your total playtime. The other ${s.total - 1} games are just set dressing.`,
  },
  {
    id: "top-game",
    when: (s) => !!s.topGame && s.topGame.hours >= 100 && s.topGameShare < 0.4,
    line: (s) =>
      `${s.topGame!.hours}h in ${s.topGame!.name}. That's not a hobby, that's a part-time job you pay for.`,
  },
  {
    id: "hours-huge",
    when: (s) => s.totalHours >= 1000,
    line: (s) =>
      `${s.totalHours} hours logged. That's ${Math.round(s.totalHours / 24)} full days you're never getting back, and you'd do it again.`,
  },
  {
    id: "hours-modest",
    when: (s) => s.totalHours < 100 && s.total >= 10,
    line: (s) =>
      `${s.total} games, ${s.totalHours} hours total. You collect games the way other people collect unread books.`,
  },
  {
    id: "top-tag",
    when: (s) => !!s.topTag,
    line: (s) =>
      `${s.topTag!.count} of your games are tagged “${s.topTag!.tag}”. You don't have taste, you have a type.`,
  },
  {
    id: "shelf",
    when: (s) => s.shelfOfShame.length >= 2,
    line: (s) =>
      `${s.shelfOfShame.slice(0, 3).join(", ")} — still sitting there, still waiting, still judging you.`,
  },
  {
    id: "hoarder",
    when: (s) => s.total >= 100,
    line: (s) =>
      `${s.total} games. At one game a month you'd finish the backlog in ${Math.round(s.total / 12)} years, assuming you never buy another. You will.`,
  },
  {
    id: "small-library",
    when: (s) => s.total < 10,
    line: (s) =>
      `Only ${s.total} games. Refreshingly restrained, or you just haven't survived a Steam sale yet.`,
  },
];

const VERDICTS: { when: (s: Derived) => boolean; text: (s: Derived) => string }[] = [
  {
    when: (s) => s.neverPlayedPct > 60,
    text: (s) =>
      `You own ${s.total} games and have played ${s.played}. This is a museum, not a game room.`,
  },
  {
    when: (s) => s.barelyPlayedPct >= 30,
    text: () => `You don't finish games. You sample them, like a wine tasting nobody asked for.`,
  },
  {
    when: (s) => !!s.topGame && s.topGameShare >= 0.4,
    text: (s) =>
      `You didn't build a library, you built a shrine to ${s.topGame!.name}.`,
  },
  {
    when: () => true,
    text: (s) =>
      `${s.total} games, ${s.totalHours} hours, and you still open Steam and stare at it for ten minutes.`,
  },
];

const REDEMPTIONS: { when: (s: Derived) => boolean; text: (s: Derived) => string }[] = [
  {
    when: (s) => s.neverPlayed > 0,
    text: (s) =>
      `The good news: ${s.neverPlayed} unopened games means ${s.neverPlayed} chances at a new favourite. Pick one tonight.`,
  },
  {
    when: (s) => !!s.topGame,
    text: (s) =>
      `In your defence, ${s.topGame!.hours}h in one game means you do know how to love something. Try it on a second one.`,
  },
  {
    when: () => true,
    text: () => `Honestly? Anyone who owns this many games has excellent problems.`,
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

export function roastBacklog(stats: BacklogStats): RoastResult {
  if (!stats.total) {
    return { ok: false, error: "Import a library first — I can't roast an empty shelf." };
  }

  const s = derive(stats);
  const applicable = PUNCHLINES.filter((p) => p.when(s));
  const lines = shuffle(applicable).slice(0, 3).map((p) => p.line(s));

  return {
    ok: true,
    roast: {
      verdict: VERDICTS.find((v) => v.when(s))!.text(s),
      lines,
      redemption: shuffle(REDEMPTIONS.filter((r) => r.when(s)))[0].text(s),
    },
  };
}
