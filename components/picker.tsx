"use client";

import Image from "next/image";
import Link from "next/link";
import { preload } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { explain, recommendGame, REASON_MAX, shortlist } from "@/lib/recommend";
import { getAiPick, summariseNote } from "@/app/play/actions";
import { deviceId } from "@/lib/device";
import { unlock } from "@/lib/eggs";
import { Letters, useCountUp, useMagnetic, prefersReducedMotion } from "@/components/motion";
import {
  addToBlacklist,
  headerFor,
  heroFor,
  loadBlacklist,
  loadLibrary,
  loadProfile,
  SAMPLE_LIBRARY,
  type StoredGame,
} from "@/lib/library";
import {
  addHistory,
  lastNoteFor,
  loadHistory,
  markPlayed,
  setNote as saveNote,
  type SessionNote,
} from "@/lib/history";
import type {
  PickerTime,
  PickerMood,
  Recommendation,
  RecommendInput,
  ScoredReason,
} from "@/lib/recommend";
import { useI18n } from "@/i18n/context";
import { componentLabel, reasonLine, verdictProse } from "@/i18n/reasons";
import type { Locale } from "@/i18n/locale";

/* ============================================================
   THE DRAW

   Four beats, and the only one the player is asked to sit through is
   the second:

     1. commit    the panel takes over, the art goes soft
     2. roll    ~2.5s  covers pass, DECELERATING — 60ms, then 90, 140, 220
     3. seat     the winner lands on a spring, one violet flash on the frame
     4. read     the name types itself, then the line, then the numbers count

   The deceleration is the whole trick. A reel at a constant rate is a
   loading spinner; a reel that slows down is a decision being made, and
   the eye reads the last three frames as "it nearly picked that one".

   The engine answers in under a millisecond and the model runs alongside.
   The reveal waits for the reel, never the other way round.
   ============================================================ */

/** Frame durations, in order. Sums to ~2.5s. */
function reelSchedule(): number[] {
  return [
    ...Array<number>(12).fill(60),
    ...Array<number>(6).fill(90),
    ...Array<number>(4).fill(140),
    ...Array<number>(3).fill(220),
  ];
}

const SEAT_MS = 180;
const READ_MS = 420;

const TIMES: PickerTime[] = ["short", "medium", "long"];
const MOODS: PickerMood[] = ["chill", "story", "challenge", "quick"];

/** Defaults for "let the clock decide": nobody starts a CRPG at 11pm on a Tuesday. */
function timeOfDayContext(): { time: PickerTime; mood: PickerMood } {
  const now = new Date();
  const h = now.getHours();
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  if (h >= 23 || h < 6) return { time: "short", mood: "chill" };
  if (weekend && h >= 10 && h < 20) return { time: "long", mood: "story" };
  return { time: "medium", mood: "chill" };
}

type Phase = "idle" | "rolling" | "done";

/**
 * Swap in the game the model chose, keeping the engine's badges for THAT game.
 * The sentence is the model's; the numbers stay the engine's, so what is on
 * screen can never drift from what was computed.
 */
function applyAiPick(
  local: Recommendation,
  ai: { appid: number; reason: string },
  input: RecommendInput
): Recommendation {
  if (ai.appid === local.pick.appid) {
    return { ...local, pick: { ...local.pick, reason: ai.reason } };
  }
  const board = explain(input);
  const chosen = board.find((s) => s.game.appid === ai.appid);
  if (!chosen) return local;

  const earned = (s: (typeof board)[number]) =>
    s.components
      .filter((c) => c.points > 0 && c.reason)
      .sort((a, b) => b.points - a.points);

  const scored = (s: (typeof board)[number]): ScoredReason[] =>
    earned(s)
      .slice(0, 4)
      .map((c) => ({
        ...c.reason!,
        points: Math.round(c.points),
        max: REASON_MAX[c.reason!.key],
      }));

  return {
    pick: {
      appid: chosen.game.appid,
      name: chosen.game.name,
      reason: ai.reason,
      reasons: scored(chosen),
    },
    alternatives: board
      .filter((s) => s.game.appid !== ai.appid)
      .slice(0, 2)
      .map((s) => ({
        appid: s.game.appid,
        name: s.game.name,
        reason: earned(s)[0]?.reason?.label ?? "Another solid fit.",
        hint: earned(s)[0]?.reason,
      })),
  };
}

