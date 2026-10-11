"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mark } from "@/components/logo";
import { useI18n } from "@/i18n/context";
import { LOCALE_LABEL } from "@/i18n/locale";
import { heroFor } from "@/lib/library";
import "./landing.css";

/**
 * The landing — a mood dial (handoff Claude Design, 2026-10-11).
 *
 * The hero is a toy version of the Draw: pick a mood and a time, and a verdict
 * card answers from a fixed demo shelf, scored in the page with the same six
 * components the engine uses. It is a demo of the idea, not the engine — no
 * network, no library, nothing stored. The real thing is one click away.
 *
 * Then four sections: why you need it, how it decides (the bars follow the
 * verdict above), what it would cost, and one last push to the demo.
 */

/**
 * What the running deployment can actually do, measured on the server rather
 * than asserted in copy.
 *
 * The pricing grid used to promise a Steam import and an AI layer that the
 * live site had no keys for: three features listed under a price, none of them
 * reachable, and nothing on the page admitting it. Capability now comes from
 * the environment, so the grid corrects itself the moment a key is added
 * instead of waiting for someone to notice the copy is stale.
 */
export type Capabilities = {
  steam: boolean;
  ai: boolean;
  overlay: boolean;
};

const GITHUB = "https://github.com/KarimS78/sidequest";

/** [name, appid, [main mood, second mood], ideal minutes, momentum 0–1, rediscovery 0–1] */
type DemoGame = [string, number, [number, number], number, number, number];

const GAMES: DemoGame[] = [
  ["Hades", 1145360, [0, 1], 40, 0.7, 0.1],
  ["Hollow Knight", 367520, [1, 4], 90, 0.2, 0.3],
  ["Stardew Valley", 413150, [2, 5], 60, 0.4, 0.2],
  ["Celeste", 504230, [0, 3], 30, 0.1, 0.6],
  ["Slay the Spire", 646570, [1, 3], 45, 0.5, 0.2],
  ["Outer Wilds", 753640, [4, 2], 120, 0, 0.9],
  ["Dead Cells", 588650, [0, 1], 35, 0.8, 0],
  ["Portal 2", 620, [3, 5], 75, 0, 0.7],
];

/** Same order and ceilings as the engine: mood, session, momentum, rediscovery, taste, no repeats. */
const MAXES = [40, 20, 15, 10, 10, 5];
const COMPONENT_KEYS = ["mood", "session", "momentum", "rediscovery", "taste", "repeat"] as const;

function scoreDemo(g: DemoGame, mood: number, time: number, seed: number, idx: number) {
  const [, , moods, ideal, momentum, rediscovery] = g;
  const moodS =
    moods[0] === mood
      ? 36 + ((seed + idx) % 5)
      : moods[1] === mood
        ? 22 + ((seed + idx) % 6)
        : 6 + ((seed * 3 + idx) % 8);
  const sessionS = Math.max(2, Math.round(20 - Math.abs(time - ideal) / 10));
  const tasteS = 4 + ((seed + idx * 2) % 6);
  const repeatS = (seed + idx) % 2 ? 5 : 2;
  return [moodS, sessionS, Math.round(momentum * 15), Math.round(rediscovery * 10), tasteS, repeatS];
}

function timeLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

/** The art, or — if Steam's CDN says no — the card's own ground and the name. */
function VerdictArt({ appid, name }: { appid: number; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      src={heroFor(appid)}
      alt={name}
      fill
      sizes="(min-width: 900px) 50vw, 100vw"
      priority
      onError={() => setFailed(true)}
    />
  );
}

/** Pointer dot. Only with a real mouse; touch never sees it. */
function useCursor(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const dot = ref.current;
    if (!dot) return;
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: MouseEvent) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      dot.classList.add("is-on");
      const over = (e.target as Element | null)?.closest?.("a,button,input");
      dot.classList.toggle("is-over", Boolean(over));
    };
    const onLeave = () => dot.classList.remove("is-on");
    addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [ref]);
}

/** Sections rise once, the first time a tenth of them is on screen. */
function useReveal(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-seen");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.1 }
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ref]);
}

