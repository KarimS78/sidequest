"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CoverArt } from "@/components/cover-art";
import { getResume } from "@/app/history/actions";
import { deviceId } from "@/lib/device";
import {
  clearHistory,
  loadHistory,
  markPlayed,
  type HistoryEntry,
} from "@/lib/history";

const TIME_LABEL: Record<string, string> = {
  short: "30 min",
  medium: "1–2 hrs",
  long: "All evening",
};

function timeAgo(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

/** What the read-back says, per game. */
type Resume =
  | { state: "reading" }
  | { state: "done"; where: string; next?: string }
  | { state: "failed"; why: string };

export function HistoryList() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [resumes, setResumes] = useState<Record<number, Resume>>({});

  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  /**
   * Every note left on a game, newest first — the raw material of a read-back.
   *
   * Keyed by game rather than by pull, because "where did I leave off" is a
   * question about Hollow Knight, not about a Tuesday. Three sittings that each
   * left a line are three lines about one save file.
   */
  const notesByGame = useMemo(() => {
    const map = new Map<number, { ago: string; raw: string }[]>();
    for (const e of entries ?? []) {
      const raw = e.note?.raw?.trim();
      if (!raw) continue;
      const list = map.get(e.pick.appid) ?? [];
      list.push({ ago: timeAgo(e.at), raw });
      map.set(e.pick.appid, list);
    }
    return map;
  }, [entries]);

  async function readBack(appid: number, game: string) {
    const notes = notesByGame.get(appid);
    if (!notes?.length || resumes[appid]?.state === "reading") return;

    setResumes((r) => ({ ...r, [appid]: { state: "reading" } }));
    try {
      const res = await getResume({ deviceId: deviceId(), game, notes });
      setResumes((r) => ({
        ...r,
        [appid]: res.ok
          ? { state: "done", where: res.where, next: res.next }
          : { state: "failed", why: res.reason },
      }));
    } catch {
      setResumes((r) => ({ ...r, [appid]: { state: "failed", why: "no answer" } }));
    }
  }

  if (entries === null) return <SavesSkeleton />;

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <span className="deck-slot w-28" />
        <h1 className="mt-5 font-display text-[30px] font-extrabold uppercase leading-none">
          No saves yet
        </h1>
        <p className="mt-2.5 max-w-[26ch] text-sm text-ink-soft">
          Every cart the deck seats lands here, with the note you left on it.
        </p>
        <Link
          href="/play"
          className="switch mt-5 inline-flex h-[50px] w-auto items-center px-[22px] font-display text-[19px] font-extrabold uppercase tracking-[0.12em]"
        >
          Run a draw
        </Link>
      </div>
    );
  }

  const playedCount = entries.filter((e) => e.played).length;
  // Only the newest pull of a game offers the read-back: the same button on
  // three rows for one save file is three ways to spend the same call.
  const newestSeen = new Set<number>();

  return (
    <>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-2.5 bg-gradient-to-b from-ground from-[72%] to-transparent pb-3 pt-[18px] lg:static lg:pb-6 lg:pt-9">
        <div>
          <h1 className="font-display text-[30px] font-extrabold uppercase leading-none tracking-[0.02em] lg:text-[54px]">
            Saves
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-soft">
            {entries.length} {entries.length === 1 ? "pull" : "pulls"} ·{" "}
            {playedCount} played
          </p>
        </div>
        <button
          onClick={() => {
            clearHistory();
            setEntries([]);
            setResumes({});
          }}
          className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:text-challenge"
        >
          Clear
        </button>
      </header>

      <div className="border-t border-line-soft lg:grid lg:grid-cols-2 lg:gap-x-10 lg:border-t-0">
        {entries.map((e) => {
          const first = !newestSeen.has(e.pick.appid);
          if (first) newestSeen.add(e.pick.appid);
          const notes = notesByGame.get(e.pick.appid) ?? [];
          const canResume = first && notes.length > 0;
          const resume = resumes[e.pick.appid];

          return (
            <div
              key={e.id}
              className="flex items-start gap-3 border-b border-line-soft py-3"
            >
              <div className="relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-[2px] bg-[#10161a]">
                <CoverArt appid={e.pick.appid} name={e.pick.name} sizes="40px" />
              </div>

              <div className="min-w-0 flex-1">
                <b className="block font-display text-[18px] font-bold uppercase leading-none">
                  {e.pick.name}
                </b>
                <button
                  onClick={() => setEntries(markPlayed(e.id, !e.played))}
                  className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-soft transition-colors hover:text-label"
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      e.played ? "bg-contacts" : "bg-[#1e262b]"
                    }`}
                  />
                  {e.played ? "played" : "skipped"} · {TIME_LABEL[e.time] ?? e.time} ·{" "}
                  {e.mood}
                </button>
                {e.note?.lastTime && (
                  <p className="mt-1.5 text-[13px] leading-snug text-[#b3c0c7]">
                    {e.note.lastTime}
                  </p>
                )}

                {/* The read-back. This is the product's own sentence — "never
                    forget where you left off" — at the one moment it is worth
                    anything: weeks later, looking at your own shorthand. */}
                {canResume && !resume && (
                  <button
                    onClick={() => readBack(e.pick.appid, e.pick.name)}
                    className="key mt-2 inline-flex min-h-8 items-center gap-1.5 px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-label"
                  >
                    <i className="led" aria-hidden />
                    Where was I
                    {notes.length > 1 && (
                      <span className="text-[#5b6a72]">· {notes.length} notes</span>
                    )}
                  </button>
                )}

                {resume?.state === "reading" && (
                  <p className="readout readout-dim mt-2">Reading your notes back…</p>
                )}

                {resume?.state === "done" && (
                  <div className="readout mt-2">
                    {resume.where}
                    {resume.next && (
                      <>
                        <br />
                        <span className="text-[#8a9aa2]">Next: {resume.next}</span>
                      </>
                    )}
                  </div>
                )}

                {resume?.state === "failed" && (
                  <p className="readout readout-dim mt-2">
                    Couldn’t read it back — {resume.why}. Your own note is above,
                    which is the copy that matters.
                  </p>
                )}
              </div>

              <span className="shrink-0 font-mono text-[9px] text-[#5b6a72]">
                {timeAgo(e.at)}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SavesSkeleton() {
  return (
    <div className="pt-[18px]">
      <div className="sweep h-8 w-28 bg-plank" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="sweep aspect-[3/4] w-10 rounded-[2px] bg-plank" />
            <div className="flex-1 space-y-2 py-1">
              <div className="sweep h-4 w-2/3 bg-plank" />
              <div className="sweep h-2.5 w-1/3 bg-plank" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
