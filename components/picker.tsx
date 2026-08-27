"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { explain, recommendGame, shortlist } from "@/lib/recommend";
import { getAiPick, summariseNote } from "@/app/play/actions";
import { deviceId } from "@/lib/device";
import { unlock } from "@/lib/eggs";
import { CoverArt } from "@/components/cover-art";
import {
  addToBlacklist,
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
  type HistoryEntry,
  type SessionNote,
} from "@/lib/history";
import type {
  PickerTime,
  PickerMood,
  Reason,
  Recommendation,
  RecommendInput,
} from "@/lib/recommend";

/* ============================================================
   The pull — four mechanical beats. Reference: public/design-preview.html

     1. eject    180ms  the cart rises out of the rank, contacts bared
     2. scan    2500ms  labels flick past in the window, decelerating
     3. seat     180ms  accelerates down, hard stop, two-frame knock
     4. read     420ms  the deck reads it, then the label prints in

   The engine answers in under a millisecond and the AI runs alongside;
   the reveal waits for the deck, never the other way round.
   ============================================================ */
const SCAN_MS = 2500;
const SETTLE_MS = 300;
const SEAT_MS = 180;
const READ_MS = 420;
const OVERSHOOT = 22;
/** Decoy labels ahead of the winner. Fixed, so the strip is built once. */
const RUNWAY = 14;

const TIME: { key: PickerTime; label: string }[] = [
  { key: "short", label: "30 min" },
  { key: "medium", label: "1–2 hrs" },
  { key: "long", label: "All evening" },
];

const MOOD: { key: PickerMood; label: string; band: string }[] = [
  { key: "chill", label: "Chill", band: "var(--chill)" },
  { key: "story", label: "Story", band: "var(--story)" },
  { key: "challenge", label: "Challenge", band: "var(--challenge)" },
  { key: "quick", label: "Quick", band: "var(--quick)" },
];

/** Defaults for "let it choose": nobody starts a CRPG at 11pm on a Tuesday. */
function timeOfDayContext(): { time: PickerTime; mood: PickerMood } {
  const now = new Date();
  const h = now.getHours();
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  if (h >= 23 || h < 6) return { time: "short", mood: "chill" };
  if (weekend && h >= 10 && h < 20) return { time: "long", mood: "story" };
  return { time: "medium", mood: "chill" };
}

type Phase = "idle" | "scanning" | "seating" | "reading" | "done";

/**
 * The readout prints rather than appearing. A machine that answers instantly is
 * a web page; one that types its answer is a machine, and the half second it
 * costs is time you were going to spend reading the line anyway.
 *
 * The whole line is always in the DOM for screen readers (see the caller) —
 * this drives the visible text only, and reduced-motion skips straight to the
 * end.
 */
function useTyped(text: string): string {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text);
      return;
    }
    // Long lines type faster, so the print never outlasts what it describes.
    const step = Math.max(7, Math.min(20, 850 / Math.max(text.length, 1)));
    let i = 0;
    setShown("");
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, step);
    return () => window.clearInterval(id);
  }, [text]);

  return shown;
}

