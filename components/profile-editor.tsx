"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CoverArt } from "@/components/cover-art";
import { TrophyCase } from "@/components/eggs";
import {
  computeBacklogStats,
  GENRE_OPTIONS,
  loadBlacklist,
  loadLibrary,
  loadProfile,
  removeFromBlacklist,
  SAMPLE_LIBRARY,
  saveProfile,
  type StoredGame,
} from "@/lib/library";
import { BacklogRoast } from "@/components/roast";

export function ProfileEditor() {
  const [genres, setGenres] = useState<string[]>([]);
  const [library, setLibrary] = useState<StoredGame[] | null>(null);
  const [blacklist, setBlacklist] = useState<number[]>([]);
  const [isSample, setIsSample] = useState(true);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const lib = loadLibrary();
    setGenres(loadProfile().favoriteGenres);
    // Same fallback as the deck and the shelf: without it a first-time visitor
    // sees zeroed stats here while every other screen shows the sample shelf.
    setLibrary(lib ?? SAMPLE_LIBRARY);
    setIsSample(!lib);
    setBlacklist(loadBlacklist());
  }, []);

  function persist(next: string[]) {
    setGenres(next);
    saveProfile({ favoriteGenres: next });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  }

  if (library === null) return <ProfileSkeleton />;

  const stats = computeBacklogStats(library);
  const sealed = stats.total ? Math.round((stats.neverPlayed / stats.total) * 100) : 0;
  const blacklistSet = new Set(blacklist);
  const hidden = library.filter((g) => blacklistSet.has(g.appid));

  return (
    <>
      <header className="sticky top-0 z-10 bg-gradient-to-b from-ground from-[72%] to-transparent pb-3 pt-[18px] lg:static lg:pb-6 lg:pt-9">
        <h1 className="font-display text-[30px] font-extrabold uppercase leading-none tracking-[0.02em] lg:text-[54px]">
          Collector
        </h1>
      </header>

      {/* Desktop: who you are on the left, what the shelf says about you on
          the right. Phone: the same order, stacked. */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
      <div>
      <div className="flex items-center gap-3 pb-1">
        <span className="grid h-[52px] w-[52px] place-items-center rounded-[3px] bg-gradient-to-br from-shell to-shell-dark font-display text-[26px] font-extrabold text-ink">
          K
        </span>
        <div>
          <b className="block font-display text-[26px] font-extrabold uppercase leading-none">
            Karim
          </b>
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-soft">
            {isSample ? "Sample shelf" : `${library.length} carts`}
          </span>
        </div>
      </div>

      <p className="rule">The numbers</p>
      <div className="grid grid-cols-3 border border-line">
        <Stat value={String(stats.total)} label="Carts" />
        <Stat value={`${stats.totalHours}h`} label="Played" />
        <Stat value={`${sealed}%`} label="Sealed" warn />
      </div>

      {isSample && (
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.08em] text-[#6a5c52]">
          These are sample numbers ·{" "}
          <Link href="/connect" className="text-ink-soft hover:text-label">
            connect your Steam
          </Link>
        </p>
      )}

      <div className="mt-6 flex items-baseline justify-between">
        <p className="rule mb-0 flex-1">Your taste</p>
        <span
          className={`ml-3 font-mono text-[9px] uppercase tracking-[0.1em] text-contacts transition-opacity ${
            savedFlash ? "opacity-100" : "opacity-0"
          }`}
        >
          Saved
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {GENRE_OPTIONS.map((g) => {
          const active = genres.includes(g);
          return (
            <button
              key={g}
              aria-pressed={active}
              onClick={() =>
                persist(active ? genres.filter((x) => x !== g) : [...genres, g])
              }
              className={`min-h-9 rounded-[2px] border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-[var(--fast)] ${
                active
                  ? "border-label bg-label text-ink"
                  : "border-line text-ink-soft hover:border-[#4d3f36] hover:text-label"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>

      </div>

      <div className="mt-8 lg:mt-0">
      {stats.total > 0 && <BacklogRoast stats={stats} />}

      {hidden.length > 0 && (
        <>
          <p className="rule mt-6">Never suggest</p>
          <div className="grid gap-2">
            {hidden.map((g) => (
              <div
                key={g.appid}
                className="flex items-center gap-3 border border-line-soft p-2"
              >
                <div className="relative aspect-[3/4] w-8 shrink-0 overflow-hidden rounded-[2px] bg-[#2a221d]">
                  <CoverArt appid={g.appid} name={g.name} sizes="32px" />
                </div>
                <span className="min-w-0 flex-1 truncate font-display text-[16px] font-bold uppercase leading-none">
                  {g.name}
                </span>
                <button
                  onClick={() => setBlacklist(removeFromBlacklist(g.appid))}
                  className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:text-label"
                >
                  Put back
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <TrophyCase />
      </div>
      </div>
    </>
  );
}

function Stat({
  value,
  label,
  warn = false,
}: {
  value: string;
  label: string;
  warn?: boolean;
}) {
  return (
    <div className="border-r border-line px-3 py-3.5 last:border-r-0">
      <b
        className={`block font-display text-[30px] font-extrabold leading-[0.9] ${
          warn ? "text-challenge" : ""
        }`}
      >
        {value}
      </b>
      <span className="mt-1.5 block font-mono text-[8px] uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="pt-[18px]">
      <div className="sweep h-8 w-40 bg-plank" />
      <div className="sweep mt-5 h-[52px] w-full bg-plank" />
      <div className="sweep mt-5 h-20 w-full bg-plank" />
      <div className="sweep mt-5 h-40 w-full bg-plank" />
    </div>
  );
}
