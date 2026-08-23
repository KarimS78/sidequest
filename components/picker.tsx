"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { explain, recommendGame, shortlist } from "@/lib/recommend";
import { getAiPick } from "@/app/play/actions";
import { deviceId } from "@/lib/device";
import {
  loadLibrary,
  loadProfile,
  loadBlacklist,
  addToBlacklist,
  SAMPLE_LIBRARY,
  type StoredGame,
} from "@/lib/library";
import { addHistory, markPlayed, loadHistory } from "@/lib/history";
import type {
  PickerTime,
  PickerMood,
  Reason,
  Recommendation,
  RecommendInput,
} from "@/lib/recommend";

/**
 * Swap in the game the model chose, keeping the engine's badges for THAT game.
 *
 * The sentence is the model's; the badges stay derived from the score, so the
 * justification on screen can never drift from the maths. If the model somehow
 * names a game the engine didn't score, the local pick stands.
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

/**
 * The engine answers in under a millisecond, but the reel *is* the feature —
 * landing instantly reads as "it didn't think". Hold the spin for a beat.
 */
const SPIN_MS = 700;

const TIME: { key: PickerTime; label: string; hint: string }[] = [
  { key: "short", label: "~30 min", hint: "Just a quick one" },
  { key: "medium", label: "1–2 hours", hint: "A proper session" },
  { key: "long", label: "All evening", hint: "Deep dive" },
];

const MOOD: { key: PickerMood; label: string; emoji: string }[] = [
  { key: "chill", label: "Chill", emoji: "🌙" },
  { key: "story", label: "Story", emoji: "📖" },
  { key: "challenge", label: "Challenge", emoji: "⚔️" },
  { key: "quick", label: "Quick fun", emoji: "⚡" },
];

// "Decide for me" needs sensible defaults so it can fire in one tap. We infer
// them from the clock: nobody starts a 4h CRPG at 11pm on a Tuesday.
function timeOfDayContext(): { time: PickerTime; mood: PickerMood; label: string } {
  const now = new Date();
  const h = now.getHours();
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  if (h >= 23 || h < 6)
    return { time: "short", mood: "chill", label: "It's late — keeping it short and chill" };
  if (weekend && h >= 10 && h < 20)
    return { time: "long", mood: "story", label: "Weekend — room for a proper dive" };
  if (!weekend && h >= 18)
    return { time: "medium", mood: "chill", label: "Weeknight wind-down" };
  return { time: "medium", mood: "chill", label: "A relaxed session" };
}

