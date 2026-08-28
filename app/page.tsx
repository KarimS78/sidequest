import Link from "next/link";
import type { Metadata } from "next";
import { CoverArt } from "@/components/cover-art";
import { SAMPLE_LIBRARY } from "@/lib/library";
import { LIMITS, PRICE_PER_MTOK } from "@/lib/ai-guard";

/**
 * The front of the cabinet.
 *
 * For a long time there was no landing here: /play was the home screen, on the
 * theory that the product answers its own question the moment you open it. That
 * holds for someone who already knows what SideQuest is. It does not hold for
 * anyone else — a stranger landed on a panel of numbered channels with no idea
 * what a "draw" was, and the demo shelf they were already looking at was never
 * announced.
 *
 * So this page exists, and it is the same machine seen from the front: steel,
 * silkscreen, one amber readout. Not a screenshot tour with a gradient. Every
 * number printed here is imported from the code that enforces it (the AI caps,
 * the demo shelf size) rather than typed into the copy, because marketing that
 * drifts from the build is the specific way a page like this goes stale.
 */

export const metadata: Metadata = {
  title: "SideQuest — Never forget where you left off",
  description:
    "You own more games than evenings. SideQuest reads your Steam library, the time you actually have and the mood you're in, then picks the one game to play right now — and tells you why.",
};

/** The daily AI ceiling, priced at the mix the prompts are built for. */
const DAILY_CEILING_USD =
  (LIMITS.globalTokensPerDay * 0.75 * PRICE_PER_MTOK.input) / 1_000_000 +
  (LIMITS.globalTokensPerDay * 0.25 * PRICE_PER_MTOK.output) / 1_000_000;

export default function Landing() {
  return (
    <main className="flex-1">
      <TopBar />

      <div className="room pb-20">
        <Hero />
        <TheProblem />
        <HowItRuns />
        <HowItScores />
        <TheAiLayer />
        <Pricing />
        <WhatItNeeds />
        <LastCall />
      </div>

      <Footer />
    </main>
  );
}

/* ------------------------------------------------------------------ top bar */

function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-ground/85 backdrop-blur">
      <div className="room flex h-14 items-center justify-between !py-0">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 place-items-center rounded-[3px] bg-gradient-to-b from-shell to-shell-dark font-display text-[15px] font-extrabold leading-none text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.35)]"
            aria-hidden
          >
            SQ
          </span>
          <b className="font-display text-[20px] font-extrabold uppercase leading-none tracking-[0.04em]">
            SideQuest
          </b>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="#ai"
            className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-label sm:block"
          >
            The AI layer
          </a>
          <a
            href="#pricing"
            className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-label sm:block"
          >
            Price
          </a>
          <Link
            href="/play"
            className="key flex min-h-9 items-center gap-2 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-label"
          >
            <i className="led led-on" aria-hidden />
            Open the board
          </Link>
        </div>
      </div>
    </header>
  );
}

/* --------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="post grid items-center gap-10 pb-16 pt-12 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 lg:pb-24 lg:pt-20 xl:grid-cols-[minmax(0,1fr)_30rem]">
      <div>
        <p className="legend">SideQuest · Companion board · Rev 1</p>

        <h1 className="mt-4 font-display text-[54px] font-extrabold uppercase leading-[0.86] tracking-[0.01em] sm:text-[72px] lg:text-[86px] xl:text-[96px]">
          Never forget
          <br />
          where you
          <br />
          left off
        </h1>

        <p className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-[#b3c0c7] lg:text-base">
          You own more games than evenings. SideQuest reads your Steam library,
          the hours you actually have tonight and the mood you’re in — then
          seats one cartridge and tells you why that one.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/play"
            className="switch inline-flex h-[54px] !w-auto items-center gap-3 px-7 font-display text-[21px] font-extrabold uppercase tracking-[0.12em]"
          >
            Open the board
            <span aria-hidden>→</span>
          </Link>
          <a
            href="#scoring"
            className="key inline-flex h-[54px] items-center px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-label"
          >
            See how it decides
          </a>
        </div>

        <p className="legend mt-5 block">
          No account · No install · A demo shelf is already racked
        </p>

        <div className="readout mt-7 max-w-[64ch]">
          Power on. {SAMPLE_LIBRARY.length} carts racked in the demo shelf, no
          Steam needed. Next: press OPEN THE BOARD and run a draw.
        </div>
      </div>

      <BoardMock />
    </section>
  );
}

/**
 * The machine, standing still.
 *
 * A landing page normally shows a screenshot here. A screenshot of this app is
 * a picture of a panel — so the panel is built instead, out of the same classes
 * the real screen uses. It is inert on purpose: nothing spins, because the one
 * thing you can do on this page is go and spin it yourself.
 */
