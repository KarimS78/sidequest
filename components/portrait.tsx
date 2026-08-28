"use client";

import { useMemo, useState } from "react";
import { getAiPortrait } from "@/app/profile/actions";
import { deviceId } from "@/lib/device";
import type { BacklogStats, StoredGame } from "@/lib/library";

/**
 * The shelf, read as a person.
 *
 * It sits directly above the roast on purpose. Same numbers, two readings: the
 * roast mocks the habit, this one takes it seriously — and having both is the
 * honest position, because a backlog genuinely is both a joke and a taste.
 *
 * It is never fetched on mount. A portrait nobody asked to read is a paid call
 * on every page view, and this panel is the one place in the app where the
 * player can see exactly what a call costs.
 */
type State =
  | { s: "idle" }
  | { s: "reading" }
  | { s: "done"; archetype: string; reading: string; blindSpot: string; cached: boolean }
  | { s: "failed"; why: string };

export function ShelfPortrait({
  library,
  stats,
  stated,
}: {
  library: StoredGame[];
  stats: BacklogStats;
  stated: string[];
}) {
  const [state, setState] = useState<State>({ s: "idle" });

  // The shelf's tags, most carried first. Counts only — the model is told what
  // this shelf is made of, never which games are on it.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of library) {
      for (const t of g.tags ?? []) {
        const tag = t.trim();
        if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }));
  }, [library]);

  async function read() {
    if (state.s === "reading") return;
    setState({ s: "reading" });
    try {
      const res = await getAiPortrait({
        deviceId: deviceId(),
        stats: {
          total: stats.total,
          played: stats.played,
          neverPlayed: stats.neverPlayed,
          barelyPlayed: stats.barelyPlayed,
          totalHours: stats.totalHours,
          topGame: stats.topGame,
        },
        tags,
        stated,
      });
      setState(
        res.ok
          ? {
              s: "done",
              archetype: res.portrait.archetype,
              reading: res.portrait.reading,
              blindSpot: res.portrait.blindSpot,
              cached: res.cached,
            }
          : { s: "failed", why: res.reason }
      );
    } catch {
      setState({ s: "failed", why: "the board didn't answer" });
    }
  }

  return (
    <>
      <p className="rule mt-7">What the shelf says</p>

      {state.s === "idle" && (
        <button
          onClick={read}
          disabled={stats.total === 0 || tags.length === 0}
          className="key flex min-h-11 w-full items-center gap-2.5 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-label disabled:opacity-40"
        >
          <i className="led" aria-hidden />
          Read the shelf
          <span className="ml-auto text-[9px] text-[#5b6a72]">
            {tags.length > 0 ? `${tags.length} tags · one call` : "no tags yet"}
          </span>
        </button>
      )}

      {state.s === "reading" && (
        <div className="key flex min-h-11 w-full items-center gap-2.5 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
          <i className="led led-on led-pulse" aria-hidden />
          Reading the rack…
        </div>
      )}

      {state.s === "done" && (
        <div>
          <b className="print block font-display text-[30px] font-extrabold uppercase leading-[0.92]">
            {state.archetype}
          </b>
          <p className="mt-2 text-[13px] leading-relaxed text-[#b3c0c7]">{state.reading}</p>
          {state.blindSpot && (
            <div className="readout mt-3">Blind spot: {state.blindSpot}</div>
          )}
          <button
            onClick={() => setState({ s: "idle" })}
            className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#5b6a72] transition-colors hover:text-label"
          >
            {state.cached ? "Read again · free, cached" : "Read again"}
          </button>
        </div>
      )}

      {state.s === "failed" && (
        <>
          <p className="readout readout-dim">
            No reading — {state.why}. Every other panel on this page is local and
            unaffected.
          </p>
          <button
            onClick={() => setState({ s: "idle" })}
            className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#5b6a72] transition-colors hover:text-label"
          >
            Try again
          </button>
        </>
      )}
    </>
  );
}
