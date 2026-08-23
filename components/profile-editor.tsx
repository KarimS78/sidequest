"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GENRE_OPTIONS,
  loadLibrary,
  loadProfile,
  saveProfile,
  loadBlacklist,
  removeFromBlacklist,
  type StoredGame,
} from "@/lib/library";

export function ProfileEditor() {
  const [genres, setGenres] = useState<string[]>([]);
  const [library, setLibrary] = useState<StoredGame[]>([]);
  const [blacklist, setBlacklist] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setGenres(loadProfile().favoriteGenres);
    setLibrary(loadLibrary() ?? []);
    setBlacklist(loadBlacklist());
    setLoaded(true);
  }, []);

  function unhide(appid: number) {
    setBlacklist(removeFromBlacklist(appid));
  }

  function persist(next: string[]) {
    setGenres(next);
    saveProfile({ favoriteGenres: next });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  }

  function toggle(genre: string) {
    persist(
      genres.includes(genre)
        ? genres.filter((g) => g !== genre)
        : [...genres, genre]
    );
  }

  if (!loaded) return null;

  const totalHours = Math.round(
    library.reduce((s, g) => s + g.playtimeMin, 0) / 60
  );
  const addedCount = library.filter((g) => g.added).length;
  const blacklistSet = new Set(blacklist);
  const hiddenGames = library.filter((g) => blacklistSet.has(g.appid));

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Games in library" value={String(library.length)} />
        <Stat label="Hours played" value={`${totalHours}h`} />
        <Stat label="Added by you" value={String(addedCount)} />
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Your taste</h2>
            <p className="mt-1 text-sm text-muted">
              Pick the genres you enjoy — SideQuest weighs them when choosing what
              to play.
            </p>
          </div>
          <span
            className={`text-xs text-green transition-opacity ${
              savedFlash ? "opacity-100" : "opacity-0"
            }`}
          >
            Saved ✓
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {GENRE_OPTIONS.map((g) => {
            const active = genres.includes(g);
            return (
              <button
                key={g}
                onClick={() => toggle(g)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-accent bg-accent-dim text-accent-soft"
                    : "border-border bg-elevated text-muted hover:border-border-strong"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>

        {library.length === 0 && (
          <p className="mt-5 text-sm text-subtle">
            No library yet —{" "}
            <Link href="/connect" className="text-accent-soft hover:underline">
              connect your Steam
            </Link>{" "}
            to get personalised picks.
          </p>
        )}
      </section>

      {hiddenGames.length > 0 && (
        <section className="card p-6">
          <h2 className="text-base font-semibold">Hidden games</h2>
          <p className="mt-1 text-sm text-muted">
            These never show up in the picker. Un-hide one to let it back in.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {hiddenGames.map((g) => (
              <button
                key={g.appid}
                onClick={() => unhide(g.appid)}
                className="group flex items-center gap-2 rounded-full border border-border bg-elevated py-1 pl-1 pr-3 text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.coverUrl}
                  alt=""
                  className="h-6 w-11 rounded object-cover"
                />
                <span className="max-w-[12rem] truncate">{g.name}</span>
                <span className="text-xs text-subtle group-hover:text-accent-soft">
                  Un-hide
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="font-mono text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-subtle">{label}</p>
    </div>
  );
}