/* ============================================================
   Art
   ============================================================ */

/**
 * The wide key art, falling back to the header and then to type. Not every
 * appid has a `library_hero`, and a broken image in the one panel the app is
 * built around would be the worst possible place for it.
 */
function KeyArt({
  appid,
  name,
  priority = false,
  unoptimized = false,
}: {
  appid: number;
  name: string;
  priority?: boolean;
  unoptimized?: boolean;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [appid]);

  if (step > 1) {
    return (
      <span className="absolute inset-0 flex items-center justify-center bg-surface2 p-8 text-center">
        <span className="poster text-[2rem] text-subtle">{name}</span>
      </span>
    );
  }

  return (
    <Image
      key={`${appid}-${step}`}
      src={step === 0 ? heroFor(appid) : headerFor(appid)}
      alt=""
      fill
      sizes="(min-width: 1024px) 60vw, 100vw"
      priority={priority}
      unoptimized={unoptimized}
      onError={() => setStep((s) => s + 1)}
      className="object-cover"
    />
  );
}

/* ============================================================
   Verdict badges
   ============================================================ */

function Badge({
  reason,
  locale,
  run,
  onPoke,
}: {
  reason: ScoredReason;
  locale: Locale;
  run: boolean;
  onPoke: () => void;
}) {
  const value = useCountUp(reason.points, run);
  return (
    <button type="button" onClick={onPoke} className="badge cursor-default">
      {componentLabel(locale, reason.key)}{" "}
      <b>
        {value}/{reason.max}
      </b>
    </button>
  );
}

/* ============================================================
   The screen
   ============================================================ */