/**
 * Swap in the game the model chose, keeping the engine's badges for THAT game.
 * The sentence is the model's; the badges stay derived from the score, so the
 * justification on screen can never drift from the maths.
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

  return {
    pick: {
      appid: chosen.game.appid,
      name: chosen.game.name,
      reason: ai.reason,
      reasons: earned(chosen)
        .slice(0, 4)
        .map((c) => c.reason as Reason),
    },
    alternatives: board
      .filter((s) => s.game.appid !== ai.appid)
      .slice(0, 2)
      .map((s) => ({
        appid: s.game.appid,
        name: s.game.name,
        reason: earned(s)[0]?.reason?.label ?? "Another solid fit.",
      })),
  };
}

export function Picker() {
  const [library, setLibrary] = useState<StoredGame[] | null>(null);
  const [isSample, setIsSample] = useState(true);
  const [genres, setGenres] = useState<string[]>([]);
  const [blacklist, setBlacklist] = useState<number[]>([]);
  const [recentAppids, setRecentAppids] = useState<number[]>([]);
  const [recent, setRecent] = useState<HistoryEntry[]>([]);

  const [time, setTime] = useState<PickerTime>("medium");
  const [mood, setMood] = useState<PickerMood | null>("story");
  const [customMood, setCustomMood] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNoteMsg] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [played, setPlayed] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [lastNote, setLastNote] = useState<SessionNote | null>(null);
  const [excluded, setExcluded] = useState<number[]>([]);
  /** Index in the rank left empty by the cartridge that was pulled. */
  const [gapIndex, setGapIndex] = useState<number | null>(null);
  /**
   * The cartridge the strip will land on, known before the scan starts so the
   * window never lands on one cover and then swaps to another under your eye.
   */
  const [landing, setLanding] = useState<number | null>(null);

  /* ---- the hidden half (lib/eggs.ts) ---------------------------
     None of this changes what the app does. It is the object being
     funny about itself: you blow on the contacts, you poke the deck
     lights, you say goodbye to a cart properly. */
  const [blown, setBlown] = useState(false);
  const [rrod, setRrod] = useState(false);
  const [payRespects, setPayRespects] = useState(false);
  const blows = useRef(0);
  const leds = useRef<Set<number>>(new Set());

  function blowOnContacts() {
    blows.current += 1;
    if (blows.current < 3) return;
    blows.current = 0;
    unlock("blow");
    setBlown(true);
    window.setTimeout(() => setBlown(false), 700);
  }

  function pokeLed(i: number) {
    leds.current.add(i);
    if (leds.current.size < 3) return;
    leds.current.clear();
    unlock("rrod");
    setRrod(true);
    window.setTimeout(() => setRrod(false), 6000);
  }

  // Retiring a cart deserves the one key this audience presses for it.
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

  const windowRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  /* The panel hands off to the board. On a phone the rail is tall enough that
     the slot sits below the fold at rest, which is fine — until you press the
     switch, at which point the thing you want to watch has to be on screen.
     The machine brings the slot to you rather than asking you to scroll. */
  const deckRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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
    setRecent(history.slice(0, 3));
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const blacklistSet = new Set(blacklist);
  const pool = (library ?? []).filter((g) => !blacklistSet.has(g.appid));
  const byId = new Map((library ?? []).map((g) => [g.appid, g]));

  const sealedCount = pool.filter((g) => (g.playtimeMin ?? 0) === 0).length;

  // A shelf of a very particular size.
  useEffect(() => {
    if (pool.length === 42) unlock("answer");
  }, [pool.length]);

  /* ---- haptics: one click per label going past, spacing out ---- */
  const buzz = (ms: number) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      // unsupported, never fatal
    }
  };
  function hapticRamp() {
    let t = 0;
    let gap = 90;
    while (t < SCAN_MS - 120) {
      after(t, () => buzz(9));
      t += gap;
      gap += 22;
    }
  }

  const band = mood ? MOOD.find((m) => m.key === mood)?.band : "var(--shell-dark)";

  function pull(exclude: number[] = []) {
    if (phase !== "idle" && phase !== "done") return;
    if (!pool.length) return;
    const custom = customMood.trim();
    if (!mood && !custom) return;

    timers.current.forEach(clearTimeout);
    timers.current = [];
    setError(null);
    setResult(null);
    setPhase("scanning");

    deckRef.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
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
    const moodLabel = custom || MOOD.find((m) => m.key === mood)?.label || "";

    // The model only ever sees the engine's shortlist, and it runs while the
    // reel does. Anything short of a clean answer leaves the local pick standing.
    const aiPromise: Promise<{ appid: number; reason: string } | null> = res.ok
      ? getAiPick({
          deviceId: deviceId(),
          candidates: shortlist(engineInput),
          time: TIME.find((t) => t.key === time)?.label ?? time,
          mood: moodLabel,
        })
          .then((r) => (r.ok ? { appid: r.appid, reason: r.reason } : null))
          .catch(() => null)
      : Promise.resolve(null);

    if (!res.ok) {
      setPhase("idle");
      setError(res.error);
      return;
    }

    // The window shows the engine's answer straight away, and swaps to the
    // model's while the strip is still mid-scan — long before the cell is seen.
    setLanding(res.recommendation.pick.appid);
    aiPromise.then((ai) => ai && setLanding(ai.appid));

    // 2. scan — reset the strip, then run it down to the winner and past it
    const strip = stripRef.current;
    const win = windowRef.current;
    if (strip && win) {
      const target = RUNWAY * win.clientHeight;
      strip.style.transition = "none";
      strip.style.transform = "translateY(0)";
      void strip.offsetHeight; // flush, so the transition takes
      strip.style.transition = `transform ${SCAN_MS}ms var(--ease)`;
      strip.style.transform = `translateY(-${target + OVERSHOOT}px)`;
      after(SCAN_MS, () => {
        strip.style.transition = `transform ${SETTLE_MS}ms var(--ease)`;
        strip.style.transform = `translateY(-${target}px)`;
      });
    }
    buzz(14);
    hapticRamp();

    // 3. seat  4. read  then reveal
    after(SCAN_MS + SETTLE_MS, () => setPhase("seating"));
    after(SCAN_MS + SETTLE_MS + SEAT_MS, () => {
      setPhase("reading");
      buzz(45);
    });
    after(SCAN_MS + SETTLE_MS + SEAT_MS + READ_MS, async () => {
      const ai = await aiPromise;
      const merged = ai ? applyAiPick(res.recommendation, ai, engineInput) : res.recommendation;

      setResult(merged);
      setNoteMsg(res.note ?? null);
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
      // The entry we just added has no note, so this finds the previous
      // session's — which is what "last save" means.
      setLastNote(lastNoteFor(merged.pick.appid));
      setGapIndex(pool.findIndex((g) => g.appid === merged.pick.appid));
    });
  }

  function letItChoose() {
    const ctx = timeOfDayContext();
    setTime(ctx.time);
    setMood(ctx.mood);
    setCustomMood("");
    setShowCustom(false);
    setExcluded([]);
    // state hasn't flushed yet, so pull() would read the old mood — defer a tick
    after(0, () => pull([]));
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

    summariseNote({ deviceId: deviceId(), game: result.pick.name, raw: trimmed })
      .then((s) =>
        saveNote(entryId, { raw: trimmed, lastTime: s.lastTime, whatsNext: s.whatsNext })
      )
      .catch(() => {
        // their own words are already stored — nothing to recover
      });
  }

  function eject() {
    if (!result) return;
    const next = [...excluded, result.pick.appid];
    setExcluded(next);
    setGapIndex(null);
    pull(next);
  }

  function hideGame(appid: number) {
    setBlacklist(addToBlacklist(appid));
    setPayRespects(true);
    const next = [...excluded, appid];
    setExcluded(next);
    setGapIndex(null);
    pull(next);
  }

  if (library === null) return <PickerSkeleton />;

  if (!pool.length) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <span className="deck-slot w-28" />
        <h1 className="mt-5 font-display text-[30px] font-extrabold uppercase leading-none">
          No carts racked
        </h1>
        <p className="mt-2.5 max-w-[26ch] text-sm text-ink-soft">
          Import your Steam library and every game racks up here as a cart.
        </p>
        <Link
          href="/connect"
          className="switch mt-5 inline-flex h-[50px] w-auto items-center px-[22px] font-display text-[19px] font-extrabold uppercase tracking-[0.12em]"
        >
          Connect Steam
        </Link>
      </div>
    );
  }

  const busy = phase === "scanning" || phase === "seating" || phase === "reading";

  /* ---- what the panel says about itself ------------------------
     Two derivations feed every piece of guidance on this screen, so
     there is exactly one source of truth for "where am I":
       status     — one word, on the indicator beside the title
       readoutLine— one sentence, and it always ends in the next move.
     If the readout ever reads as flavour rather than an instruction,
     that is the bug. */
  const timeLabel = TIME.find((t) => t.key === time)!.label;
  const custom = customMood.trim();
  const moodLabel = custom ? "Own words" : (MOOD.find((m) => m.key === mood)?.label ?? "—");
  const moodLit = custom ? "var(--contacts)" : band;
  const moodSet = !!(mood || custom);

  const status = busy
    ? phase === "scanning"
      ? "Scanning"
      : "Reading"
    : phase === "done"
      ? "Match"
      : "Ready";

  const readoutLine = error
    ? error
    : phase === "scanning"
      ? `Scanning ${pool.length} titles for a ${(custom || moodLabel).toLowerCase()} fit…`
      : phase === "seating"
        ? "Match found. Seating the cart."
        : phase === "reading"
          ? "Reading the label."
          : phase === "done" && result
            ? noteSaved
              ? "Note saved. It comes back up next time this cart is drawn."
              : played
                ? "Logged. Leave a note so tomorrow you know where you stopped."
                : `${result.pick.name}. Launch it, or press Eject to draw another.`
            : excluded.length
              ? `${excluded.length} set aside. Press Run to draw again.`
              : `Ready. ${pool.length} titles racked. Press Run to draw one.`;

  const cartClass =
    phase === "scanning"
      ? "cart-out"
      : phase === "seating"
        ? "cart-seating"
        : phase === "reading" || phase === "done"
          ? "cart-seating cart-seated"
          : "";

  /* ---- the pieces, composed differently per screen -------------
     Phone: one column, and the controls step aside once a cart is
     seated so the result owns the screen.
     Desktop: the panel keeps the controls, the deck sits on the plank
     beside it, and the label prints out to its right. Nothing is
     hidden up there — there is room, so use it. */

  /* ---- the rail: three channels, in the order they must be set ---- */
  const controls = (
    <>
      <Channel no="01" name="Session" value={timeLabel} filled={TIME.findIndex((t) => t.key === time) + 1}>
        {/* Three equal cells, shortest to longest — the control has the shape
            of the thing it sets. */}
        <div className="mt-2 grid grid-cols-3 gap-1">
          {TIME.map((t) => (
            <Key key={t.key} pressed={time === t.key} onClick={() => setTime(t.key)}>
              {t.label}
            </Key>
          ))}
        </div>
      </Channel>

      <Channel no="02" name="Mood" value={moodLabel} filled={moodSet ? 3 : 0} lit={moodLit}>
        {/* Four lenses in a row, like a real indicator strip. Own words is not
            a fifth mood — it is a different way of setting the same channel,
            so it sits apart. */}
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {MOOD.map((m) => (
            <Key
              key={m.key}
              pressed={mood === m.key && !custom}
              lit={m.band}
              onClick={() => {
                setMood(m.key);
                setCustomMood("");
                setShowCustom(false);
              }}
            >
              {m.label}
            </Key>
          ))}
        </div>
        <Key
          pressed={!!custom}
          onClick={() => setShowCustom(true)}
          className="mt-1 !min-h-9 w-full tracking-[0.14em]"
        >
          Own words
        </Key>

        {showCustom && (
          <input
            autoFocus
            value={customMood}
            onChange={(e) => {
              setCustomMood(e.target.value);
              if (e.target.value.trim()) setMood(null);
            }}
            placeholder="cozy but a bit tense…"
            className="mt-2 min-h-[42px] w-full rounded-[2px] border border-line bg-[#0b1013] px-3 py-2 text-[13px] text-label outline-none transition-colors placeholder:text-[#5b6a72] focus:border-contacts"
          />
        )}
      </Channel>

      {/* The output channel, and the switch is its control — every channel on
          this rail is a header plus the thing that sets it, this one included.
          Its segments chase while the deck works, so the wait reads as the
          machine running rather than the app hanging. */}
      <Channel
        no="03"
        name="Draw"
        value={busy ? status : phase === "done" ? "Seated" : "Awaiting"}
        filled={phase === "done" ? 3 : 0}
        running={busy}
      >
        <button
          onClick={() => pull(excluded)}
          disabled={busy}
          className="switch mt-1.5 h-[52px] font-display text-[24px] font-extrabold uppercase tracking-[0.2em] lg:h-[58px] lg:text-[28px]"
        >
          {busy ? "Running" : phase === "done" ? "Run again" : "Run the draw"}
        </button>
        <button
          onClick={letItChoose}
          disabled={busy}
          className="key mt-1 min-h-9 w-full font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:text-label disabled:opacity-50"
        >
          Auto-set 01 + 02
        </button>
      </Channel>
    </>
  );

  /* The one place in the app that speaks in sentences. It follows the panel
     on a desktop and the result on a phone, but it is the same line either
     way — there is only ever one answer to "what now". */
  const readoutStrip = <Readout line={readoutLine} busy={busy} isSample={isSample} />;


  const deck = (
    <div ref={deckRef} className={`scroll-mt-16 pt-5 lg:pt-0 ${rrod ? "rrod" : ""}`}>
      <div
        data-cart
        className={`cart mx-auto w-[206px] lg:w-[248px] ${cartClass} ${blown ? "blown" : ""}`}
      >
        {/* The ritual. It never worked, and everybody did it anyway. */}
        <button
          onClick={blowOnContacts}
          aria-label="Blow on the contacts"
          title="Blow on the contacts"
          className="absolute inset-x-0 top-0 h-[13px] cursor-pointer"
        />
        <div className="overflow-hidden rounded-label border border-black/25 bg-label">
          <div
            className="flex items-center justify-between px-2.5 py-[5px] font-mono text-[8px] uppercase tracking-[0.16em] text-label"
            style={{ background: band }}
          >
            <span>{customMood.trim() ? "Custom" : (mood ?? "—")}</span>
            <span>
              SQ-{String(pool.length).padStart(3, "0")}
              {pool.length === 42 && " · DON'T PANIC"}
            </span>
          </div>

          <div ref={windowRef} className="relative aspect-[5/6] overflow-hidden bg-paper">
            <div ref={stripRef} className="will-change-transform">
              {Array.from({ length: RUNWAY + 1 }).map((_, i) => {
                // The strip is fixed-length and built once: rebuilding it per
                // pull would create a dozen full-size images every time.
                const g =
                  i === RUNWAY && landing !== null
                    ? byId.get(landing)
                    : pool[i % pool.length];
                if (!g) return null;
                return (
                  <div key={i} className="relative aspect-[5/6] w-full">
                    <CoverArt
                      appid={g.appid}
                      name={g.name}
                      sizes="(min-width: 1024px) 248px, 206px"
                      priority={i === 0}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2 bg-label px-2.5 pb-2 pt-[7px] text-ink">
            <b className="font-display text-[19px] font-bold uppercase leading-[0.95]">
              {result ? result.pick.name : busy ? "Reading…" : "Slot empty"}
            </b>
            <span className="whitespace-nowrap font-mono text-[9px] text-ink-soft">
              {result
                ? `${Math.round((byId.get(result.pick.appid)?.playtimeMin ?? 0) / 60)}H`
                : `${pool.length} racked`}
            </span>
          </div>
        </div>
        <div className="cart-contacts" />
      </div>

      <div className="deck-slot mx-6 mt-0 flex items-center justify-center gap-1.5 lg:mx-10">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            onClick={() => pokeLed(i)}
            aria-label={`Deck indicator ${i + 1}`}
            className="grid h-4 w-4 place-items-center"
          >
            <i className="deck-led" />
          </button>
        ))}
      </div>
    </div>
  );

  /* The log column. On a phone there is no room for it and the deck is the
     screen; on a desk it is the third of three real columns, so it carries
     both things at once — how the board runs, and what you were doing last
     time. Showing only one of them left the column half empty, which is what
     made the wide layout read as a stretched phone. */
  const idleCard = (
    <div className="hidden lg:block">
      {/* These numbers are the rail's numbers. If this list ever describes a
          different 01 than the channel labelled 01, one of them is lying — so
          they name the same three channels, in the same order. */}
      <p className="rule !mt-0">How the board runs</p>
      <ol className="grid gap-3.5">
        {[
          ["Session", "How long you actually have tonight. The segments are the hours."],
          ["Mood", "What you are after, or type it in your own words."],
          ["Draw", "The deck scans the rack, seats one cart, and prints the label: what to play, and why."],
        ].map(([name, step], n) => (
          <li key={name} className="flex gap-3">
            <span className="font-mono text-[10px] leading-5 tracking-[0.14em] text-contacts">
              {String(n + 1).padStart(2, "0")}
            </span>
            <span className="text-[13px] leading-relaxed text-ink-soft">
              <b className="font-mono text-[10px] uppercase tracking-[0.16em] text-label">
                {name}
              </b>
              <br />
              {step}
            </span>
          </li>
        ))}
      </ol>

      {recent.length > 0 && (
        <>
          <p className="rule mt-7">Where you left off</p>
          <div className="grid gap-2">
            {recent.map((e) => (
              <div key={e.id} className="border border-line-soft p-3">
                <b className="font-display text-[17px] font-bold uppercase leading-none">
                  {e.pick.name}
                </b>
                <p className="mt-1.5 text-[13px] leading-snug text-ink-soft">
                  {e.note?.lastTime ??
                    (e.played ? "Played. No note left." : "Drawn, not played.")}
                </p>
                {e.note?.whatsNext && (
                  <p className="mt-1 text-[13px] leading-snug text-contacts">
                    Next: {e.note.whatsNext}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* The spec plate. A serviceable machine documents its own board, and
          this one has something worth documenting: the score is a sum of
          named components, so the badges on a pick can never drift from the
          maths. These are the real weights out of lib/recommend.ts — if they
          change there, they change here. */}
      <p className="rule mt-7">How it scores</p>
      <dl className="grid gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.08em]">
        {[
          ["Mood match", "0–40", "Community tags against the mood you set"],
          ["Session fit", "−12–20", "Short-burst vs. sprawling, against your time"],
          ["Momentum", "0–15", "Hours in the last two weeks — you're mid-run"],
          ["Rediscovery", "0–15", "Never launched, or barely touched and dormant"],
          ["Taste", "0–10", "The genres on your profile"],
          ["Anti-repetition", "−25", "Drawn for you recently"],
        ].map(([name, weight, signal]) => (
          <div key={name} className="flex items-baseline gap-2.5 border-b border-line-soft pb-1.5">
            <dt className="w-[7.5rem] shrink-0 text-label">{name}</dt>
            <dd className="w-14 shrink-0 text-right text-contacts">{weight}</dd>
            <dd className="min-w-0 flex-1 normal-case tracking-normal text-ink-soft">
              {signal}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 font-mono text-[10px] leading-relaxed text-ink-soft">
        Top five go into a weighted draw, so a clear winner usually wins and the
        spin stays a spin.
      </p>
    </div>
  );

  const resultPanel = phase === "done" && result && (
    <section className="mt-5 lg:mt-0">
      {/* On a phone the panel steps aside so the result owns the screen — but
          the line that says what to do next never does. */}
      <div className="mb-4 lg:hidden">{readoutStrip}</div>
      <h2 className="print font-display text-[38px] font-extrabold uppercase leading-[0.9] tracking-[0.01em] lg:text-[46px]">
        {result.pick.name}
      </h2>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-soft">
        {(byId.get(result.pick.appid)?.playtimeMin ?? 0) > 0
          ? `${Math.round((byId.get(result.pick.appid)!.playtimeMin ?? 0) / 60)}h played`
          : "Never launched"}
        {(byId.get(result.pick.appid)?.recentMin ?? 0) > 0 &&
          ` · ${Math.round((byId.get(result.pick.appid)!.recentMin ?? 0) / 60)}h this fortnight`}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[#b3c0c7] lg:text-[15px]">
        {result.pick.reason}
      </p>

      {note && (
        <p className="mt-3 border border-line p-2.5 font-mono text-[10px] leading-relaxed text-ink-soft">
          {note}
        </p>
      )}

      {lastNote && (
        <div className="mt-4 overflow-hidden rounded-[2px] border border-line">
          <div className="flex justify-between bg-plank px-2.5 py-[5px] font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
            <span>Last save</span>
          </div>
          <div className="p-2.5 text-sm leading-relaxed">
            {lastNote.lastTime}
            {lastNote.whatsNext && (
              <span className="mt-1.5 block text-contacts">Next: {lastNote.whatsNext}</span>
            )}
          </div>
        </div>
      )}

      {result.pick.reasons.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {result.pick.reasons.map((r) => {
            const [head, tail] = r.label.split(" — ");
            return (
              <span
                key={r.label}
                className="inline-flex items-center gap-1.5 rounded-[2px] border border-line px-2.5 py-1 font-mono text-[10px] text-[#b3c0c7]"
              >
                <span aria-hidden>{r.icon}</span>
                <b className="font-medium text-label">{head}</b>
                {tail && <span>· {tail}</span>}
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-[18px] flex gap-[7px] lg:max-w-md">
        <a
          href={`steam://run/${result.pick.appid}`}
          onClick={handlePlayed}
          className="switch flex h-[50px] flex-1 items-center justify-center font-display text-[20px] font-extrabold uppercase tracking-[0.12em]"
        >
          Launch on Steam
        </a>
        <button
          onClick={eject}
          disabled={busy}
          className="key h-[50px] shrink-0 px-[18px] font-display text-[18px] font-bold uppercase tracking-[0.08em] text-ink-soft transition-colors duration-[var(--fast)] hover:text-label disabled:opacity-50"
        >
          Eject
        </button>
      </div>

      {/* Two quiet log controls. They stack on a phone and sit on one line on a
          desktop, with a real gap — inline-block buttons with no wrapper ran
          into each other and read as one sentence. */}
      <div className="mt-3 flex flex-col items-center gap-1 lg:flex-row lg:items-baseline lg:gap-7">
        {!played && (
          <button
            onClick={handlePlayed}
            className="w-full py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:text-label lg:w-auto lg:text-left"
          >
            Log as played
          </button>
        )}
        <button
          onClick={() => hideGame(result.pick.appid)}
          className="w-full py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-[#5b6a72] transition-colors hover:text-challenge lg:w-auto lg:text-left"
        >
          Never suggest this again
        </button>
      </div>

      {played && <NoteField saved={noteSaved} onSave={handleNote} />}

      {result.alternatives.length > 0 && (
        <>
          <p className="rule mt-6">Or</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {result.alternatives.map((a) => (
              <div key={a.appid} className="flex items-center gap-3 border border-line-soft p-2">
                <div className="relative aspect-[5/6] w-9 shrink-0 overflow-hidden rounded-[2px] bg-paper">
                  <CoverArt appid={a.appid} name={a.name} sizes="36px" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-[16px] font-bold uppercase leading-none">
                    {a.name}
                  </p>
                  <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.06em] text-ink-soft">
                    {a.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );

  return (
    <div
      className={`lg:flex lg:min-h-[calc(100dvh-3.5rem)] lg:flex-col ${
        phase === "reading" ? "is-reading" : ""
      }`}
    >
      {/* The identity strip: what machine this is, and whether it is live.
          The indicator is the only thing on the page that pulses, so a
          working deck is readable from across the desk. */}
      <header className="sticky top-0 z-10 flex items-baseline justify-between gap-2.5 bg-gradient-to-b from-ground from-[72%] to-transparent pb-3 pt-[18px] lg:static lg:block lg:pb-7 lg:pt-9">
        <h1 className="font-display text-[30px] font-extrabold uppercase leading-none tracking-[0.02em] lg:text-[54px]">
          Tonight
        </h1>
        <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft lg:mt-2.5">
          <i
            className={`led led-on ${busy ? "led-pulse" : ""}`}
            style={{ "--lit": busy ? "var(--quick)" : "var(--contacts)" } as React.CSSProperties}
            aria-hidden
          />
          {status}
          <span className="text-[#4d5a61]">·</span>
          {pool.length} racked
        </span>
      </header>

      {/* ---- the bench: controls, board, log ----------------------
          Three real columns from lg up. The old layout was two columns
          with the log squeezed into whatever the board left over, which
          is what made a 1440px screen read as a widened phone. */}
      <div className="bench">
        {/* 1 — the control plate */}
        <div className={phase === "done" ? "hidden lg:block" : undefined}>
          {/* `post` plays exactly once: the panel only mounts after the library
              has loaded, so the board comes up when it is actually ready, and a
              re-render never restarts a CSS animation. */}
          <div className="panel bolted post">
            {controls}
            {readoutStrip}
          </div>
        </div>

        {/* 2 — the board the slot is cut into */}
        <div className="plank-top">{deck}</div>

        {/* 3 — the log: what the machine found, or how to work it */}
        <div className="min-w-0">
          {error && (
            <p className="mt-4 border border-challenge/40 bg-challenge/10 p-3 text-sm text-label lg:mt-0">
              {error}
            </p>
          )}
          {phase === "done" ? resultPanel : idleCard}
          {payRespects && (
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
              Retired from the rack. Press F.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 lg:mt-10">
        <Legend count={pool.length} />
      </div>

      {/* ---- the rack, along the floor of the cabinet ---- */}
      <div className={`lg:mt-auto lg:pt-8 ${phase === "done" ? "hidden lg:block" : ""}`}>
        <Rank
          count={pool.length}
          gapIndex={gapIndex}
          live={busy}
          caption={`${pool.length} racked · ${sealedCount} never launched`}
        />
      </div>
    </div>
  );
}

/**
 * A key on the panel — engraved into the plate, not a pill floating on it.
 * A mood key carries its own indicator lens: unlit when the channel is set
 * elsewhere, lit when it is the one selected. The colour arrives as light,
 * never as a filled background, which is what keeps the panel sober.
 */
function Key({
  pressed,
  onClick,
  lit,
  className = "",
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  /** The indicator colour, for keys that have a lens. Omitted keys light amber. */
  lit?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-pressed={pressed}
      onClick={onClick}
      style={lit ? ({ "--lit": lit } as React.CSSProperties) : undefined}
      className={`key inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-2 font-display text-[15px] font-bold uppercase leading-none tracking-[0.04em] transition-colors duration-[var(--fast)] ${
        pressed ? "text-label" : "text-ink-soft hover:text-label"
      } ${className}`}
    >
      {lit && <i className={`led shrink-0 ${pressed ? "led-on" : ""}`} aria-hidden />}
      {children}
    </button>
  );
}

/**
 * One numbered channel on the board: its number, what it controls, what it is
 * set to, and how full it is. The three segments are not decoration — on 01
 * they are literally how much time you have, on 02 they are lit or dark, and
 * on 03 they chase while the draw runs. Read the rail and you know exactly
 * where you are without a word of instruction.
 */
function Channel({
  no,
  name,
  value,
  filled,
  lit,
  running,
  children,
}: {
  no: string;
  name: string;
  value: string;
  /** Segments lit, 0–3. */
  filled: number;
  lit?: string;
  running?: boolean;
  /** The keys that set this channel. */
  children?: React.ReactNode;
}) {
  return (
    <div className={`border-b border-line-soft pb-3 ${filled ? "chan-set" : ""}`}>
      <div className="chan">
        <span className="chan-no">{no}</span>
        <span className="chan-name">{name}</span>
        <span className="chan-value">{value}</span>
        <span
          className={`seg ${running ? "seg-run" : ""}`}
          style={lit ? ({ "--lit": lit } as React.CSSProperties) : undefined}
          aria-hidden
        >
          {[0, 1, 2].map((i) => (
            <i key={i} {...(!running && i < filled ? { "data-on": "" } : {})} />
          ))}
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * The readout: the inset CRT strip, and the only thing in the app that speaks
 * in sentences. It lives in its own component so the typing hook sits above
 * the caller's early returns rather than after them.
 */
function Readout({
  line,
  busy,
  isSample,
}: {
  line: string;
  busy: boolean;
  isSample: boolean;
}) {
  const typed = useTyped(line);
  const printing = typed.length < line.length;

  return (
    <div className="readout mt-3">
      {/* The whole line, announced once. A screen reader being read one
          character at a time is a bug, not an effect. */}
      <span className="sr-only" role="status" aria-live="polite">
        {line}
      </span>
      <span aria-hidden>
        <span className="opacity-50">&gt;</span> {typed}
        {(printing || !busy) && <i className="caret" />}
      </span>
      {isSample && (
        <p className="readout-dim mt-1">
          Demo shelf.{" "}
          <Link href="/connect" className="underline underline-offset-2 hover:text-label">
            Import yours
          </Link>{" "}
          to draw from your own library.
        </p>
      )}
    </div>
  );
}

/**
 * The service markings silkscreened along the bottom of the panel.
 *
 * Every cabinet carries these: a warning nobody reads, a revision, a part
 * number, a service code. They cost one line of screen and they are what makes
 * the difference between a dark UI and a machine — the same reason a real
 * board has "DO NOT REMOVE" printed next to the connector.
 *
 * The service code is not decoration: those are the keys the Konami handler in
 * components/eggs.tsx actually listens for. It is the hint and the answer at
 * once, printed where a hint belongs on a machine.
 */
function Legend({ count }: { count: number }) {
  return (
    <div className="hidden select-none flex-wrap items-center gap-x-7 gap-y-1.5 border-t border-line-soft pt-3 lg:flex">
      <span className="legend legend-warn">⚠ Do not remove cart while powered</span>
      <span className="legend">Service code ↑ ↑ ↓ ↓ ← → ← → B A</span>
      <span className="legend">1 player · free play</span>
      <span className="legend">No user-serviceable backlog inside</span>
      <span className="legend ml-auto">
        MVS-1 · Rev C · SQ-{String(count).padStart(4, "0")}
      </span>
    </div>
  );
}

/**
 * The rank of spines. Deterministic heights and tints from the index, so the
 * shelf looks hand-stacked without re-randomising on every render.
 */
function Rank({
  count,
  gapIndex,
  caption,
  live,
}: {
  count: number;
  gapIndex: number | null;
  caption?: string;
  /** True while the deck is scanning — the rack runs a chase alongside it. */
  live?: boolean;
}) {
  const TINTS = ["var(--story)", "var(--chill)", "var(--challenge)", "var(--quick)"];
  // A phone shows a strip you can nudge; a desk shows the run along the floor
  // of the cabinet, so it gets a lot more of it.
  const spines = Math.min(Math.max(count, 12), 96);
  return (
    <div className={`-mx-5 mt-3.5 px-5 lg:mx-0 lg:mt-0 lg:px-0 ${live ? "rack-live" : ""}`}>
      {caption && (
        <div className="mb-2.5 hidden items-center gap-2.5 lg:flex">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-soft">
            The rack
          </p>
          <span className="h-px flex-1 bg-line-soft" />
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
            {caption}
          </p>
        </div>
      )}
      {/* The board is exactly as long as the run of carts on it. A rack of ten
          under a rule stretched to 1400px reads as a broken layout; the same
          rack on a board its own length reads as what it is — a rack with room
          left on it. A full library flexes the other way and fills the
          cabinet. */}
      <div
        className="rack"
        style={{ "--rack-max": `${spines * 30}px` } as React.CSSProperties}
      >
        <div className="no-bar flex items-end gap-[3px] overflow-x-auto pt-2 lg:gap-[4px] lg:overflow-visible">
          {Array.from({ length: spines }).map((_, i) => (
            <span
              key={i}
              className={`spine ${i % 3 === 1 ? "spine-cream" : ""} ${
                gapIndex !== null && i === gapIndex % spines ? "spine-gap" : ""
              }`}
              style={
                {
                  "--h": `${44 + ((i * 7) % 10)}px`,
                  "--tint": TINTS[i % TINTS.length],
                  "--i": i,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="shelf-board" />
      </div>
    </div>
  );
}

/** Asked only after they say they played — before that there is nothing to write. */
function NoteField({
  saved,
  onSave,
}: {
  saved: boolean;
  onSave: (raw: string) => void;
}) {
  const [draft, setDraft] = useState("");

  if (saved) {
    return (
      <p className="mt-4 border-t border-line pt-3 font-mono text-[9px] uppercase tracking-[0.1em] text-contacts">
        Saved — you&apos;ll see this next time this cart comes up
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <label
        htmlFor="session-note"
        className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft"
      >
        Where did you get to?
      </label>
      <textarea
        id="session-note"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="A line for future you — “cleared Asphodel, unlocked the rail”"
        className="mt-2 w-full resize-none rounded-[2px] border border-line bg-transparent px-3 py-2 text-sm text-label outline-none transition-colors placeholder:text-[#5b6a72] focus:border-contacts"
      />
      <button
        onClick={() => onSave(draft)}
        disabled={!draft.trim()}
        className="mt-2 rounded-[2px] border border-line px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:border-contacts hover:text-label disabled:opacity-40"
      >
        Save note
      </button>
    </div>
  );
}

function PickerSkeleton() {
  return (
    <div className="pt-[18px]">
      <div className="sweep h-8 w-40 bg-plank" />
      <div className="mt-6 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sweep h-11 w-24 bg-plank" />
        ))}
      </div>
      <div className="sweep mx-auto mt-6 h-[300px] w-[206px] rounded-cart bg-plank" />
    </div>
  );
}
