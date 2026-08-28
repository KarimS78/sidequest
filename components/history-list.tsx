"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getResume } from "@/app/history/actions";
import { deviceId } from "@/lib/device";
import { headerFor } from "@/lib/library";
import {
  clearHistory,
  loadHistory,
  markPlayed,
  type HistoryEntry,
} from "@/lib/history";
import { useI18n } from "@/i18n/context";
import type { Dict } from "@/i18n";

/**
 * Saves, grouped by game.
 *
 * The old screen was a flat list of draws, which is the wrong unit. "Where did
 * I leave off" is a question about Hollow Knight, not about a Tuesday, and
 * three sittings on one game printed as three sibling rows meant the note you
 * wanted was somewhere in the middle of them — with the read-back button
 * attached to exactly one row for reasons nothing on screen explained.
 *
 * One card per game now. The draws are still all there, folded away, because
 * they are history rather than the answer.
 */

type Group = {
  appid: number;
  name: string;
  entries: HistoryEntry[];
  /** Newest entry — the one whose played flag the card toggles. */
  latest: HistoryEntry;
  notes: { ago: string; raw: string }[];
  lastNote?: string;
};

type Resume =
  | { state: "reading" }
  | { state: "done"; where: string; next?: string }
  | { state: "failed"; why: string };

/**
 * Stable across renders, so the grouping below is actually memoised — an
 * inline closure here would have made the useMemo that depends on it a no-op.
 */
function useAgo(d: Dict) {
  return useCallback(
    (iso: string) => {
      const diff = Date.now() - Date.parse(iso);
      const min = Math.floor(diff / 60000);
      if (min < 1) return d.saves.ago.now;
      if (min < 60) return d.saves.ago.minutes(min);
      const h = Math.floor(min / 60);
      if (h < 24) return d.saves.ago.hours(h);
      return d.saves.ago.days(Math.floor(h / 24));
    },
    [d]
  );
}

