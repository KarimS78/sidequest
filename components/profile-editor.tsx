"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TrophyCase } from "@/components/eggs";
import {
  computeBacklogStats,
  GENRE_OPTIONS,
  headerFor,
  loadBlacklist,
  loadLibrary,
  loadProfile,
  removeFromBlacklist,
  SAMPLE_LIBRARY,
  saveProfile,
  type StoredGame,
} from "@/lib/library";
import { BacklogRoast } from "@/components/roast";
import { ShelfPortrait } from "@/components/portrait";
import { AiStatusPanel } from "@/components/ai-status";
import { useI18n } from "@/i18n/context";

/**
 * The profile.
 *
 * Rebuilt because the old one was unreadable, and the reason it was unreadable
 * was not styling: it was seven blocks of equal weight with no statement about
 * what any of them were for. A stat tile, a genre picker, a token gauge and a
 * list of locked trophies all looked like the same kind of thing.
 *
 * So the page now makes one claim and sorts everything under it. There are two
 * kinds of thing here: what the app WORKED OUT about you from your shelf, and
 * what you TELL it. Each gets a heading that says so. The AI gauge belongs to
 * neither, so it sits last, on its own, as machine housekeeping.
 */
export function ProfileEditor() {
  const { d } = useI18n();
  const [genres, setGenres] = useState<string[]>([]);
  const [library, setLibrary] = useState<StoredGame[] | null>(null);
  const [blacklist, setBlacklist] = useState<number[]>([]);
  const [isSample, setIsSample] = useState(true);
  const [savedFlash, setSavedFlash] = useState(false);
  const t = d.profile;

  useEffect(() => {
    const lib = loadLibrary();
    setGenres(loadProfile().favoriteGenres);
    // Same fallback as the draw and the shelf: without it a first-time visitor
    // sees zeroed stats here while every other screen shows the demo shelf.
    setLibrary(lib ?? SAMPLE_LIBRARY);
    setIsSample(!lib);
    setBlacklist(loadBlacklist());
  }, []);

  function persist(next: string[]) {
    setGenres(next);
    saveProfile({ favoriteGenres: next });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1400);
  }

  if (library === null) return <ProfileSkeleton />;

  const stats = computeBacklogStats(library);
  const sealed = stats.total ? Math.round((stats.neverPlayed / stats.total) * 100) : 0;
  const blacklistSet = new Set(blacklist);
  const hidden = library.filter((g) => blacklistSet.has(g.appid));

  return (
    <div className="wrap has-tabs flex flex-col gap-12 py-8 lg:gap-16 lg:py-12">
      {/* ================= who ================= */}
      <header className="flex flex-col gap-4">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1 className="poster text-[clamp(2.2rem,6vw,3.6rem)]">{t.title}</h1>
        <p className="max-w-xl text-[15.5px] leading-relaxed text-muted">{t.lede}</p>

        <dl className="mt-2 grid gap-3 sm:grid-cols-3">
          <Stat value={String(stats.total)} label={t.numbers.total} />
          <Stat value={`${stats.totalHours}`} label={t.numbers.hours} />
          <Stat value={`${sealed}%`} label={t.numbers.sealed} />
        </dl>

        {isSample && (
          <p className="mono text-[10.5px] uppercase tracking-[0.1em] text-subtle">
            {t.sampleNote}{" "}
            <Link href="/connect" className="text-accent-soft hover:text-fg">
              {t.sampleCta} →
            </Link>
          </p>
        )}
      </header>

      {/* ================= what it makes of you ================= */}
      {stats.total > 0 && (
        <section className="flex flex-col gap-5">
          <SectionHead title={t.readings.title} lede={t.readings.lede} />
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <ShelfPortrait library={library} stats={stats} stated={genres} />
            <BacklogRoast stats={stats} />
          </div>
        </section>
      )}

      {/* ================= what you tell it ================= */}
      <section className="flex flex-col gap-5">
        <SectionHead title={t.settings.title} lede={t.settings.lede} />

        <div className="card p-5 lg:p-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="poster text-[1.05rem]">{t.taste.title}</h3>
            <span
              className={`mono text-[10px] uppercase tracking-[0.12em] text-accent-soft transition-opacity duration-[var(--t-base)] ${
                savedFlash ? "opacity-100" : "opacity-0"
              }`}
            >
              {t.taste.saved}
            </span>
          </div>
          <p className="mt-1.5 max-w-prose text-[14px] leading-relaxed text-muted">
            {t.taste.line}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((g) => {
              const active = genres.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    persist(active ? genres.filter((x) => x !== g) : [...genres, g])
                  }
                  className="chip !min-h-9 text-[13px]"
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card p-5 lg:p-6">
          <h3 className="poster text-[1.05rem]">{t.hidden.title}</h3>
          {hidden.length === 0 ? (
            <p className="mt-2 text-[14px] text-muted">{t.hidden.empty}</p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {hidden.map((g) => (
                <li key={g.appid} className="tile flex items-center gap-3 pr-3">
                  <span className="relative h-[52px] w-[112px] shrink-0 overflow-hidden">
                    <Image
                      src={headerFor(g.appid)}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-cover opacity-55"
                    />
                  </span>
                  <span className="poster min-w-0 flex-1 truncate text-[14px] text-muted">
                    {g.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBlacklist(removeFromBlacklist(g.appid))}
                    className="mono shrink-0 text-[10px] uppercase tracking-[0.1em] text-subtle transition-colors hover:text-fg"
                  >
                    {t.hidden.restore}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ================= housekeeping ================= */}
      <section className="flex flex-col gap-4">
        <AiStatusPanel />
        <TrophyCase />
      </section>
    </div>
  );
}

function SectionHead({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-6">
      <h2 className="poster text-[clamp(1.4rem,3vw,1.9rem)]">{title}</h2>
      <p className="max-w-2xl text-[14.5px] leading-relaxed text-muted">{lede}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-quiet p-4">
      <dt className="mono text-[10px] uppercase tracking-[0.12em] text-subtle">
        {label}
      </dt>
      <dd className="mono mt-1.5 text-[2rem] leading-none">{value}</dd>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="wrap has-tabs flex flex-col gap-6 py-8">
      <div className="card h-24 animate-pulse" />
      <div className="card h-40 animate-pulse" />
      <div className="card h-64 animate-pulse" />
    </div>
  );
}
