"use client";

import { useCallback, useEffect, useState } from "react";
import { enrichTags } from "@/app/connect/actions";
import { applyTags, loadLibrary, untaggedAppids } from "@/lib/library";

/** Games per server round-trip — ~250ms each, so a chunk takes ~4s. */
const CHUNK = 15;

/**
 * Fetches the community tags the picker scores on. Self-hides when every game
 * already has tags, so it doubles as the re-sync affordance for libraries
 * imported before tags existed.
 *
 * `version` bumps whenever the caller rewrites the stored library (a fresh
 * import), which re-reads what still needs enriching.
 */
export function TagEnricher({ version = 0 }: { version?: number }) {
  const [missing, setMissing] = useState<number[]>([]);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const refresh = useCallback(() => {
    const lib = loadLibrary();
    setMissing(lib ? untaggedAppids(lib) : []);
  }, []);

  useEffect(() => {
    refresh();
    setFinished(false);
    setDone(0);
  }, [refresh, version]);

  async function run() {
    setRunning(true);
    setDone(0);
    let processed = 0;
    for (let i = 0; i < missing.length; i += CHUNK) {
      const chunk = missing.slice(i, i + CHUNK);
      try {
        applyTags(await enrichTags(chunk));
      } catch {
        // A failed chunk just stays untagged — those games keep scoring on
        // playtime signals, and the button comes back for another pass.
      }
      processed += chunk.length;
      setDone(processed);
    }
    setRunning(false);
    setFinished(true);
    refresh();
  }

  if (finished && !missing.length) {
    return (
      <div className="rounded-xl border border-green/30 bg-green/5 px-4 py-2.5 text-xs text-green">
        Tags fetched — the picker now scores on genre and vibe, not just
        playtime.
      </div>
    );
  }

  if (!missing.length) return null;

  const pct = missing.length ? Math.round((done / missing.length) * 100) : 0;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold tracking-tight">
        Fetch game tags
      </h3>
      <p className="mt-1 text-sm text-muted">
        SideQuest scores your games on their community tags — genre, pace, vibe.
        {" "}
        <strong>{missing.length}</strong>{" "}
        {missing.length === 1 ? "game is" : "games are"} missing theirs.
      </p>

      {running ? (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-xs text-subtle">
            {done} / {missing.length} · this takes a few seconds per game, it&apos;s
            a throttled public API.
          </p>
        </div>
      ) : (
        <button
          onClick={run}
          className="mt-4 rounded-lg border border-accent bg-accent-dim px-3.5 py-2 text-sm font-medium text-accent-soft transition-colors hover:bg-accent/20"
        >
          🏷️ Fetch tags for {missing.length}{" "}
          {missing.length === 1 ? "game" : "games"}
        </button>
      )}
    </div>
  );
}
