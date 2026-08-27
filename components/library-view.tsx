"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CoverArt } from "@/components/cover-art";
import { loadLibrary, SAMPLE_LIBRARY, untaggedAppids, type StoredGame } from "@/lib/library";
import { unlock } from "@/lib/eggs";

type Sort = "playtime" | "name";

/** Two carts wide on a phone, up to six on a desk. */
const GRID_SIZES = "(max-width: 448px) 45vw, (max-width: 1024px) 30vw, 190px";

/** Two searches that are not searches. */
const SEARCH_EGGS: { test: RegExp; id: "cake" | "halflife" }[] = [
  { test: /^cake$/i, id: "cake" },
  { test: /^(half.?life ?3|hl3|portal ?3)$/i, id: "halflife" },
];

export function LibraryView() {
  const [library, setLibrary] = useState<StoredGame[] | null>(null);
  const [isSample, setIsSample] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("playtime");

  useEffect(() => {
    const lib = loadLibrary();
    setLibrary(lib ?? SAMPLE_LIBRARY);
    setIsSample(!lib);
  }, []);

  // Type the name of something that was never on a shelf.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const hit = SEARCH_EGGS.find((e) => e.test.test(q));
    if (hit) unlock(hit.id);
  }, [query]);

  const filtered = useMemo(() => {
    if (!library) return [];
    const q = query.trim().toLowerCase();
    const list = q ? library.filter((g) => g.name.toLowerCase().includes(q)) : [...library];
    list.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : b.playtimeMin - a.playtimeMin
    );
    return list;
  }, [library, query, sort]);

  if (library === null) return <ShelfSkeleton />;

  if (library.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <span className="deck-slot w-28" />
        <h1 className="mt-5 font-display text-[30px] font-extrabold uppercase leading-none">
          No carts racked
        </h1>
        <p className="mt-2.5 max-w-[26ch] text-sm text-ink-soft">
          Import your Steam library and every game racks up here as a cart.
        </p>
        <Link
          href="/connect"
          className="switch mt-5 inline-flex h-[50px] w-auto items-center px-[22px] font-display text-[19px] font-extrabold uppercase tracking-[0.12em]"
        >
          Connect Steam
        </Link>
      </div>
    );
  }

  const untagged = untaggedAppids(library).length;

  return (
    <>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-2.5 bg-gradient-to-b from-ground from-[72%] to-transparent pb-3 pt-[18px] lg:static lg:pb-6 lg:pt-9">
        <div>
          <h1 className="font-display text-[30px] font-extrabold uppercase leading-none tracking-[0.02em] lg:text-[54px]">
            Shelf
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-soft">
            {library.length} racked
            {untagged > 0 && ` · ${untagged} untagged`}
            {isSample && " · demo"}
          </p>
        </div>
        <div className="flex gap-1.5 lg:max-w-xl">
          <Link
            href="/connect"
            aria-label="Re-sync your Steam library"
            title="Re-sync"
            className="key grid h-9 w-9 place-items-center text-ink-soft transition-colors hover:text-label"
          >
            <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 12a8 8 0 1 1-2.6-5.9" />
              <path d="M20 4v4h-4" />
            </svg>
          </Link>
          <Link
            href="/connect"
            aria-label="Add a game by name"
            title="Add a game"
            className="key grid h-9 w-9 place-items-center text-ink-soft transition-colors hover:text-label"
          >
            <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the shelf…"
          className="min-h-11 flex-1 rounded-[2px] border border-line bg-[#0b1013] px-3 text-[13px] text-label shadow-[inset_0_2px_4px_rgba(0,0,0,.6)] outline-none transition-colors placeholder:text-[#5b6a72] focus:border-contacts"
        />
        <button
          onClick={() => setSort(sort === "playtime" ? "name" : "playtime")}
          className="key min-h-11 shrink-0 px-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-label"
        >
          {sort === "playtime" ? "Most played" : "A–Z"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
          Nothing matches “{query}”
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mt-6 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6">
          {filtered.map((g, i) => (
            <a
              key={g.appid}
              href={`https://store.steampowered.com/app/${g.appid}`}
              target="_blank"
              rel="noreferrer"
              className={`cart block !p-[7px] !pb-0 !rounded-[7px_7px_2px_2px] transition-transform duration-[var(--fast)] hover:-translate-y-1 ${
                i % 3 === 1 ? "cart-cream" : ""
              }`}
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-[2px] border border-black/25 bg-paper">
                <CoverArt appid={g.appid} name={g.name} sizes={GRID_SIZES} priority={i < 6} />
              </div>
              <div className="flex items-baseline justify-between gap-1.5 px-px pb-[7px] pt-[5px] text-label">
                <b className="truncate font-display text-[14px] font-bold uppercase leading-none">
                  {g.name}
                </b>
                <span className="shrink-0 font-mono text-[9px] text-ink-soft">
                  {g.playtimeMin > 0 ? `${Math.round(g.playtimeMin / 60)}H` : "NEW"}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function ShelfSkeleton() {
  return (
    <div className="pt-[18px]">
      <div className="sweep h-8 w-32 bg-plank" />
      <div className="sweep mt-4 h-11 w-full bg-plank" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="cart !p-[7px] !pb-0 !rounded-[7px_7px_2px_2px]">
            <div className="sweep aspect-[3/4] rounded-[2px] bg-paper" />
            <div className="h-[26px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
