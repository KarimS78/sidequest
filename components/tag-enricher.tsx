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
      <p className="border border-contacts/40 bg-contacts/10 p-2.5 font-mono text-[10px] uppercase leading-relaxed tracking-[0.08em] text-contacts">
        Tags read — the deck now scores on genre and vibe, not just playtime
      </p>
    );
  }

  if (!missing.length) return null;

  const pct = missing.length ? Math.round((done / missing.length) * 100) : 0;

  return (
    <div className="border border-line p-3.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
        Label data
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-[#cfc4b8]">
        SideQuest scores your games on their community tags — genre, pace, vibe.{" "}
        <b className="text-label">{missing.length}</b>{" "}
        {missing.length === 1 ? "cart is" : "carts are"} missing theirs.
      </p>

      {running ? (
        <div className="mt-3.5">
          <div className="h-1.5 w-full overflow-hidden rounded-[1px] bg-plank">
            <div
              className="h-full bg-contacts transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-soft">
            {done} / {missing.length} · throttled public API, a few seconds each
          </p>
        </div>
      ) : (
        <button
          onClick={run}
          className="mt-3.5 rounded-[2px] border border-contacts px-3.5 py-2 font-display text-[15px] font-bold uppercase tracking-[0.04em] text-contacts transition-colors hover:bg-contacts hover:text-ink"
        >
          Read {missing.length} {missing.length === 1 ? "label" : "labels"}
        </button>
      )}
    </div>
  );
}
