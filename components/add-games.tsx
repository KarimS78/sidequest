"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { searchGamesToAdd } from "@/app/connect/actions";
import { CoverArt } from "@/components/cover-art";
import type { StoreHit } from "@/lib/steam";
import { addGameToLibrary, type StoredGame } from "@/lib/library";

export function AddGames({ seed }: { seed: StoredGame[] }) {
  const [library, setLibrary] = useState<StoredGame[]>(seed);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<StoreHit[]>([]);
  const [searching, startSearch] = useTransition();

  const ownedIds = useMemo(() => new Set(library.map((g) => g.appid)), [library]);

  function runSearch(q: string) {
    setTerm(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const res = await searchGamesToAdd(q);
      setResults(res.games);
    });
  }

  const addedCount = library.filter((g) => g.added).length;

  return (
    <div className="space-y-4">
      <div className="border border-line p-3.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
          Rack another
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-[#b3c0c7]">
          Steam isn&apos;t your whole shelf. Add what you play on Epic, on a
          console, or just love — the deck picks from those too.
        </p>

        <input
          value={term}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Search a game — “God of War”, “Forza”…"
          className="mt-3 min-h-11 w-full rounded-[2px] border border-line bg-transparent px-3 text-[13px] text-label outline-none transition-colors placeholder:text-[#5b6a72] focus:border-contacts"
        />

        {searching && (
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft">
            Searching…
          </p>
        )}

        {results.length > 0 && (
          <div className="mt-3 grid gap-2">
            {results.map((g) => {
              const added = ownedIds.has(g.appid);
              return (
                <div
                  key={g.appid}
                  className="flex items-center gap-3 border border-line-soft p-2"
                >
                  <div className="relative aspect-[3/4] w-9 shrink-0 overflow-hidden rounded-[2px] bg-[#10161a]">
                    <CoverArt appid={g.appid} name={g.name} sizes="36px" />
                  </div>
                  <span className="min-w-0 flex-1 truncate font-display text-[16px] font-bold uppercase leading-none">
                    {g.name}
                  </span>
                  <button
                    onClick={() => setLibrary(addGameToLibrary(g))}
                    disabled={added}
                    className={`shrink-0 rounded-[2px] border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                      added
                        ? "cursor-default border-contacts/40 text-contacts"
                        : "border-line text-ink-soft hover:border-label hover:text-label"
                    }`}
                  >
                    {added ? "Racked" : "Rack it"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border border-line p-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-soft">
          {library.length} carts
          {addedCount > 0 && ` · ${addedCount} added by you`}
        </p>
        <Link
          href="/play"
          className="switch w-auto px-3.5 py-2 font-display text-[15px] font-extrabold uppercase tracking-[0.1em]"
        >
          Pull one
        </Link>
      </div>
    </div>
  );
}