export function Picker() {
  const { d, locale } = useI18n();

  const [library, setLibrary] = useState<StoredGame[] | null>(null);
  const [isSample, setIsSample] = useState(true);
  const [genres, setGenres] = useState<string[]>([]);
  const [blacklist, setBlacklist] = useState<number[]>([]);
  const [recentAppids, setRecentAppids] = useState<number[]>([]);

  const [time, setTime] = useState<PickerTime>("medium");
  const [mood, setMood] = useState<PickerMood | null>("story");
  const [customMood, setCustomMood] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missedMood, setMissedMood] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [played, setPlayed] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [lastNote, setLastNote] = useState<SessionNote | null>(null);
  const [excluded, setExcluded] = useState<number[]>([]);

  /** The cover currently in the window while the reel runs. */
  const [reel, setReel] = useState<{ appid: number; frame: number; ms: number } | null>(null);
  /** One violet flash on the frame as the winner lands. */
  const [flash, setFlash] = useState(false);
  /** The card leaving to the left when the player rejects a pick. */
  const [dealing, setDealing] = useState(false);
  /** Badges only count once the line above them has been read. */
  const [countRun, setCountRun] = useState(false);
  /**
   * The model's sentence, when there is one.
   *
   * Held apart from the pick rather than sniffed out of it: `pick.reason` is
   * English either way, so comparing it against the local prose to guess who
   * wrote it printed English at a French player every time the model was off.
   */
  const [aiSentence, setAiSentence] = useState<string | null>(null);

  /* ---- the hidden half (lib/eggs.ts). None of it changes what the app does. */
  const blows = useRef(0);
  const badgePokes = useRef<Set<string>>(new Set());
  const [payRespects, setPayRespects] = useState(false);

  useEffect(() => {
    if (!payRespects) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "f") return;
      unlock("respects");
      setPayRespects(false);
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => setPayRespects(false), 9000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [payRespects]);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pullRef = useMagnetic<HTMLButtonElement>();

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const lib = loadLibrary();
    setLibrary(lib ?? SAMPLE_LIBRARY);
    setIsSample(!lib);
    setGenres(loadProfile().favoriteGenres);
    setBlacklist(loadBlacklist());
    const history = loadHistory();
    setRecentAppids([...new Set(history.slice(0, 8).map((e) => e.pick.appid))]);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const blacklistSet = new Set(blacklist);
  const pool = (library ?? []).filter((g) => !blacklistSet.has(g.appid));

  /**
   * The covers the reel will flick through.
   *
   * Capped at twenty, and preloaded the moment the shelf is known — not when
   * the draw starts. The first dozen frames are 60ms apart, which is not
   * enough time to fetch anything, and the first version of this rolled a
   * black rectangle for a second and a half before the images caught up.
   */
  const runway = useMemo(() => pool.slice(0, 20), [pool.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    runway.forEach((g) => preload(headerFor(g.appid), { as: "image" }));
  }, [runway]);

  // A shelf of a very particular size.
  useEffect(() => {
    if (pool.length === 42) unlock("answer");
  }, [pool.length]);

  const buzz = (ms: number) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      // unsupported, never fatal
    }
  };

  function pull(exclude: number[] = []) {
    if (phase === "rolling") return;
    if (!pool.length) return;
    const custom = customMood.trim();
    if (!mood && !custom) {
      setError(d.draw.errors.pickFirst);
      return;
    }

    timers.current.forEach(clearTimeout);
    timers.current = [];
    setError(null);
    setMissedMood(null);
    setResult(null);
    setAiSentence(null);
    setCountRun(false);
    setFlash(false);
    setPhase("rolling");

    panelRef.current?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });

    const engineInput: RecommendInput = {
      library: pool.map((g) => ({
        appid: g.appid,
        name: g.name,
        playtimeMin: g.playtimeMin,
        recentMin: g.recentMin ?? 0,
        tags: g.tags,
      })),
      favoriteGenres: genres,
      time,
      mood: mood ?? undefined,
      customMood: custom || undefined,
      excludeAppids: exclude,
      recentAppids,
    };

    const res = recommendGame(engineInput);
    if (!res.ok) {
      setPhase("idle");
      setError(res.error);
      return;
    }

    const moodLabel = custom || d.common.mood[mood!].label;

    // The model only ever sees the engine's shortlist, and it runs while the
    // reel does. Anything short of a clean answer leaves the local pick standing.
    const aiPromise: Promise<{ appid: number; reason: string } | null> = getAiPick({
      deviceId: deviceId(),
      candidates: shortlist(engineInput),
      time: d.common.time[time].full,
      mood: moodLabel,
      locale,
    })
      .then((r) => (r.ok ? { appid: r.appid, reason: r.reason } : null))
      .catch(() => null);

    /* ---- beat 2: the reel ---- */
    const schedule = reelSchedule();
    const strip = runway.length ? runway : pool;
    let at = 0;
    schedule.forEach((ms, i) => {
      after(at, () => {
        // Stride by three so consecutive frames are never neighbours on the
        // shelf — a reel that goes A, B, C in shelf order reads as a list.
        const g = strip[(i * 3 + 1) % strip.length];
        setReel({ appid: g.appid, frame: i, ms });
        if (i % 3 === 0) buzz(8);
      });
      at += ms;
    });

    /* ---- beats 3 and 4: seat, then read ---- */
    after(at, () => {
      setFlash(true);
      buzz(40);
      after(400, () => setFlash(false));
    });

    after(at + SEAT_MS, async () => {
      const ai = await aiPromise;
      const merged = ai ? applyAiPick(res.recommendation, ai, engineInput) : res.recommendation;

      setResult(merged);
      setAiSentence(ai?.reason ?? null);
      setMissedMood(res.note ? custom : null);
      setReel(null);
      setPhase("done");

      const game = pool.find((g) => g.appid === merged.pick.appid);
      const entry = addHistory({
        time,
        mood: moodLabel,
        pick: {
          appid: merged.pick.appid,
          name: merged.pick.name,
          coverUrl: game?.coverUrl ?? "",
        },
        alternatives: merged.alternatives.map((a) => ({ appid: a.appid, name: a.name })),
      });
      setEntryId(entry.id);
      setPlayed(false);
      setNoteSaved(false);
      // The entry just added carries no note, so this finds the previous
      // session's — which is what "where you left off" means.
      setLastNote(lastNoteFor(merged.pick.appid));

      // The numbers wait for the name and the line to land.
      after(READ_MS + merged.pick.name.length * 25, () => setCountRun(true));
    });
  }

  function letItChoose() {
    const ctx = timeOfDayContext();
    setTime(ctx.time);
    setMood(ctx.mood);
    setCustomMood("");
    setShowCustom(false);
    setExcluded([]);
    // State has not flushed yet, so pull() would read the old mood — defer a tick.
    after(0, () => pull([]));
  }

  function reject() {
    if (!result) return;
    setDealing(true);
    const next = [...excluded, result.pick.appid];
    setExcluded(next);
    after(260, () => {
      setDealing(false);
      pull(next);
    });
  }

  function hideGame(appid: number) {
    setBlacklist(addToBlacklist(appid));
    setPayRespects(true);
    const next = [...excluded, appid];
    setExcluded(next);
    pull(next);
  }

  function handlePlayed() {
    if (!entryId) return;
    markPlayed(entryId);
    setPlayed(true);
  }

  function handleNote(raw: string) {
    if (!entryId || !result) return;
    const trimmed = raw.trim();
    if (!trimmed) return;

    saveNote(entryId, { raw: trimmed, lastTime: trimmed });
    setNoteSaved(true);

    summariseNote({ deviceId: deviceId(), game: result.pick.name, raw: trimmed, locale })
      .then((s) =>
        saveNote(entryId, { raw: trimmed, lastTime: s.lastTime, whatsNext: s.whatsNext })
      )
      .catch(() => {
        // Their own words are already stored — nothing to recover.
      });
  }

  if (library === null) return <PickerSkeleton />;

  if (!pool.length) {
    return (
      <div className="wrap flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="poster text-[clamp(2rem,6vw,3rem)]">{d.draw.empty.title}</h1>
        <p className="max-w-sm text-muted">{d.draw.empty.line}</p>
        <Link href="/connect" className="btn btn-primary mt-2">
          {d.draw.empty.cta} <span className="arrow">→</span>
        </Link>
      </div>
    );
  }

  const rolling = phase === "rolling";
  const pick = result?.pick;

  return (
    <div className="wrap has-tabs py-8 lg:py-12">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start lg:gap-8">
        {/* ================= controls ================= */}
        <section className="card flex flex-col gap-7 p-5 lg:sticky lg:top-24 lg:p-6">
          <div>
            <span className="eyebrow">{d.draw.heading}</span>
            <h1 className="poster mt-2 text-[1.75rem]">{d.draw.setup.title}</h1>
          </div>

          {/* ---- time ---- */}
          <div className="flex flex-col gap-2.5">
            <label className="mono text-[11px] uppercase tracking-[0.12em] text-subtle">
              {d.draw.setup.time}
            </label>
            <div
              className="seg"
              style={{
                ["--seg-n" as string]: TIMES.length,
                ["--seg-i" as string]: TIMES.indexOf(time),
              }}
            >
              {TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  aria-pressed={time === t}
                >
                  {d.common.time[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* ---- mood ---- */}
          <div className="flex flex-col gap-2.5">
            <label className="mono text-[11px] uppercase tracking-[0.12em] text-subtle">
              {d.draw.setup.mood}
            </label>

            {showCustom ? (
              <div className="flex flex-col gap-2.5">
                <input
                  type="text"
                  autoFocus
                  value={customMood}
                  onChange={(e) => setCustomMood(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && pull(excluded)}
                  placeholder={d.common.moodPlaceholder}
                  className="w-full"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowCustom(false);
                    setCustomMood("");
                    if (!mood) setMood("story");
                  }}
                  className="btn btn-quiet self-start !px-0 text-[13px]"
                >
                  {d.draw.setup.customBack}
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMood(m)}
                      aria-pressed={mood === m}
                      className="chip text-left"
                      title={d.common.mood[m].hint}
                    >
                      {d.common.mood[m].label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustom(true);
                    setMood(null);
                  }}
                  className="btn btn-quiet self-start !px-0 text-[13px]"
                >
                  {d.draw.setup.custom}
                </button>
              </>
            )}
          </div>

          {/* ---- the one gesture ---- */}
          <div className="flex flex-col gap-3">
            <button
              ref={pullRef}
              type="button"
              onClick={() => pull(excluded)}
              disabled={rolling}
              className="btn btn-primary magnetic w-full"
            >
              {rolling ? `${d.draw.rolling}…` : phase === "done" ? d.common.actions.drawAgain : d.common.actions.draw}
              {!rolling && <span className="arrow">→</span>}
            </button>

            <button
              type="button"
              onClick={letItChoose}
              disabled={rolling}
              className="btn btn-quiet self-center text-[13px]"
            >
              🎲 {d.common.actions.dice}
            </button>
          </div>

          {error && (
            <p role="alert" className="text-[13.5px] text-accent-soft">
              {error}
            </p>
          )}

          {isSample && (
            <p className="mono border-t border-line pt-4 text-[10.5px] uppercase tracking-[0.1em] text-subtle">
              {d.draw.sample}
            </p>
          )}
        </section>

        {/* ================= verdict ================= */}
        <section ref={panelRef} className="flex flex-col gap-4">
          <div
            className={`verdict min-h-[420px] lg:min-h-[560px] ${rolling ? "is-rolling" : ""} ${
              flash ? "is-seating" : ""
            } ${dealing ? "deal-out" : ""}`}
          >
            {/* --- the art --- */}
            <div className="verdict-art">
              {rolling && reel ? (
                <div
                  key={reel.frame}
                  className="reel-frame absolute inset-0"
                  style={{ ["--reel-ms" as string]: `${reel.ms}ms` }}
                >
                  {/* The small header, unoptimised and already in cache: a
                      frame that lives 60ms cannot afford a round-trip. */}
                  <Image
                    src={headerFor(reel.appid)}
                    alt=""
                    fill
                    sizes="100vw"
                    unoptimized
                    className="object-cover"
                  />
                </div>
              ) : !pick ? (
                /* The shelf, waiting. Not decoration: it is the actual library
                   this draw will run against, which is the one thing an empty
                   panel cannot say. It lives in the art layer so the scrim
                   sits over it — on top of the scrim it read as six bright
                   covers competing with the headline. */
                <div aria-hidden className="absolute inset-0 grid grid-cols-3 gap-px opacity-40">
                  {pool.slice(0, 6).map((g) => (
                    <span key={g.appid} className="relative overflow-hidden">
                      <Image
                        src={headerFor(g.appid)}
                        alt=""
                        fill
                        sizes="220px"
                        className="object-cover blur-[3px] saturate-[0.55]"
                      />
                    </span>
                  ))}
                </div>
              ) : (
                <div className="absolute inset-0" onClick={() => {
                  blows.current += 1;
                  if (blows.current >= 3) {
                    blows.current = 0;
                    unlock("blow");
                  }
                }}>
                  <KeyArt appid={pick.appid} name={pick.name} priority />
                </div>
              )}
            </div>
            <div className="verdict-scrim" />

            {/* --- the copy --- */}
            <div className="verdict-body flex h-full min-h-[420px] flex-col justify-end gap-4 p-5 lg:min-h-[560px] lg:p-8">
              {!pick && !rolling && (
                <>
                  <span className="eyebrow eyebrow-quiet">{d.draw.idle.label}</span>
                  <h2 className="poster max-w-lg text-[clamp(1.8rem,4vw,2.8rem)]">
                    {d.draw.idle.title}
                  </h2>
                  <p className="max-w-md text-[15px] text-muted">{d.draw.idle.line}</p>
                </>
              )}

              {rolling && (
                <span className="eyebrow">{d.draw.rolling}…</span>
              )}

              {pick && !rolling && (
                <div className={dealing ? "" : "deal-in"}>
                  <span className="eyebrow">{d.draw.verdictLabel}</span>

                  <h2 className="poster mt-2 text-[clamp(2.1rem,5.2vw,3.6rem)]">
                    <Letters text={pick.name} />
                  </h2>

                  <p
                    className="rise mt-3 max-w-xl text-[15.5px] leading-relaxed text-muted"
                    style={{ animationDelay: `${pick.name.length * 25 + 120}ms` }}
                  >
                    {/* The model's sentence when there is one, the engine's
                        components put into words when there is not. */}
                    {aiSentence ?? verdictProse(locale, pick.reasons, time)}
                  </p>

                  <div
                    className="rise mt-4 flex flex-wrap gap-2"
                    style={{ animationDelay: `${pick.name.length * 25 + 300}ms` }}
                  >
                    {pick.reasons.map((r) => (
                      <Badge
                        key={r.key}
                        reason={r}
                        locale={locale}
                        run={countRun}
                        onPoke={() => {
                          badgePokes.current.add(r.key);
                          if (badgePokes.current.size >= 3) {
                            badgePokes.current.clear();
                            unlock("rrod");
                          }
                        }}
                      />
                    ))}
                  </div>

                  {missedMood && (
                    <p className="mt-4 max-w-xl border-l-2 border-accent pl-3 text-[13.5px] text-subtle">
                      {d.draw.moodMiss(missedMood)}
                    </p>
                  )}

                  <div
                    className="rise mt-6 flex flex-wrap items-center gap-2.5"
                    style={{ animationDelay: `${pick.name.length * 25 + 420}ms` }}
                  >
                    <a
                      href={`steam://rungameid/${pick.appid}`}
                      onClick={handlePlayed}
                      className="btn btn-primary"
                    >
                      {d.common.actions.launch} <span className="arrow">→</span>
                    </a>
                    <button type="button" onClick={reject} className="btn btn-ghost">
                      {d.common.actions.reroll} <span aria-hidden>↻</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => hideGame(pick.appid)}
                      className="btn btn-quiet"
                    >
                      {d.common.actions.never}
                    </button>
                    {played && (
                      <span className="mono text-[11px] uppercase tracking-[0.12em] text-accent-soft">
                        {d.common.actions.played} ✓
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* --- where you left off --- */}
          {pick && lastNote && (
            <div className="card p-5">
              <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-subtle">
                {d.draw.lastNote.title}
              </span>
              <p className="mt-2 text-[15px]">{lastNote.lastTime}</p>
              {lastNote.whatsNext && (
                <p className="mt-2 text-[14px] text-muted">
                  <span className="text-accent-soft">{d.draw.lastNote.next} · </span>
                  {lastNote.whatsNext}
                </p>
              )}
            </div>
          )}

          {/* --- the note for next time --- */}
          {pick && played && !noteSaved && (
            <NoteBox
              prompt={d.draw.note.prompt}
              placeholder={d.draw.note.placeholder}
              save={d.common.actions.save}
              onSave={handleNote}
            />
          )}
          {noteSaved && (
            <p className="mono text-[10.5px] uppercase tracking-[0.12em] text-accent-soft">
              {d.draw.note.saved} ✓
            </p>
          )}

          {/* --- runners-up --- */}
          {pick && result!.alternatives.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-subtle">
                {d.draw.alternatives.title}
              </span>
              <ul className="grid gap-3 sm:grid-cols-2">
                {result!.alternatives.map((alt) => (
                  <li key={alt.appid} className="tile flex items-stretch gap-3">
                    <span className="relative h-[68px] w-[145px] shrink-0 overflow-hidden">
                      <Image
                        src={headerFor(alt.appid)}
                        alt=""
                        fill
                        sizes="145px"
                        className="object-cover"
                      />
                    </span>
                    <span className="flex min-w-0 flex-col justify-center py-2 pr-3">
                      <span className="poster truncate text-[15px]">{alt.name}</span>
                      <span className="truncate text-[12.5px] text-subtle">
                        {alt.hint ? reasonLine(locale, alt.hint) : alt.reason}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {payRespects && (
            <p className="mono text-center text-[10.5px] uppercase tracking-[0.12em] text-subtle">
              press F
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

/* ============================================================
   Bits
   ============================================================ */

function NoteBox({
  prompt,
  placeholder,
  save,
  onSave,
}: {
  prompt: string;
  placeholder: string;
  save: string;
  onSave: (raw: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="card flex flex-col gap-3 p-5">
      <label className="mono text-[10.5px] uppercase tracking-[0.12em] text-subtle">
        {prompt}
      </label>
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none"
      />
      <button
        type="button"
        onClick={() => onSave(text)}
        disabled={!text.trim()}
        className="btn btn-ghost self-start"
      >
        {save}
      </button>
    </div>
  );
}

function PickerSkeleton() {
  return (
    <div className="wrap has-tabs py-8 lg:py-12">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:gap-8">
        <div className="card h-[420px] animate-pulse" />
        <div className="card-quiet h-[420px] animate-pulse lg:h-[560px]" />
      </div>
    </div>
  );
}