/** Mostly two moods, with the odd outlier — what a real shelf looks like. */
const RACK_TINTS = [
  "var(--story)",
  "var(--story)",
  "var(--chill)",
  "var(--story)",
  "var(--challenge)",
  "var(--chill)",
  "var(--story)",
  "var(--quick)",
];

function BoardMock() {
  const seated = SAMPLE_LIBRARY[7] ?? SAMPLE_LIBRARY[0];

  return (
    <div className="panel !p-5 lg:!p-6" aria-hidden>
      <div className="chan chan-set">
        <span className="chan-no">01</span>
        <span className="chan-name">Session</span>
        <span className="seg ml-auto">
          <i data-on />
          <i data-on />
          <i />
        </span>
        <span className="chan-value">1–2 hrs</span>
      </div>

      <div className="chan chan-set border-t border-line-soft">
        <span className="chan-no">02</span>
        <span className="chan-name">Mood</span>
        <span className="ml-auto flex items-center gap-2">
          <i className="led" style={{ "--lit": "var(--story)" } as React.CSSProperties} />
          <i className="led" style={{ "--lit": "var(--chill)" } as React.CSSProperties} />
          <i
            className="led led-on"
            style={{ "--lit": "var(--challenge)" } as React.CSSProperties}
          />
          <i className="led" style={{ "--lit": "var(--quick)" } as React.CSSProperties} />
        </span>
        <span className="chan-value">Challenge</span>
      </div>

      <div className="chan border-t border-line-soft">
        <span className="chan-no">03</span>
        <span className="chan-name">Draw</span>
        <span className="chan-value ml-auto">Seated</span>
      </div>

      {/* the cart, in the slot */}
      <div className="cart mx-auto mt-5 w-[190px]">
        <div className="overflow-hidden rounded-label border border-black/25 bg-label">
          <div className="flex items-center justify-between bg-[#e34a2f] px-2.5 py-[5px] font-mono text-[8px] uppercase tracking-[0.16em] text-label">
            <span>Challenge</span>
            <span>SQ-{String(SAMPLE_LIBRARY.length).padStart(3, "0")}</span>
          </div>
          <div className="relative aspect-[5/6] overflow-hidden bg-paper">
            <CoverArt
              appid={seated.appid}
              name={seated.name}
              sizes="190px"
              priority
            />
          </div>
          <div className="flex items-baseline justify-between gap-2 bg-label px-2.5 pb-2 pt-[7px] text-ink">
            <b className="font-display text-[17px] font-bold uppercase leading-[0.95]">
              {seated.name}
            </b>
            <span className="whitespace-nowrap font-mono text-[9px] text-ink-soft">
              {Math.round(seated.playtimeMin / 60)}H
            </span>
          </div>
        </div>
      </div>

      <div className="deck-slot mx-6 mt-0 flex items-center justify-center gap-1.5">
        <i className="deck-led !bg-contacts" />
        <i className="deck-led" />
        <i className="deck-led" />
      </div>

      {/* the rack it came out of */}
      <div className="mt-5">
        <div className="flex items-end gap-[3px] overflow-hidden">
          {Array.from({ length: 22 }).map((_, i) => (
            <i
              key={i}
              className={`spine ${i % 3 === 1 ? "spine-cream" : ""} ${i === 7 ? "spine-gap" : ""}`}
              style={
                {
                  "--h": `${40 + ((i * 5) % 9)}px`,
                  // A real rack is mostly one or two moods with the odd
                  // outlier. Four tints in strict rotation stops reading as
                  // cartridges and starts reading as a bar chart.
                  "--tint": RACK_TINTS[i % RACK_TINTS.length],
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="shelf-board mt-px" />
      </div>

      <p className="legend legend-warn mt-4 block text-center">
        ⚠ Do not remove cart while powered
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- the problem */

function TheProblem() {
  const failures = [
    ["The twenty-minute scroll", "You open Steam to play something and close it having played nothing."],
    ["The same game again", "Six hundred titles, and the muscle memory goes to the one you finished twice."],
    ["The stranded save", "You were mid-run in something great four months ago. No idea where."],
  ];

  return (
    <section className="border-t border-line-soft pt-10">
      <p className="rule">What actually happens</p>
      <div className="grid gap-px bg-line-soft sm:grid-cols-3">
        {failures.map(([title, line]) => (
          <div key={title} className="bg-ground p-5">
            <b className="block font-display text-[22px] font-bold uppercase leading-[0.95]">
              {title}
            </b>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{line}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-[#b3c0c7]">
        None of those are a shortage of games. They are a shortage of a decision.
        SideQuest is the machine that makes it — in about four seconds, out of
        the library you already paid for.
      </p>
    </section>
  );
}

/* --------------------------------------------------------- how the board runs */

function HowItRuns() {
  const channels = [
    [
      "Session",
      "How long you actually have tonight — thirty minutes, a couple of hours, the whole evening. The segments on the channel are those hours.",
    ],
    [
      "Mood",
      "Story, chill, challenge, quick. Or type it in your own words: “something I can put down”, “I want to be tested”.",
    ],
    [
      "Draw",
      "The deck scans the rack, seats one cart and prints the label — what to play, and the reason it beat the other nine.",
    ],
  ];

  return (
    <section id="how" className="mt-16 border-t border-line-soft pt-10 lg:mt-24">
      <p className="rule">How the board runs</p>
      <h2 className="font-display text-[38px] font-extrabold uppercase leading-[0.9] lg:text-[52px]">
        Two settings and a switch
      </h2>
      <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-[#b3c0c7]">
        The numbering on the panel is not decoration. 01 and 02 are inputs, 03 is
        the output, and you genuinely cannot run 03 without the two above it —
        which is the whole instruction manual, printed on the machine.
      </p>

      <ol className="mt-8 grid gap-px bg-line-soft lg:grid-cols-3">
        {channels.map(([name, body], i) => (
          <li key={name} className="bg-ground p-6">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] tracking-[0.16em] text-contacts">
                {String(i + 1).padStart(2, "0")}
              </span>
              <b className="font-display text-[26px] font-extrabold uppercase leading-none">
                {name}
              </b>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------ how it scores */

function HowItScores() {
  const weights = [
    ["Mood match", "0–40", "Community tags weighed against the mood you set"],
    ["Session fit", "−12–20", "Short-burst vs. sprawling, against the time you have"],
    ["Momentum", "0–15", "Hours in the last fortnight — you are mid-run"],
    ["Rediscovery", "0–15", "Never launched, or barely touched and dormant"],
    ["Taste", "0–10", "The genres on your profile"],
    ["Anti-repetition", "−25", "Drawn for you recently"],
  ];

  return (
    <section id="scoring" className="mt-16 border-t border-line-soft pt-10 lg:mt-24">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
        <div>
          <p className="rule">Under the panel</p>
          <h2 className="font-display text-[38px] font-extrabold uppercase leading-[0.9] lg:text-[52px]">
            It is not a shuffle
          </h2>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[#b3c0c7]">
            Every game gets a score, and the score is a sum of named components.
            That is why the label on a cart can tell you what it won on — the
            badges are the maths, not a caption written next to it.
          </p>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[#b3c0c7]">
            The engine is plain TypeScript. No network, no model, no account: it
            runs in your browser in a couple of milliseconds, and it is the
            fallback for everything on this page that isn’t.
          </p>
          <p className="legend mt-5 block">lib/recommend.ts · these are the real weights</p>
        </div>

        <dl className="mt-8 grid gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.08em] lg:mt-0">
          {weights.map(([name, weight, signal]) => (
            <div
              key={name}
              className="flex items-baseline gap-2.5 border-b border-line-soft pb-1.5"
            >
              <dt className="w-[7.5rem] shrink-0 text-label">{name}</dt>
              <dd className="w-14 shrink-0 text-right text-contacts">{weight}</dd>
              <dd className="min-w-0 flex-1 normal-case tracking-normal text-ink-soft">
                {signal}
              </dd>
            </div>
          ))}
          <p className="mt-2.5 font-mono text-[10px] leading-relaxed normal-case tracking-normal text-ink-soft">
            The top five go into a weighted draw, so a clear winner usually wins
            and the spin stays a spin.
          </p>
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- the AI layer */

function TheAiLayer() {
  const uses = [
    ["The pick", "Chooses one game out of the shortlist the engine ranked, and writes the sentence saying why it fits tonight."],
    ["The read-back", "Weeks later, reads your own session notes back as one line: here is where you stopped, here is the first thing to do."],
    ["Plain-language search", "“Something short I don’t have to think about” — turned into a filter over your shelf’s own tags."],
    ["The portrait", "What the tags and the hours say about you as a player, and what your shelf shows you avoid."],
    ["The roast", "Three jabs about the backlog, written from the real numbers. Mocks the habit, never the person."],
    ["The session note", "Tidies what you typed after playing into the line you’ll actually understand in a month."],
  ];

  return (
    <section id="ai" className="mt-16 border-t border-line-soft pt-10 lg:mt-24">
      <p className="rule">The AI layer</p>
      <h2 className="font-display text-[38px] font-extrabold uppercase leading-[0.9] lg:text-[52px]">
        The model never ranks.
        <br />
        It only chooses and phrases.
      </h2>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-[#b3c0c7]">
        The ordering matters, and it is the reason this is cheap: the local
        engine ranks your whole library, and the model only ever sees the dozen
        games worth arguing about. It cannot invent a game you don’t own — every
        answer is snapped back to your shelf before it is shown.
      </p>

      <div className="mt-8 grid gap-px bg-line-soft sm:grid-cols-2 lg:grid-cols-3">
        {uses.map(([title, body]) => (
          <div key={title} className="bg-ground p-5">
            <div className="flex items-center gap-2.5">
              <i className="led led-on" aria-hidden />
              <b className="font-display text-[20px] font-bold uppercase leading-none">
                {title}
              </b>
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">{body}</p>
          </div>
        ))}
      </div>

      {/* The spend plate. Every number here is imported from the guard that
          enforces it — a page that quotes a cap the code no longer honours is
          worse than a page that quotes none. */}
      <div className="plate mt-8 p-6 lg:p-8">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          <div>
            <p className="rule !mt-0">What it costs to run</p>
            <p className="max-w-[46ch] text-[14px] leading-relaxed text-[#b3c0c7]">
              A companion app that quietly bills a model on every page view is a
              companion app you switch off. So the spend is bounded in one file,
              the app reports its own consumption on your profile, and every
              guard degrades to the local engine instead of erroring.
            </p>
            <p className="legend mt-4 block">lib/ai-guard.ts · four guards, in order</p>
          </div>

          <dl className="mt-6 grid gap-y-2 font-mono text-[10px] uppercase tracking-[0.1em] lg:mt-0">
            <Spec label="Model" value="gpt-5-nano" />
            <Spec
              label="Price"
              value={`$${PRICE_PER_MTOK.input.toFixed(2)}/M in · $${PRICE_PER_MTOK.output.toFixed(2)}/M out`}
            />
            <Spec label="Games per prompt" value={`${LIMITS.maxCandidates} max`} />
            <Spec
              label="Daily ceiling"
              value={`${(LIMITS.globalTokensPerDay / 1000).toFixed(0)}k tokens ≈ $${DAILY_CEILING_USD.toFixed(2)}`}
            />
            <Spec label="Cache" value="24 h, identical asks are free" />
            <Spec label="Timeout" value={`${LIMITS.timeoutMs / 1000}s, then local`} />
          </dl>
        </div>

        <div className="readout mt-6">
          No key, no problem: the picker, the roast, the notes and the search all
          still run. The scoring engine is local and was never the part that
          needed a model.
        </div>
      </div>
    </section>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line-soft pb-2">
      <dt className="w-[9rem] shrink-0 text-ink-soft">{label}</dt>
      <dd className="min-w-0 flex-1 text-label">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ pricing */

function Pricing() {
  const tiers = [
    {
      name: "Local board",
      price: "$0",
      note: "Forever, no account",
      lead: "The whole machine, running on your own hardware.",
      lines: [
        "Steam import by SteamID64",
        "Unlimited draws on the scoring engine",
        "Shelf, Saves and the session notes",
        "The roast, written from templates",
        "Installs as an app, works offline",
      ],
      cta: "Open the board",
      lit: true,
    },
    {
      name: "Powered",
      price: "$3",
      note: "per month",
      lead: "Everything above, with the model in the slot.",
      lines: [
        "The pick sentence, written for tonight",
        "The read-back on your old saves",
        "Plain-language shelf search",
        "The portrait and the written roast",
        "Your own key, or ours — the gauge is on your profile either way",
      ],
      cta: "Free while the panel is open",
      lit: false,
    },
    {
      name: "Operator",
      price: "$6",
      note: "per month",
      lead: "The board, plus the agent that sits over the game.",
      lines: [
        "Everything in Powered",
        "Desktop overlay, tray-resident",
        "Global hotkey: where am I, what next",
        "Reads the screen, answers over the game",
        "Its own spend guard, persisted between runs",
      ],
      cta: "Free while the panel is open",
      lit: false,
    },
  ];

  return (
    <section id="pricing" className="mt-16 border-t border-line-soft pt-10 lg:mt-24">
      <p className="rule">What it costs you</p>
      <h2 className="font-display text-[38px] font-extrabold uppercase leading-[0.9] lg:text-[52px]">
        One board, three depths
      </h2>
      <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-[#b3c0c7]">
        The free tier is not a trial with the good parts removed: the engine that
        actually picks your game is the local one, and it is in every tier. What
        you pay for is the layer that talks.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3 lg:gap-5">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`plate flex flex-col p-6 ${
              t.lit ? "!border-contacts/40 shadow-[0_0_0_1px_rgba(255,176,32,.12)]" : ""
            }`}
          >
            <div className="flex items-center gap-2.5">
              <i className={`led ${t.lit ? "led-on" : ""}`} aria-hidden />
              <b className="font-mono text-[10px] uppercase tracking-[0.18em] text-label">
                {t.name}
              </b>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <b className="font-display text-[52px] font-extrabold leading-[0.8]">
                {t.price}
              </b>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft">
                {t.note}
              </span>
            </div>

            <p className="mt-3 text-[13px] leading-relaxed text-[#b3c0c7]">{t.lead}</p>

            <ul className="mt-5 grid gap-2 border-t border-line-soft pt-4">
              {t.lines.map((line) => (
                <li key={line} className="flex gap-2.5 text-[13px] leading-snug text-ink-soft">
                  <span className="mt-[7px] h-1 w-1 shrink-0 bg-contacts" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>

            <Link
              href="/play"
              className={`mt-6 inline-flex min-h-11 items-center justify-center px-4 font-mono text-[10px] uppercase tracking-[0.14em] ${
                t.lit
                  ? "switch !h-[46px] font-display !text-[17px] font-extrabold tracking-[0.12em]"
                  : "key text-ink-soft transition-colors hover:text-label"
              }`}
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>

      <div className="readout mt-5">
        Nothing is billed yet. There is no card form anywhere in this app — every
        tier runs free while the panel is open, and the paid ones are what the
        layer would cost once it isn’t.
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ what it needs */

function WhatItNeeds() {
  const facts = [
    ["A SteamID64", "Seventeen digits off your profile URL. Never your password — SideQuest reads the public Web API and nothing else."],
    ["Your browser", "The library, the history and the notes live in local storage on your device. There is no account to make and no server holding your shelf."],
    ["Nothing else", "It installs as an app if you want it to, works offline once loaded, and runs the whole draw without a network round-trip."],
  ];

  return (
    <section className="mt-16 border-t border-line-soft pt-10 lg:mt-24">
      <p className="rule">What it needs from you</p>
      <div className="grid gap-px bg-line-soft sm:grid-cols-3">
        {facts.map(([title, body]) => (
          <div key={title} className="bg-ground p-5">
            <b className="block font-display text-[22px] font-bold uppercase leading-[0.95]">
              {title}
            </b>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- last call */

function LastCall() {
  return (
    <section className="mt-16 lg:mt-24">
      <div className="plate flex flex-col items-center px-6 py-14 text-center lg:py-20">
        <p className="legend">Demo shelf loaded · no connection required</p>
        <h2 className="mt-4 max-w-[18ch] font-display text-[42px] font-extrabold uppercase leading-[0.88] lg:text-[64px]">
          One free hour. One decision.
        </h2>
        <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-[#b3c0c7]">
          Set the two channels, press the switch, and the board hands you a game
          and a reason. If it’s wrong, run it again — it remembers what it just
          gave you.
        </p>
        <Link
          href="/play"
          className="switch mt-8 inline-flex h-[56px] !w-auto items-center gap-3 px-8 font-display text-[22px] font-extrabold uppercase tracking-[0.12em]"
        >
          Run a draw
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- footer */

function Footer() {
  return (
    <footer className="border-t border-line-soft">
      <div className="room flex flex-wrap items-center justify-between gap-4 py-8">
        <p className="legend">SideQuest · Rev 1 · Built by Karim Sehil</p>
        <div className="flex items-center gap-5">
          <Link
            href="/play"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-label"
          >
            Draw
          </Link>
          <Link
            href="/connect"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-label"
          >
            Connect Steam
          </Link>
          <span className="legend">Service code ↑↑↓↓←→←→BA</span>
        </div>
      </div>
    </footer>
  );
}
