"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { searchGamesToAdd } from "@/app/connect/actions";
import type { StoreHit } from "@/lib/steam";
import { addGameToLibrary, type StoredGame } from "@/lib/library";

export function AddGames({ seed }: { seed: StoredGame[] }) {
  const [library, setLibrary] = useState<StoredGame[]>(seed);

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<StoreHit[]>([]);
  const [searching, startSearch] = useTransition();

  const ownedIds = useMemo(
    () => new Set(library.map((g) => g.appid)),
    [library]
  );

  function add(game: { appid: number; name: string; coverUrl: string }) {
    setLibrary(addGameToLibrary(game));
  }

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
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-base font-semibold">Round out your library</h2>
        <p className="mt-1 text-sm text-muted">
          Steam isn&apos;t your whole gaming life — add games you also play on
          Epic, console, or just love. SideQuest factors them into what to play.
        </p>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-subtle">
            Add any game by name
          </p>
          <input
            value={term}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="Search a game — e.g. “God of War”, “Forza”…"
            className="w-full rounded-lg border border-border bg-elevated px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-subtle focus:border-accent"
          />
          {searching && (
            <p className="mt-2 text-xs text-subtle">Searching…</p>
          )}
          {results.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results.map((g) => (
                <GameRow
                  key={g.appid}
                  game={g}
                  added={ownedIds.has(g.appid)}
                  onAdd={() => add(g)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-elevated p-4">
        <p className="text-sm text-muted">
          {library.length} games
          {addedCount > 0 && (
            <span className="text-subtle"> · {addedCount} added by you</span>
          )}
        </p>
        <Link
          href="/play"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-[0_0_24px_rgba(124,92,255,0.4)] transition-transform hover:-translate-y-0.5"
        >
          Get a recommendation →
        </Link>
      </div>
    </div>
  );
}

function GameRow({
  game,
  added,
  onAdd,
}: {
  game: StoreHit;
  added: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-elevated">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.coverUrl}
          alt={game.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{game.name}</p>
      </div>
      <button
        onClick={onAdd}
        disabled={added}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          added
            ? "cursor-default border border-green/30 bg-green/10 text-green"
            : "border border-border bg-elevated text-foreground hover:border-accent hover:text-accent-soft"
        }`}
      >
        {added ? "Added ✓" : "+ Add"}
      </button>
    </div>
  );
}