export function Landing({ caps, fontClass = "" }: { caps: Capabilities; fontClass?: string }) {
  const { d, locale, setLocale } = useI18n();
  const l = d.landing;
  const other = locale === "fr" ? "en" : "fr";

  const [mood, setMood] = useState(0);
  const [time, setTime] = useState(60);
  const [seed, setSeed] = useState(0);
  const [hoverComp, setHoverComp] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  useCursor(cursorRef);
  useReveal(rootRef);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Rank the whole demo shelf; Reroll alternates between first and second.
  const pick = useMemo(() => {
    const ranked = GAMES.map((g, i) => {
      const s = scoreDemo(g, mood, time, seed, i);
      return { g, s, total: s.reduce((a, b) => a + b, 0) };
    }).sort((a, b) => b.total - a.total);
    return ranked[seed % 2 === 0 ? 0 : 1];
  }, [mood, time, seed]);

  const [name, appid] = pick.g;
  const pct = (i: number) => `${Math.round((pick.s[i] / MAXES[i]) * 100)}%`;

  /** Per plan, in the order they are written: live, off, or not out yet. */
  const planState = [
    { on: true, note: caps.steam ? null : l.pricing.noSteamKey },
    { on: caps.ai, note: caps.ai ? null : l.pricing.noAiKey },
    { on: caps.overlay, note: null },
  ];

  const navLinks = [
    { href: "#problem", label: l.nav.problem },
    { href: "#how", label: l.nav.how },
    { href: "#pricing", label: l.nav.pricing },
    { href: GITHUB, label: "GitHub" },
  ];

  return (
    <div ref={rootRef} className={`lp ${fontClass}`}>
      <div ref={cursorRef} className="lp-cursor" aria-hidden />
      <div className="lp-scanlines" aria-hidden />

      {/* ============ nav ============ */}
      <header className={`lp-nav ${scrolled ? "is-scrolled" : ""}`}>
        <a href="#top" className="lp-brand" aria-label={d.common.brand}>
          <Mark size={26} />
          <span className="lp-brand-word">SideQuest</span>
        </a>
        <nav className="lp-nav-links" aria-label={d.nav.aria}>
          {navLinks.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav-right">
          <button
            type="button"
            className="lp-lang"
            lang={other}
            onClick={() => setLocale(other)}
            aria-label={d.common.langSwitch}
          >
            {LOCALE_LABEL[other]}
          </button>
          <Link href="/play" className="lp-btn lp-btn-acid lp-play">
            {l.nav.play}
          </Link>
          <button
            type="button"
            className="lp-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="lp-menu"
            aria-label="Menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span />
          </button>
        </div>
      </header>
      <nav
        id="lp-menu"
        className={`lp-menu ${menuOpen ? "is-open" : ""}`}
        aria-label="Menu"
        onClick={(e) => (e.target as Element).closest("a") && setMenuOpen(false)}
      >
        {navLinks.map((n) => (
          <a key={n.href} href={n.href}>
            {n.label}
          </a>
        ))}
        <Link href="/play" className="lp-btn lp-btn-acid">
          {l.hero.primary} →
        </Link>
      </nav>

      <main>
        {/* ============ hero: the mood dial ============ */}
        <section id="top" className="lp-hero">
          <div>
            <div className="lp-eyebrow">
              <span className="lp-dot" aria-hidden />
              {l.hero.eyebrow}
            </div>
            <h1 className="lp-h1">
              {l.hero.title[0]}
              <br />
              <span>{l.hero.title[1]}</span>
            </h1>
            <p className="lp-lede">{l.hero.lede}</p>

            <div className="lp-controls">
              <div className="lp-label" id="lp-mood-label">
                {l.hero.moodLabel}
              </div>
              <div className="lp-chips" role="group" aria-labelledby="lp-mood-label">
                {l.hero.moods.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    className="lp-chip"
                    aria-pressed={mood === i}
                    onClick={() => setMood(i)}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <label className="lp-label" htmlFor="lp-time">
                <span>{l.hero.timeLabel}</span>
                <b>{timeLabel(time)}</b>
              </label>
              <input
                id="lp-time"
                className="lp-range"
                type="range"
                min={15}
                max={240}
                step={15}
                value={time}
                aria-valuetext={timeLabel(time)}
                onChange={(e) => setTime(Number(e.target.value))}
              />

              <div className="lp-actions">
                <Link href="/play" className="lp-btn lp-btn-acid lp-btn-big">
                  {l.hero.primary} →
                </Link>
                <button
                  type="button"
                  className="lp-btn lp-btn-outline lp-btn-big"
                  onClick={() => setSeed((s) => s + 1)}
                >
                  ↻ {l.hero.reroll}
                </button>
              </div>
              <p className="lp-proof">{l.hero.reassure}</p>
            </div>
          </div>

          {/* The verdict. Its key changes with every input, so it re-enters. */}
          <div className="lp-verdict-wrap">
            <div className="lp-glow" aria-hidden />
            <article
              key={`${name}-${seed}-${mood}-${time}`}
              className="lp-verdict"
              aria-live="polite"
            >
              <div className="lp-verdict-art">
                <VerdictArt key={appid} appid={appid} name={name} />
                <span className="lp-tonight">
                  <span className="lp-dot" aria-hidden />
                  {l.hero.tonight}
                </span>
                <h2 className="lp-game">{name}</h2>
              </div>
              <div className="lp-verdict-body">
                <p className="lp-sentence">{l.verdicts[name]}</p>
                <div className="lp-scores">
                  {COMPONENT_KEYS.map((k, i) => (
                    <div key={k} className="lp-score">
                      <span className="lp-score-name">{d.common.components[k]}</span>
                      <span className="lp-track">
                        <i style={{ width: pct(i) }} />
                      </span>
                      <span className="lp-score-val">
                        {pick.s[i]}/{MAXES[i]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="lp-total">
                  <span>{l.hero.score}</span>
                  <b>{pick.total} / 100</b>
                </div>
              </div>
            </article>
            <div className="lp-sticker">{l.hero.notShortlist}</div>
          </div>
        </section>

        {/* ============ marquee ============ */}
        <div className="lp-marquee">
          <div className="lp-marquee-track">
            {[0, 1].map((copy) =>
              l.marquee.map((m) => (
                <span key={`${copy}-${m}`} aria-hidden={copy === 1 || undefined}>
                  {m}
                  <span className="lp-diamond" style={{ width: 8, height: 8 }} aria-hidden />
                </span>
              ))
            )}
          </div>
        </div>

        {/* ============ the problem ============ */}
        <section id="problem" className="lp-section">
          <div data-reveal className="lp-inner lp-problem">
            <div>
              <span className="lp-eyebrow">{l.problem.eyebrow}</span>
              <h2 className="lp-h2">{l.problem.title}</h2>
            </div>
            <ul>
              {l.problem.lines.map((line, i) => (
                <li key={line}>
                  <b>0{i + 1}</b>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ============ how it picks ============ */}
        <section id="how" className="lp-section lp-how">
          <div data-reveal className="lp-inner">
            <div className="lp-how-head">
              <h2 className="lp-h2">{l.how.title}</h2>
              <p>{l.how.lede}</p>
            </div>
            <div className="lp-grid" onMouseLeave={() => setHoverComp(-1)}>
              {l.how.items.map((item, i) => (
                <article key={COMPONENT_KEYS[i]} className="lp-cell" onMouseEnter={() => setHoverComp(i)}>
                  <div className="lp-cell-head">
                    <span className="lp-cell-name">{d.common.components[COMPONENT_KEYS[i]]}</span>
                    <span className="lp-cell-max">/ {item.max}</span>
                  </div>
                  <p>{item.line}</p>
                  <span className="lp-track" aria-hidden>
                    <i style={{ width: hoverComp === i ? "100%" : pct(i) }} />
                  </span>
                </article>
              ))}
            </div>
            <p className="lp-note">{l.how.closing}</p>
          </div>
        </section>

        {/* ============ pricing ============ */}
        <section id="pricing" className="lp-section">
          <div data-reveal className="lp-inner">
            <div className="lp-center">
              <span className="lp-eyebrow">{l.pricing.eyebrow}</span>
              <h2 className="lp-h2">{l.pricing.title}</h2>
            </div>
            <div className="lp-plans">
              {l.pricing.plans.map((plan, i) => {
                const state = planState[i];
                const featured = "featured" in plan && plan.featured && state.on;
                return (
                  <article
                    key={plan.name}
                    className={`lp-plan ${featured ? "is-featured" : ""} ${state.on ? "" : "is-off"}`}
                  >
                    <div className="lp-plan-head">
                      <h3>{plan.name}</h3>
                      {/* Read from the server's environment, not written here. */}
                      <span className={`lp-tag ${state.on ? "is-live" : ""}`}>
                        {state.on
                          ? l.pricing.status.live
                          : i === 2
                            ? l.pricing.status.soon
                            : l.pricing.status.off}
                      </span>
                    </div>
                    <div className="lp-price">
                      <b>{plan.price}</b>
                      <span>{plan.per}</span>
                    </div>
                    <p>{plan.line}</p>
                    <ul>
                      {plan.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    {state.note && <p className="lp-plan-note">{state.note}</p>}
                    {i === 2 && !state.on ? (
                      // Nothing to open yet: a label, not a link to the Draw.
                      <span role="link" aria-disabled="true" className="lp-btn lp-btn-outline lp-plan-cta">
                        {plan.cta}
                      </span>
                    ) : (
                      <Link
                        href="/play"
                        className={`lp-btn lp-plan-cta ${featured ? "lp-btn-acid" : "lp-btn-outline"}`}
                      >
                        {plan.cta}
                        {featured && " →"}
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
            <p className="lp-honesty">{l.pricing.honesty}</p>
          </div>
        </section>

        {/* ============ final push ============ */}
        <section className="lp-cta">
          <div data-reveal>
            <h2>{l.cta.title}</h2>
            <p>{l.cta.lede}</p>
            <Link href="/play" className="lp-btn">
              {l.hero.primary} →
            </Link>
            <div className="lp-cta-proof">{l.hero.reassure}</div>
          </div>
        </section>
      </main>

      {/* ============ footer ============ */}
      <footer className="lp-footer">
        <span className="lp-brand-word" style={{ fontSize: 13, color: "var(--lp-fg)" }}>
          SideQuest
        </span>
        <nav aria-label="Footer">
          <a href="https://karimsehil.com" target="_blank" rel="noreferrer">
            {l.footer.built}
          </a>
          <a href={GITHUB} target="_blank" rel="noreferrer">
            {l.footer.source}
          </a>
        </nav>
        <span>{l.footer.tag}</span>
      </footer>
    </div>
  );
}
