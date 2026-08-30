"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { searchGamesToAdd } from "@/app/connect/actions";
import { CoverArt } from "@/components/cover-art";
import type { StoreHit } from "@/lib/steam";
import { addGameToLibrary, type StoredGame } from "@/lib/library";
import { useI18n } from "@/i18n/context";

export function AddGames({ seed }: { seed: StoredGame[] }) {
  const { d } = useI18n();
  const [library, setLibrary] = useState<StoredGame[]>(seed);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<StoreHit[]>([]);
  const [searching, startSearch] = useTransition();
  const t = d.connect.add;

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
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3 p-5">
        <h3 className="poster text-[1.05rem]">{t.title}</h3>
        <p className="text-[14px] leading-relaxed text-muted">{t.line}</p>

        <input
          type="search"
          value={term}
          onChange={(e) => runSearch(e.target.value)}
          placeholder={t.placeholder}
          className="w-full"
        />

        {searching && (
          <p className="mono text-[10px] uppercase tracking-[0.1em] text-subtle">
            {t.searching}
          </p>
        )}

        {results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {results.map((g) => {
              const added = ownedIds.has(g.appid);
              return (
                <li
                  key={g.appid}
                  className="flex items-center gap-3 rounded-btn border border-line p-2"
                >
                  <span className="relative block aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-btn">
                    <CoverArt appid={g.appid} name={g.name} sizes="36px" />
                  </span>
                  <span className="poster min-w-0 flex-1 truncate text-[14px]">
                    {g.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLibrary(addGameToLibrary(g))}
                    disabled={added}
                    className={`mono shrink-0 rounded-btn border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] transition-colors ${
                      added
                        ? "cursor-default border-accent-line text-accent-soft"
                        : "border-line text-subtle hover:border-line-strong hover:text-fg"
                    }`}
                  >
                    {added ? t.added : t.addIt}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="mono text-[10px] uppercase tracking-[0.1em] text-subtle">
          {t.count(library.length)}
          {addedCount > 0 && ` · ${t.countAdded(addedCount)}`}
        </p>
        <Link href="/play" className="btn btn-primary !min-h-10 text-[12.5px]">
          {t.cta} <span className="arrow">→</span>
        </Link>
      </div>
    </div>
  );
}
