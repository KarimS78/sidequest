"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { explain, recommendGame, shortlist } from "@/lib/recommend";
import { getAiPick, summariseNote } from "@/app/play/actions";
import { deviceId } from "@/lib/device";
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

  const windowRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
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
    setRecentAppids([...new Set(loadHistory().slice(0, 8).map((e) => e.pick.appid))]);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const blacklistSet = new Set(blacklist);
  const pool = (library ?? []).filter((g) => !blacklistSet.has(g.appid));
  const byId = new Map((library ?? []).map((g) => [g.appid, g]));

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
          The shelf is empty
        </h1>
        <p className="mt-2.5 max-w-[26ch] text-sm text-ink-soft">
          Connect Steam and your backlog racks up here, one cartridge per game.
        </p>
        <Link
          href="/connect"
          className="mt-5 inline-flex h-[50px] items-center rounded-[3px] bg-label px-[22px] font-display text-[19px] font-extrabold uppercase tracking-[0.06em] text-ink"
        >
          Connect Steam
        </Link>
      </div>
    );
  }

  const busy = phase === "scanning" || phase === "seating" || phase === "reading";
  const cartClass =
    phase === "scanning"
      ? "cart-out"
      : phase === "seating"
        ? "cart-seating"
        : phase === "reading" || phase === "done"
          ? "cart-seating cart-seated"
          : "";

  return (
    <div className={phase === "reading" ? "is-reading" : undefined}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2.5 bg-gradient-to-b from-ground from-[72%] to-transparent pb-3 pt-[18px]">
        <h1 className="font-display text-[30px] font-extrabold uppercase leading-none tracking-[0.02em]">
          Tonight
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-soft">
          {isSample ? "Sample shelf" : `Shelf · ${pool.length} carts`}
        </span>
      </header>

      {phase !== "done" && (
        <>
          <p className="rule">Session</p>
          <div className="no-bar -mx-5 flex gap-1 overflow-x-auto px-5">
            {TIME.map((t) => (
              <Tab
                key={t.key}
                pressed={time === t.key}
                onClick={() => setTime(t.key)}
                fill="var(--shell-dark)"
              >
                {t.label}
              </Tab>
            ))}
          </div>

          <p className="rule">Mood</p>
          <div className="no-bar -mx-5 flex gap-1 overflow-x-auto px-5">
            {MOOD.map((m) => (
              <Tab
                key={m.key}
                pressed={mood === m.key && !customMood.trim()}
                onClick={() => {
                  setMood(m.key);
                  setCustomMood("");
                  setShowCustom(false);
                }}
                fill={m.band}
              >
                {m.label}
              </Tab>
            ))}
            <Tab
              pressed={!!customMood.trim()}
              onClick={() => setShowCustom(true)}
              fill="var(--shell-dark)"
            >
              Own words
            </Tab>
          </div>

          {showCustom && (
            <input
              autoFocus
              value={customMood}
              onChange={(e) => {
                setCustomMood(e.target.value);
                if (e.target.value.trim()) setMood(null);
              }}
              placeholder="cozy but a bit tense…"
              className="mt-2 min-h-[42px] w-full rounded-[2px] border border-line bg-transparent px-3 py-2 text-[13px] text-label outline-none transition-colors placeholder:text-[#6a5c52] focus:border-contacts"
            />
          )}
        </>
      )}

      {/* ---- the deck ---- */}
      <div className="pt-5">
        <div className={`cart mx-auto w-[206px] ${cartClass}`}>
          <div className="overflow-hidden rounded-label border border-black/25 bg-label">
            <div
              className="flex items-center justify-between px-2.5 py-[5px] font-mono text-[8px] uppercase tracking-[0.16em] text-label"
              style={{ background: band }}
            >
              <span>{customMood.trim() ? "Custom" : (mood ?? "—")}</span>
              <span>SQ-{String(pool.length).padStart(3, "0")}</span>
            </div>

            <div
              ref={windowRef}
              className="relative aspect-[5/6] overflow-hidden bg-paper"
            >
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
                        sizes="206px"
                        priority={i === 0}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-2 bg-label px-2.5 pb-2 pt-[7px] text-ink">
              <b className="font-display text-[19px] font-bold uppercase leading-[0.95]">
                {result ? result.pick.name : busy ? "Reading…" : "Pull to load"}
              </b>
              <span className="whitespace-nowrap font-mono text-[9px] text-ink-soft">
                {result
                  ? `${Math.round((byId.get(result.pick.appid)?.playtimeMin ?? 0) / 60)}H`
                  : `${pool.length} carts`}
              </span>
            </div>
          </div>
          <div className="cart-contacts" />
        </div>

        <div className="deck-slot mx-6 mt-0 flex items-center justify-center gap-1.5">
          <i className="deck-led" />
          <i className="deck-led" />
          <i className="deck-led" />
        </div>
      </div>

      {error && (
        <p className="mt-4 border border-challenge/40 bg-challenge/10 p-3 text-sm text-label">
          {error}
        </p>
      )}

      {/* ---- result ---- */}
      {phase === "done" && result && (
        <section className="mt-5">
          <h2 className="print font-display text-[38px] font-extrabold uppercase leading-[0.9] tracking-[0.01em]">
            {result.pick.name}
          </h2>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-soft">
            {(byId.get(result.pick.appid)?.playtimeMin ?? 0) > 0
              ? `${Math.round((byId.get(result.pick.appid)!.playtimeMin ?? 0) / 60)}h played`
              : "Never launched"}
            {(byId.get(result.pick.appid)?.recentMin ?? 0) > 0 &&
              ` · ${Math.round((byId.get(result.pick.appid)!.recentMin ?? 0) / 60)}h this fortnight`}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#cfc4b8]">
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
                  <span className="mt-1.5 block text-contacts">
                    Next: {lastNote.whatsNext}
                  </span>
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
                    className="inline-flex items-center gap-1.5 rounded-[2px] border border-line px-2.5 py-1 font-mono text-[10px] text-[#cfc4b8]"
                  >
                    <span aria-hidden>{r.icon}</span>
                    <b className="font-medium text-label">{head}</b>
                    {tail && <span>· {tail}</span>}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-[18px] flex gap-[7px]">
            <a
              href={`steam://run/${result.pick.appid}`}
              onClick={handlePlayed}
              className="flex h-[50px] flex-1 items-center justify-center rounded-[3px] bg-label font-display text-[20px] font-extrabold uppercase tracking-[0.06em] text-ink transition-transform duration-[var(--fast)] active:translate-y-0.5"
            >
              Let&apos;s play
            </a>
            <button
              onClick={eject}
              disabled={busy}
              className="h-[50px] shrink-0 rounded-[3px] border border-[#4d3f36] px-[18px] font-display text-[18px] font-bold uppercase tracking-[0.06em] text-[#cfc4b8] transition-colors duration-[var(--fast)] hover:border-label hover:text-label disabled:opacity-50"
            >
              Eject
            </button>
          </div>

          {!played && (
            <button
              onClick={handlePlayed}
              className="mt-3 w-full py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:text-label"
            >
              I played this
            </button>
          )}

          {played && <NoteField saved={noteSaved} onSave={handleNote} />}

          <button
            onClick={() => hideGame(result.pick.appid)}
            className="mt-3 w-full py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-[#6a5c52] transition-colors hover:text-challenge"
          >
            Never suggest this again
          </button>

          {result.alternatives.length > 0 && (
            <>
              <p className="rule mt-6">Or</p>
              <div className="grid gap-2">
                {result.alternatives.map((a) => (
                  <div
                    key={a.appid}
                    className="flex items-center gap-3 border border-line-soft p-2"
                  >
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
      )}

      {/* ---- the rank + the lever ---- */}
      {phase !== "done" && (
        <>
          <Rank count={pool.length} gapIndex={gapIndex} />
          <button
            onClick={() => pull(excluded)}
            disabled={busy}
            className="relative mt-[18px] h-14 w-full rounded-[4px] bg-gradient-to-b from-[#c4402c] to-[#9d3020] font-display text-[25px] font-extrabold uppercase tracking-[0.18em] text-label transition-[transform,box-shadow] duration-[var(--fast)] [transition-timing-function:var(--seat)] active:translate-y-1 active:shadow-none disabled:saturate-[0.35] disabled:brightness-75"
            style={{ boxShadow: "0 4px 0 #6d1f14, 0 10px 18px -8px rgba(0,0,0,.8)" }}
          >
            {busy ? "…" : "Pull"}
          </button>
          <button
            onClick={letItChoose}
            disabled={busy}
            className="mt-3 w-full py-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-label disabled:opacity-50"
          >
            or let it choose
          </button>
          {isSample && (
            <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-[#6a5c52]">
              Sample shelf ·{" "}
              <Link href="/connect" className="text-ink-soft hover:text-label">
                import yours
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** A printed tab, not a pill. */
function Tab({
  pressed,
  onClick,
  fill,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  fill: string;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-pressed={pressed}
      onClick={onClick}
      style={pressed ? { background: fill, borderColor: "transparent" } : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[2px] border px-3.5 font-display text-[16px] font-bold uppercase tracking-[0.04em] transition-colors duration-[var(--fast)] ${
        pressed
          ? "text-label"
          : "border-line text-ink-soft hover:border-[#4d3f36] hover:text-label"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The rank of spines. Deterministic heights and tints from the index, so the
 * shelf looks hand-stacked without re-randomising on every render.
 */
function Rank({ count, gapIndex }: { count: number; gapIndex: number | null }) {
  const TINTS = ["var(--story)", "var(--chill)", "var(--challenge)", "var(--quick)"];
  const spines = Math.min(Math.max(count, 12), 34);
  return (
    <div className="-mx-5 mt-3.5 px-5">
      <div className="no-bar flex items-end gap-[3px] overflow-x-auto pt-2">
        {Array.from({ length: spines }).map((_, i) => (
          <span
            key={i}
            className={`spine ${i % 3 === 1 ? "spine-cream" : ""} ${
              gapIndex !== null && i === gapIndex % spines ? "spine-gap" : ""
            }`}
            style={
              {
                height: `${44 + ((i * 7) % 10)}px`,
                "--tint": TINTS[i % TINTS.length],
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="h-[5px] bg-plank shadow-[0_1px_0_var(--plank-edge)]" />
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
        className="mt-2 w-full resize-none rounded-[2px] border border-line bg-transparent px-3 py-2 text-sm text-label outline-none transition-colors placeholder:text-[#6a5c52] focus:border-contacts"
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