export function HistoryList() {
  const { d, locale } = useI18n();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [resumes, setResumes] = useState<Record<number, Resume>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const ago = useAgo(d);
  const t = d.saves;

  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  // A read-back written in the other language is stale the moment you switch.
  useEffect(() => setResumes({}), [locale]);

  /** One entry per game, newest first, carrying every note left on it. */
  const groups = useMemo<Group[]>(() => {
    const map = new Map<number, Group>();
    for (const e of entries ?? []) {
      const existing = map.get(e.pick.appid);
      const group =
        existing ??
        ({
          appid: e.pick.appid,
          name: e.pick.name,
          entries: [],
          latest: e,
          notes: [],
          lastNote: undefined,
        } as Group);

      group.entries.push(e);
      const raw = e.note?.raw?.trim();
      if (raw) {
        group.notes.push({ ago: ago(e.at), raw });
        if (!group.lastNote) group.lastNote = e.note?.lastTime?.trim() || raw;
      }
      map.set(e.pick.appid, group);
    }
    return [...map.values()];
    // `ago` closes over the dictionary, and regrouping on a language switch is
    // exactly what should happen — the note ages are printed inside it.
  }, [entries, ago]);

  async function readBack(group: Group) {
    if (!group.notes.length || resumes[group.appid]?.state === "reading") return;

    setResumes((r) => ({ ...r, [group.appid]: { state: "reading" } }));
    try {
      const res = await getResume({
        deviceId: deviceId(),
        game: group.name,
        notes: group.notes,
        locale,
      });
      setResumes((r) => ({
        ...r,
        [group.appid]: res.ok
          ? { state: "done", where: res.where, next: res.next }
          : { state: "failed", why: res.reason },
      }));
    } catch {
      setResumes((r) => ({
        ...r,
        [group.appid]: { state: "failed", why: "no answer" },
      }));
    }
  }

  if (entries === null) return <SavesSkeleton />;

  if (entries.length === 0) {
    return (
      <div className="wrap flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="poster text-[clamp(2rem,6vw,3rem)]">{t.empty.title}</h1>
        <p className="max-w-sm text-muted">{t.empty.line}</p>
        <Link href="/play" className="btn btn-primary mt-2">
          {t.empty.cta} <span className="arrow">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap has-tabs flex flex-col gap-8 py-8 lg:py-12">
      <header className="flex flex-col gap-4">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1 className="poster text-[clamp(2.2rem,6vw,3.6rem)]">{t.title}</h1>
        <p className="max-w-2xl text-[15.5px] leading-relaxed text-muted">{t.lede}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-subtle">
            {t.counts(groups.length, entries.length)}
          </span>

          {/* Two steps, because one click used to wipe every note on the
              screen — the one thing on this page nothing else can rebuild. */}
          {confirmClear ? (
            <span className="flex items-center gap-2">
              <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-fg">
                {t.clearConfirm}
              </span>
              <button
                type="button"
                onClick={() => {
                  clearHistory();
                  setEntries([]);
                  setResumes({});
                  setConfirmClear(false);
                }}
                className="btn btn-ghost !min-h-8 !px-2.5 text-[12px]"
              >
                {t.clearYes}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="btn btn-quiet !min-h-8 !px-1 text-[12px]"
              >
                {t.clearNo}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="mono ml-auto text-[10px] uppercase tracking-[0.1em] text-subtle transition-colors hover:text-fg"
            >
              {t.clear}
            </button>
          )}
        </div>
      </header>

      <ul className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {groups.map((g) => {
          const resume = resumes[g.appid];
          const open = expanded.has(g.appid);

          return (
            <li key={g.appid} className="card overflow-hidden">
              {/* --- the game --- */}
              <div className="flex items-stretch gap-4">
                <span className="relative w-[132px] shrink-0 overflow-hidden">
                  <Image
                    src={headerFor(g.appid)}
                    alt=""
                    fill
                    sizes="132px"
                    className="object-cover"
                  />
                </span>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-4 pr-4">
                  <h2 className="poster truncate text-[1.15rem]">{g.name}</h2>
                  <p className="mono text-[10px] uppercase tracking-[0.1em] text-subtle">
                    {t.lastDrawn(ago(g.latest.at))} · {t.drawCount(g.entries.length)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEntries(markPlayed(g.latest.id, !g.latest.played))}
                    aria-pressed={g.latest.played}
                    className="mono flex items-center gap-2 self-start text-[10px] uppercase tracking-[0.1em] text-subtle transition-colors hover:text-fg"
                  >
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${
                        g.latest.played ? "bg-accent" : "bg-line-strong"
                      }`}
                    />
                    {g.latest.played ? t.played : t.skipped}
                  </button>
                </div>
              </div>

              {/* --- the note, which is the whole point of the screen --- */}
              <div className="border-t border-line px-4 py-4">
                <span className="mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                  {t.noteTitle}
                </span>
                {g.lastNote ? (
                  <p className="mt-1.5 text-[14.5px] leading-relaxed">{g.lastNote}</p>
                ) : (
                  <p className="mt-1.5 text-[14px] text-subtle">{t.noNote}</p>
                )}

                {/* The read-back: the product's own promise, at the one moment
                    it is worth anything. It gets a real button, not a hint. */}
                {g.notes.length > 0 && !resume && (
                  <button
                    type="button"
                    onClick={() => readBack(g)}
                    className="btn btn-ghost mt-3.5"
                  >
                    {t.readBack.cta} <span className="arrow">→</span>
                    <span className="mono ml-1 text-[10px] tracking-[0.1em] text-subtle">
                      {t.readBack.notes(g.notes.length)}
                    </span>
                  </button>
                )}

                {resume?.state === "reading" && (
                  <p className="mono mt-3.5 animate-pulse text-[10.5px] uppercase tracking-[0.12em] text-accent-soft">
                    {t.readBack.reading}
                  </p>
                )}

                {resume?.state === "done" && (
                  <div className="mt-3.5 border-l-2 border-accent pl-3">
                    <p className="text-[14.5px] leading-relaxed">{resume.where}</p>
                    {resume.next && (
                      <p className="mt-1.5 text-[14px] text-muted">
                        <span className="text-accent-soft">{t.readBack.next} · </span>
                        {resume.next}
                      </p>
                    )}
                  </div>
                )}

                {resume?.state === "failed" && (
                  <p className="mt-3.5 text-[13.5px] leading-relaxed text-subtle">
                    {t.readBack.failed(resume.why)}
                  </p>
                )}
              </div>

              {/* --- every draw, folded away: history, not the answer --- */}
              {g.entries.length > 1 && (
                <div className="border-t border-line px-4 py-3">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded((s) => {
                        const next = new Set(s);
                        if (next.has(g.appid)) next.delete(g.appid);
                        else next.add(g.appid);
                        return next;
                      })
                    }
                    className="mono text-[10px] uppercase tracking-[0.12em] text-subtle transition-colors hover:text-fg"
                  >
                    {open ? t.history.hide : t.history.show}
                  </button>

                  {open && (
                    <ul className="mt-3 grid gap-1.5">
                      {g.entries.map((e) => (
                        <li
                          key={e.id}
                          className="mono flex flex-wrap items-center gap-x-2 text-[10.5px] uppercase tracking-[0.08em] text-subtle"
                        >
                          <span className="text-muted">{ago(e.at)}</span>
                          <span aria-hidden>·</span>
                          <span>{d.common.time[e.time].label}</span>
                          <span aria-hidden>·</span>
                          <span>{e.mood}</span>
                          {e.played && (
                            <span className="text-accent-soft">· {t.played}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SavesSkeleton() {
  return (
    <div className="wrap has-tabs flex flex-col gap-6 py-8">
      <div className="card h-24 animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-52 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
