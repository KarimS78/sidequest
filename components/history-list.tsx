"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CoverArt } from "@/components/cover-art";
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

export function HistoryList() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  if (entries === null) return <SavesSkeleton />;

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <span className="deck-slot w-28" />
        <h1 className="mt-5 font-display text-[30px] font-extrabold uppercase leading-none">
          No saves yet
        </h1>
        <p className="mt-2.5 max-w-[26ch] text-sm text-ink-soft">
          Every cartridge the deck picks lands here, with what you wrote about it.
        </p>
        <Link
          href="/play"
          className="mt-5 inline-flex h-[50px] items-center rounded-[3px] bg-label px-[22px] font-display text-[19px] font-extrabold uppercase tracking-[0.06em] text-ink"
        >
          Pull one
        </Link>
      </div>
    );
  }

  const playedCount = entries.filter((e) => e.played).length;

  return (
    <>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-2.5 bg-gradient-to-b from-ground from-[72%] to-transparent pb-3 pt-[18px]">
        <div>
          <h1 className="font-display text-[30px] font-extrabold uppercase leading-none tracking-[0.02em]">
            Saves
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-soft">
            {entries.length} pulls · {playedCount} played
          </p>
        </div>
        <button
          onClick={() => {
            clearHistory();
            setEntries([]);
          }}
          className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:text-challenge"
        >
          Clear
        </button>
      </header>

      <div className="border-t border-line-soft">
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-start gap-3 border-b border-line-soft py-3"
          >
            <div className="relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-[2px] bg-[#2a221d]">
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
                    e.played ? "bg-contacts" : "bg-[#3a2f28]"
                  }`}
                />
                {e.played ? "played" : "skipped"} · {TIME_LABEL[e.time] ?? e.time} ·{" "}
                {e.mood}
              </button>
              {e.note?.lastTime && (
                <p className="mt-1.5 text-[13px] leading-snug text-[#cfc4b8]">
                  {e.note.lastTime}
                </p>
              )}
            </div>

            <span className="shrink-0 font-mono text-[9px] text-[#6a5c52]">
              {timeAgo(e.at)}
            </span>
          </div>
        ))}
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
