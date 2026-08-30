"use client";

import { useEffect, useMemo, useState } from "react";
import { getAiPortrait } from "@/app/profile/actions";
import { deviceId } from "@/lib/device";
import { announceAiCall } from "@/lib/ai-events";
import type { BacklogStats, StoredGame } from "@/lib/library";
import { useI18n } from "@/i18n/context";
import type { AiFailCode } from "@/lib/ai-fail";

/**
 * The shelf, read as a person.
 *
 * It sits beside the roast on purpose. Same numbers, two readings: the roast
 * mocks the habit, this one takes it seriously — and having both is the honest
 * position, because a backlog genuinely is both a joke and a taste.
 *
 * Never fetched on mount. A portrait nobody asked to read is a paid call on
 * every page view, and this is the one screen where the player can see exactly
 * what a call costs.
 */
type State =
  | { s: "idle" }
  | { s: "reading" }
  | { s: "done"; archetype: string; reading: string; blindSpot: string; cached: boolean }
  | { s: "failed"; why: AiFailCode };

export function ShelfPortrait({
  library,
  stats,
  stated,
}: {
  library: StoredGame[];
  stats: BacklogStats;
  stated: string[];
}) {
  const { d, locale } = useI18n();
  const [state, setState] = useState<State>({ s: "idle" });
  const t = d.profile.portrait;

  // A reading generated in the other language is worse than no reading: the
  // player switched languages and the one paragraph written for them stayed
  // behind. Clear it and let them ask again in the language they are reading.
  useEffect(() => setState({ s: "idle" }), [locale]);

  // The shelf's tags, most carried first. Counts only — the model is told what
  // this shelf is made of, never which games are on it.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of library) {
      for (const raw of g.tags ?? []) {
        const tag = raw.trim();
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
        locale,
      });
      // The gauge sits on the same screen; tell it the count moved.
      announceAiCall();
      setState(
        res.ok
          ? {
              s: "done",
              archetype: res.portrait.archetype,
              reading: res.portrait.reading,
              blindSpot: res.portrait.blindSpot,
              cached: res.cached,
            }
          : { s: "failed", why: res.code }
      );
    } catch {
      setState({ s: "failed", why: "unreachable" });
    }
  }

  return (
    <section className="card flex flex-col gap-4 p-5 lg:p-6">
      <h3 className="poster text-[1.05rem]">{t.title}</h3>

      {state.s === "idle" && (
        <>
          <button
            type="button"
            onClick={read}
            disabled={stats.total === 0 || tags.length === 0}
            className="btn btn-ghost self-start"
          >
            {t.cta} <span className="arrow">→</span>
          </button>
          <span className="mono text-[10px] uppercase tracking-[0.1em] text-subtle">
            {tags.length > 0 ? t.cost(tags.length) : t.noTags}
          </span>
        </>
      )}

      {state.s === "reading" && (
        <p className="mono animate-pulse text-[10.5px] uppercase tracking-[0.12em] text-accent-soft">
          {t.reading}
        </p>
      )}

      {state.s === "done" && (
        <>
          <p className="poster text-[clamp(1.5rem,3vw,2.1rem)] text-accent-soft">
            {state.archetype}
          </p>
          <p className="text-[14.5px] leading-relaxed text-muted">{state.reading}</p>
          {state.blindSpot && (
            <p className="border-l-2 border-accent pl-3 text-[14px] leading-relaxed">
              <span className="mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                {t.blindSpot} ·{" "}
              </span>
              {state.blindSpot}
            </p>
          )}
          <button
            type="button"
            onClick={() => setState({ s: "idle" })}
            className="btn btn-quiet self-start !px-0 text-[12.5px]"
          >
            {state.cached ? t.againCached : t.again}
          </button>
        </>
      )}

      {state.s === "failed" && (
        <>
          <p className="text-[14px] leading-relaxed text-muted">{t.failed(d.common.aiFail[state.why])}</p>
          <button
            type="button"
            onClick={() => setState({ s: "idle" })}
            className="btn btn-quiet self-start !px-0 text-[12.5px]"
          >
            {t.retry}
          </button>
        </>
      )}
    </section>
  );
}