export function Picker() {
  const [library, setLibrary] = useState<StoredGame[]>([]);
  const [isSample, setIsSample] = useState(true);
  const [genres, setGenres] = useState<string[]>([]);
  const [blacklist, setBlacklist] = useState<number[]>([]);

  const [time, setTime] = useState<PickerTime | null>(null);
  const [mood, setMood] = useState<PickerMood | null>(null);
  const [customMood, setCustomMood] = useState("");

  const [result, setResult] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [played, setPlayed] = useState(false);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [recentAppids, setRecentAppids] = useState<number[]>([]);
  const [pending, setPending] = useState(false);

  // Slot-machine reel: a game cycling on screen while the pick lands.
  const [reel, setReel] = useState<StoredGame | null>(null);

  useEffect(() => {
    const lib = loadLibrary();
    setLibrary(lib ?? SAMPLE_LIBRARY);
    setIsSample(!lib);
    setGenres(loadProfile().favoriteGenres);
    setBlacklist(loadBlacklist());
    // Recent picks → penalised by the engine so it stops repeating itself.
    setRecentAppids([...new Set(loadHistory().slice(0, 8).map((e) => e.pick.appid))]);
  }, []);

  const blacklistSet = new Set(blacklist);
  // The pool the picker draws from: everything except games hidden for good.
  const pool = library.filter((g) => !blacklistSet.has(g.appid));
  const byId = new Map(library.map((g) => [g.appid, g]));

  // Games played in the last 2 weeks — offered as a one-tap "continue" shortcut.
  const recentGames = pool
    .filter((g) => (g.recentMin ?? 0) > 0)
    .sort((a, b) => (b.recentMin ?? 0) - (a.recentMin ?? 0))
    .slice(0, 4);

  const trimmedCustom = customMood.trim();

  // Spin the reel while the pick resolves, then it lands on the real one.
  const reelTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (spinTimer.current) clearTimeout(spinTimer.current);
    },
    []
  );
  useEffect(() => {
    if (pending && pool.length) {
      reelTimer.current = setInterval(() => {
        setReel(pool[Math.floor(Math.random() * pool.length)]);
      }, 90);
    } else if (reelTimer.current) {
      clearInterval(reelTimer.current);
      reelTimer.current = null;
    }
    return () => {
      if (reelTimer.current) clearInterval(reelTimer.current);
    };
  }, [pending, pool.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Core call. Takes the context explicitly so "Decide for me" can fire with
  // computed values without waiting for state to flush.
  function runRecommend(opts: {
    time: PickerTime;
    mood: PickerMood | null;
    customMood: string;
    exclude: number[];
  }) {
    const custom = opts.customMood.trim();
    if (!opts.time || (!opts.mood && !custom)) return;
    setError(null);
    setPending(true);

    const engineInput = {
      library: pool.map((g) => ({
        appid: g.appid,
        name: g.name,
        playtimeMin: g.playtimeMin,
        recentMin: g.recentMin ?? 0,
        tags: g.tags,
      })),
      favoriteGenres: genres,
      time: opts.time,
      mood: opts.mood ?? undefined,
      customMood: custom || undefined,
      excludeAppids: opts.exclude,
      recentAppids,
    };

    const res = recommendGame(engineInput);
    const moodLabel =
      custom || MOOD.find((m) => m.key === opts.mood)?.label || opts.mood || "";

    // The AI only ever sees the engine's shortlist. It runs alongside the reel,
    // and anything short of a clean answer leaves the local pick standing.
    const aiPromise: Promise<{ appid: number; reason: string } | null> = res.ok
      ? getAiPick({
          deviceId: deviceId(),
          candidates: shortlist(engineInput),
          time: TIME.find((t) => t.key === opts.time)?.label ?? opts.time,
          mood: moodLabel,
        })
          .then((r) => (r.ok ? { appid: r.appid, reason: r.reason } : null))
          .catch(() => null)
      : Promise.resolve(null);

    const spun = new Promise<void>((resolve) => {
      if (spinTimer.current) clearTimeout(spinTimer.current);
      spinTimer.current = setTimeout(resolve, SPIN_MS);
    });

    // Reveal once the reel has run AND the model has had its say — whichever
    // finishes last. The reel never waits on a spinner.
    Promise.all([spun, aiPromise]).then(([, ai]) => {
      setPending(false);
      if (res.ok) {
        const merged = ai
          ? applyAiPick(res.recommendation, ai, engineInput)
          : res.recommendation;
        setResult(merged);
        setNote(res.note ?? null);
        const game = pool.find((g) => g.appid === merged.pick.appid);
        const entry = addHistory({
          time: opts.time,
          mood: moodLabel,
          pick: {
            appid: merged.pick.appid,
            name: merged.pick.name,
            coverUrl: game?.coverUrl ?? "",
          },
          alternatives: merged.alternatives.map((a) => ({
            appid: a.appid,
            name: a.name,
          })),
        });
        setEntryId(entry.id);
        setPlayed(false);
      } else {
        setError(res.error);
        setResult(null);
      }
    });
  }

  function recommend(exclude: number[] = []) {
    if (!time) return;
    runRecommend({ time, mood, customMood, exclude });
  }

  // One tap, zero thinking: infer time + mood from the clock and pick now.
  function decideForMe() {
    const ctx = timeOfDayContext();
    setTime(ctx.time);
    setMood(ctx.mood);
    setCustomMood("");
    setExcluded([]);
    runRecommend({ time: ctx.time, mood: ctx.mood, customMood: "", exclude: [] });
  }

  function handlePlayed() {
    if (!entryId) return;
    markPlayed(entryId);
    setPlayed(true);
  }

  // Main button: a fresh pick. Forgets earlier rejections, but still never hands
  // back the game already on screen — otherwise the same inputs return the same
  // pick and it feels like the button does nothing.
  function freshPick() {
    const next = result ? [result.pick.appid] : [];
    setExcluded(next);
    recommend(next);
  }

  // "Not this one": exclude the current pick and roll again.
  function rejectPick() {
    if (!result) return;
    const next = [...excluded, result.pick.appid];
    setExcluded(next);
    recommend(next);
  }

  // "Never suggest again": blacklist for good, then roll a replacement.
  function hideGame(appid: number) {
    const nextBlack = addToBlacklist(appid);
    setBlacklist(nextBlack);
    const next = [...excluded, appid];
    setExcluded(next);
    recommend(next);
  }

  const ready = time && (mood || trimmedCustom);

  return (
    <div className="space-y-6">
      {recentGames.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold tracking-tight">Jump back in</h2>
          <p className="mt-1 text-xs text-muted">
            You&apos;ve been playing these lately — pick up where you left off.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recentGames.map((g) => (
              <a
                key={g.appid}
                href={`steam://run/${g.appid}`}
                className="card-hover group overflow-hidden rounded-xl border border-border bg-background"
              >
                <div className="aspect-[460/215] w-full bg-elevated">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.coverUrl}
                    alt={g.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-1 text-xs font-medium">{g.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-accent-soft">
                    {Math.round((g.recentMin ?? 0) / 60)}h in 2 weeks
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              What should I play right now?
            </h1>
            <p className="mt-1 text-sm text-muted">
              Tell me your time and mood — I&apos;ll pick the one game to launch
              from your library.
            </p>
          </div>
        </div>

        <p className="mt-3 font-mono text-xs text-subtle">
          {isSample ? (
            <>
              Using a sample library ·{" "}
              <Link href="/connect" className="text-accent-soft hover:underline">
                import your Steam games
              </Link>
            </>
          ) : (
            <>Picking from your {pool.length} games</>
          )}
        </p>

        <button
          onClick={decideForMe}
          disabled={pending || !pool.length}
          className="mt-5 w-full rounded-xl border border-accent bg-accent-dim px-5 py-3 text-sm font-semibold text-accent-soft transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          🎲 Just decide for me
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-subtle">
          <span className="h-px flex-1 bg-border" />
          or tell me what you&apos;re after
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-4">
          <Field label="How much time?">
            <div className="grid grid-cols-3 gap-2">
              {TIME.map((t) => (
                <Choice
                  key={t.key}
                  active={time === t.key}
                  onClick={() => setTime(t.key)}
                  title={t.label}
                  sub={t.hint}
                />
              ))}
            </div>
          </Field>

          <Field label="What's the mood?">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MOOD.map((m) => (
                <Choice
                  key={m.key}
                  active={mood === m.key && !trimmedCustom}
                  onClick={() => {
                    setMood(m.key);
                    setCustomMood("");
                  }}
                  title={`${m.emoji} ${m.label}`}
                />
              ))}
            </div>
            <input
              value={customMood}
              onChange={(e) => {
                setCustomMood(e.target.value);
                if (e.target.value.trim()) setMood(null);
              }}
              placeholder="…or describe your own mood — e.g. “cozy but a little tense”"
              className={`mt-2 w-full rounded-lg border bg-elevated px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-subtle ${
                trimmedCustom
                  ? "border-accent bg-accent-dim"
                  : "border-border focus:border-accent"
              }`}
            />
          </Field>
        </div>

        <button
          onClick={freshPick}
          disabled={!ready || pending}
          className="mt-6 w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,92,255,0.4)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {pending
            ? "Thinking…"
            : result
              ? "Pick again"
              : ready
                ? "Recommend a game"
                : "Pick a time and a mood"}
        </button>
      </div>

      {error && (
        <div className="card border-amber/30 bg-amber/5 p-4 text-sm text-amber">
          {error}
        </div>
      )}

      {pending && <ReelCard game={reel} />}

      {!pending && result && (
        <div className="space-y-4">
          {note && (
            <div className="rounded-xl border border-border bg-accent-dim px-4 py-2.5 text-xs text-accent-soft">
              {note}
            </div>
          )}

          <PickCard
            game={byId.get(result.pick.appid)}
            name={result.pick.name}
            reason={result.pick.reason}
            reasons={result.pick.reasons}
            played={played}
            onPlayed={handlePlayed}
            onReject={rejectPick}
            onHide={() => hideGame(result.pick.appid)}
            rejecting={pending}
          />

          {result.alternatives.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-subtle">
                Or, if not that…
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.alternatives.map((a) => (
                  <AltCard
                    key={a.appid}
                    game={byId.get(a.appid)}
                    name={a.name}
                    reason={a.reason}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Slot-machine card shown while the AI thinks: a game cover flickers past.
function ReelCard({ game }: { game?: StoredGame | null }) {
  return (
    <div className="glow-border overflow-hidden rounded-2xl bg-background">
      <div className="aspect-[460/215] w-full bg-elevated">
        {game?.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.coverUrl}
            alt=""
            className="h-full w-full object-cover opacity-70 blur-[1px] transition-opacity"
          />
        )}
      </div>
      <div className="p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-accent-soft">
          Rolling…
        </p>
        <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-muted">
          {game?.name ?? "Picking your game"}
        </h2>
        <p className="mt-2 text-sm text-subtle">Weighing your time, mood and backlog…</p>
      </div>
    </div>
  );
}

function PickCard({
  game,
  name,
  reason,
  reasons,
  played,
  onPlayed,
  onReject,
  onHide,
  rejecting,
}: {
  game?: StoredGame;
  name: string;
  reason: string;
  reasons: Reason[];
  played: boolean;
  onPlayed: () => void;
  onReject: () => void;
  onHide: () => void;
  rejecting: boolean;
}) {
  return (
    <div className="glow-border overflow-hidden rounded-2xl bg-background">
      {game?.coverUrl && (
        <div className="aspect-[460/215] w-full bg-elevated">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={game.coverUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-accent-soft">
          Tonight, play
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{name}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{reason}</p>
        {reasons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {reasons.map((r) => (
              <span
                key={r.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-1 text-xs text-muted"
              >
                <span aria-hidden>{r.icon}</span>
                {r.label}
              </span>
            ))}
          </div>
        )}
        {game && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={`steam://run/${game.appid}`}
              onClick={onPlayed}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              ▶ Launch on Steam
            </a>
            <button
              onClick={onPlayed}
              disabled={played}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                played
                  ? "cursor-default border border-green/30 bg-green/10 text-green"
                  : "border border-border bg-elevated text-muted hover:border-accent hover:text-accent-soft"
              }`}
            >
              {played ? "Played ✓" : "I played this"}
            </button>
            <button
              onClick={onReject}
              disabled={rejecting}
              className="rounded-lg border border-border bg-elevated px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
            >
              Not this one ↻
            </button>
            <button
              onClick={onHide}
              disabled={rejecting}
              className="rounded-lg px-3 py-2 text-sm font-medium text-subtle transition-colors hover:text-amber disabled:opacity-50"
            >
              Never suggest again 🚫
            </button>
            <a
              href={`https://store.steampowered.com/app/${game.appid}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-subtle hover:text-foreground"
            >
              View store page ↗
            </a>
            {game.playtimeMin > 0 && (
              <span className="font-mono text-xs text-subtle">
                {Math.round(game.playtimeMin / 60)}h played
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AltCard({
  game,
  name,
  reason,
}: {
  game?: StoredGame;
  name: string;
  reason: string;
}) {
  return (
    <div className="card flex gap-3 p-3">
      {game?.coverUrl && (
        <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-elevated">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={game.coverUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted">{reason}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle">
        {label}
      </p>
      {children}
    </div>
  );
}

function Choice({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
        active
          ? "border-accent bg-accent-dim"
          : "border-border bg-elevated hover:border-border-strong"
      }`}
    >
      <span className="block text-sm font-medium">{title}</span>
      {sub && <span className="mt-0.5 block text-xs text-subtle">{sub}</span>}
    </button>
  );
}
