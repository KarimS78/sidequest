"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/context";
import { enrichTags } from "@/app/connect/actions";
import { applyTags, loadLibrary, untaggedAppids } from "@/lib/library";

/** Games per server round-trip — four in flight at a time, ~2s a chunk. */
const CHUNK = 12;

/**
 * Fetches the community tags the picker scores on. Self-hides when every game
 * already has tags, so it doubles as the re-sync affordance for libraries
 * imported before tags existed.
 *
 * `version` bumps whenever the caller rewrites the stored library (a fresh
 * import), which re-reads what still needs enriching.
 */
export function TagEnricher({
  version = 0,
  onDone,
}: {
  version?: number;
  /** Called once the pass ends, so a screen holding the library can reload it. */
  onDone?: () => void;
}) {
  const { d } = useI18n();
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
    onDone?.();
  }

  const t = d.connect.tags;

  if (finished && !missing.length) {
    return (
      <p className="mono rounded-card border border-accent-line bg-accent-dim p-3 text-[10.5px] uppercase leading-relaxed tracking-[0.08em] text-accent-soft">
        {t.done}
      </p>
    );
  }

  if (!missing.length) return null;

  const pct = missing.length ? Math.round((done / missing.length) * 100) : 0;

  return (
    <div className="card p-5">
      <h3 className="poster text-[1.05rem]">{t.title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        {t.line(missing.length)}
      </p>

      {running ? (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-[var(--t-base)] [transition-timing-function:var(--ease-out-quest)]"
              style={{ transform: `scaleX(${pct / 100})` }}
            />
          </div>
          <p className="mono mt-2 text-[10px] uppercase tracking-[0.08em] text-subtle">
            {done} / {missing.length} · {t.progress}
          </p>
        </div>
      ) : (
        <button type="button" onClick={run} className="btn btn-ghost mt-4">
          {t.read(missing.length)}
        </button>
      )}
    </div>
  );
}
