"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CoverArt } from "@/components/cover-art";
import { searchShelf } from "@/app/dashboard/actions";
import { loadLibrary, SAMPLE_LIBRARY, untaggedAppids, type StoredGame } from "@/lib/library";
import { matchesAnyTag, SESSION_TAGS } from "@/lib/recommend";
import type { AiFilter } from "@/lib/ai";
import { deviceId } from "@/lib/device";
import { unlock } from "@/lib/eggs";
import { useI18n } from "@/i18n/context";

type Sort = "playtime" | "name";

/** Two covers wide on a phone, up to six on a desk. */
const GRID_SIZES = "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 190px";

/** Two searches that are not searches. */
const SEARCH_EGGS: { test: RegExp; id: "cake" | "halflife" }[] = [
  { test: /^(cake|g[âa]teau)$/i, id: "cake" },
  { test: /^(half.?life ?3|hl3|portal ?3)$/i, id: "halflife" },
];

/**
 * The shelf's own tag vocabulary, most common first.
 *
 * This is the only thing about the library that ever leaves the browser for a
 * search: the words, not the games. The model answers with a filter over these
 * words and the filtering happens here, which is why a 900-game account costs
 * exactly the same prompt as the ten-game demo.
 */
function vocabularyOf(library: StoredGame[]): string[] {
  const counts = new Map<string, number>();
  for (const g of library) {
    for (const t of g.tags ?? []) {
      const tag = t.trim();
      if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

/**
 * Apply what the model asked for — by score, not by a chain of ANDs.
 *
 * The first version ANDed every clause together and dropped them in order when
 * the result came back empty. It was wrong in both directions, and the first
 * live call showed it: asked for "something short I don't have to think about",
 * the model returned the tags Casual/Relaxing but also Open World/Story Rich,
 * the AND found nothing, the relax dropped the session fit first — and the
 * shelf answered with Baldur's Gate 3 and Red Dead 2. The exact opposite.
 *
 * So the two kinds of clause are treated as what they are:
 *
 *   HARD — unplayedOnly and maxHours. Unambiguous, checkable, and if the player
 *          asked for something they haven't launched, showing one they have is
 *          not a looser answer, it is a wrong one.
 *   SOFT — the session fit and the tags. Both are guesses about meaning, so
 *          they RANK rather than exclude. A game answering the session fit
 *          outscores one carrying a single vague tag, which is what puts Hades
 *          above Elden Ring for "short" without needing Hades to be tagged
 *          Casual.
 *
 * Nothing scoring at all is the only case that reports as relaxed.
 */
function applyFilter(
  list: StoredGame[],
  f: AiFilter
): { games: StoredGame[]; relaxed: boolean } {
  const hard = list.filter(
    (g) =>
      (!f.unplayedOnly || (g.playtimeMin ?? 0) === 0) &&
      (f.maxHours <= 0 || (g.playtimeMin ?? 0) / 60 <= f.maxHours)
  );

  const fit = f.sessionFit;
  const score = (g: StoredGame) => {
    const tags = g.tags ?? [];
    // Every tag counts separately: three matches is a better answer than one.
    const onTags = f.tags.filter((t) => matchesAnyTag(tags, [t])).length;
    // Worth two tags. The player said "short"; the engine's own idea of short
    // is a stronger signal than a community tag the model reached for.
    const onFit = fit !== "any" && matchesAnyTag(tags, [...SESSION_TAGS[fit]]) ? 2 : 0;
    return onTags + onFit;
  };

  // No soft clause at all — the hard filter IS the answer.
  if (!f.tags.length && fit === "any") return { games: hard, relaxed: false };

  const scored = hard
    .map((g) => ({ g, s: score(g) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (scored.length) return { games: scored.map((x) => x.g), relaxed: false };
  return { games: hard, relaxed: hard.length > 0 };
}

export function LibraryView() {
  const { d, locale } = useI18n();
  const [library, setLibrary] = useState<StoredGame[] | null>(null);
  const [isSample, setIsSample] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("playtime");

  // The AI filter is a separate axis from the name search: one narrows by what
  // a game IS, the other by what it is CALLED, and they stack.
  const [filter, setFilter] = useState<AiFilter | null>(null);
  const [asking, setAsking] = useState(false);
  const [askNote, setAskNote] = useState<string | null>(null);
  const t = d.shelf;

  useEffect(() => {
    const lib = loadLibrary();
    setLibrary(lib ?? SAMPLE_LIBRARY);
    setIsSample(!lib);
  }, []);

  // A filter read in the other language shows a `say` line nobody can read.
  useEffect(() => {
    setFilter(null);
    setAskNote(null);
  }, [locale]);

  // Type the name of something that was never on a shelf.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const hit = SEARCH_EGGS.find((e) => e.test.test(q));
    if (hit) unlock(hit.id);
  }, [query]);

  const result = useMemo(() => {
    if (!library) return { games: [] as StoredGame[], relaxed: false };

    const scoped = filter ? applyFilter(library, filter) : { games: library, relaxed: false };
    const q = query.trim().toLowerCase();
    // With a filter up, the typed text stops being the search and becomes the
    // question the filter was built from — so it only matches names when there
    // is no filter.
    const list =
      q && !filter
        ? scoped.games.filter((g) => g.name.toLowerCase().includes(q))
        : [...scoped.games];

    // With a filter up, applyFilter has already ordered by how well each game
    // answers the question. Re-sorting by playtime here would throw that away
    // and put the 103-hour RPG first again, which is the thing the ranking
    // exists to prevent.
    if (!filter) {
      list.sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name) : b.playtimeMin - a.playtimeMin
      );
    }
    return { games: list, relaxed: scoped.relaxed };
  }, [library, query, sort, filter]);

  async function ask() {
    if (!library || asking) return;
    const q = query.trim();
    if (q.length < 3) {
      setAskNote(t.search.tooShort);
      return;
    }

    setAsking(true);
    setAskNote(null);
    try {
      const res = await searchShelf({
        deviceId: deviceId(),
        query: q,
        vocabulary: vocabularyOf(library),
        locale,
      });
      if (res.ok) {
        setFilter(res.filter);
      } else {
        // Never an error dialog: the shelf still searches by name, and the
        // panel says which of the two you are looking at.
        setFilter(null);
        setAskNote(t.filter.failed(res.reason));
      }
    } catch {
      setFilter(null);
      setAskNote(t.filter.failed("no answer"));
    } finally {
      setAsking(false);
    }
  }

  if (library === null) return <ShelfSkeleton />;

  if (library.length === 0) {
    return (
      <div className="wrap flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="poster text-[clamp(2rem,6vw,3rem)]">{t.empty.title}</h1>
        <p className="max-w-sm text-muted">{t.empty.line}</p>
        <Link href="/connect" className="btn btn-primary mt-2">
          {t.empty.cta} <span className="arrow">→</span>
        </Link>
      </div>
    );
  }

  const untagged = untaggedAppids(library).length;
  const games = result.games;

  return (
    <div className="wrap has-tabs flex flex-col gap-7 py-8 lg:py-12">
      {/* ================= header ================= */}
      <header className="flex flex-col gap-4">
        <span className="eyebrow">{t.eyebrow}</span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="poster text-[clamp(2.2rem,6vw,3.6rem)]">{t.title}</h1>
            <p className="mono mt-2 text-[10.5px] uppercase tracking-[0.12em] text-subtle">
              {t.count(library.length)}
              {untagged > 0 && ` · ${t.untagged(untagged)}`}
              {isSample && ` · ${t.demo}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/connect" className="btn btn-ghost !min-h-9 text-[12.5px]">
              {t.resync}
            </Link>
            <Link href="/connect" className="btn btn-quiet !min-h-9 text-[12.5px]">
              {t.add}
            </Link>
          </div>
        </div>
      </header>

      {/* ================= the two searches, told apart ================= */}
      <section className="card flex flex-col gap-3 p-4 lg:p-5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder={t.search.placeholder}
          className="w-full"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-[13.5px] leading-relaxed text-subtle">
            {t.search.or}
          </p>
          <button
            type="button"
            onClick={ask}
            disabled={asking || query.trim().length < 3}
            className="btn btn-primary !min-h-10 text-[12.5px]"
          >
            {asking ? `${t.search.asking}…` : t.search.ask}
            {!asking && <span className="arrow">→</span>}
          </button>
        </div>

        {askNote && (
          <p role="status" className="text-[13.5px] leading-relaxed text-muted">
            {askNote}
          </p>
        )}

        {/* What the model understood, in the model's own words plus the fields
            it actually set. This is the explainability: the filter is shown,
            never just applied. */}
        {filter && (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono text-[10px] uppercase tracking-[0.12em] text-accent-soft">
                {t.filter.title}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFilter(null);
                  setAskNote(null);
                  setQuery("");
                }}
                className="mono ml-auto text-[10px] uppercase tracking-[0.1em] text-subtle transition-colors hover:text-fg"
              >
                {t.filter.clear}
              </button>
            </div>

            {filter.say && <p className="text-[14.5px]">{filter.say}</p>}

            <div className="flex flex-wrap gap-1.5">
              {filter.tags.map((tag) => (
                <span key={tag} className="badge">
                  {tag}
                </span>
              ))}
              {filter.unplayedOnly && <span className="badge">{t.filter.unplayed}</span>}
              {filter.sessionFit !== "any" && (
                <span className="badge">{t.filter.session(filter.sessionFit)}</span>
              )}
            </div>

            {result.relaxed && (
              <p className="text-[13px] text-subtle">{t.filter.relaxed}</p>
            )}
          </div>
        )}
      </section>

      {/* ================= the shelf ================= */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-subtle">
            {t.results.count(games.length)}
          </span>
          {!filter && (
            <button
              type="button"
              onClick={() => setSort(sort === "playtime" ? "name" : "playtime")}
              className="mono text-[10.5px] uppercase tracking-[0.1em] text-subtle transition-colors hover:text-fg"
            >
              {t.sort.label} · {sort === "playtime" ? t.sort.playtime : t.sort.name}
            </button>
          )}
        </div>

        {games.length === 0 ? (
          <p className="py-12 text-center text-muted">{t.results.none}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6">
            {games.map((g, i) => {
              const hours = Math.round(g.playtimeMin / 60);
              return (
                <li key={g.appid} className="tile">
                  <span className="relative block aspect-[2/3] w-full">
                    <CoverArt
                      appid={g.appid}
                      name={g.name}
                      sizes={GRID_SIZES}
                      priority={i < 6}
                    />
                  </span>
                  <span className="flex items-baseline justify-between gap-2 px-2.5 py-2">
                    <span className="truncate text-[12.5px] text-muted">{g.name}</span>
                    <span className="mono shrink-0 text-[10px] text-subtle">
                      {hours > 0 ? t.hours(hours) : "—"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ShelfSkeleton() {
  return (
    <div className="wrap has-tabs flex flex-col gap-6 py-8">
      <div className="card h-28 animate-pulse" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="tile aspect-[2/3] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
