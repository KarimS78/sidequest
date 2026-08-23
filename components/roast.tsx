"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  computeBacklogStats,
  loadLibrary,
  SAMPLE_LIBRARY,
  type BacklogStats,
  type StoredGame,
} from "@/lib/library";
import { roastBacklog, type Roast } from "@/lib/roast";
import { getAiRoast } from "@/app/roast/actions";
import { deviceId } from "@/lib/device";

/** The templates are instant; the pause is what sells "sharpening". */
const SHARPEN_MS = 450;

export function BacklogRoast() {
  const [library, setLibrary] = useState<StoredGame[]>([]);
  const [isSample, setIsSample] = useState(true);
  const [stats, setStats] = useState<BacklogStats | null>(null);

  const [roast, setRoast] = useState<Roast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  useEffect(() => {
    const lib = loadLibrary();
    const resolved = lib ?? SAMPLE_LIBRARY;
    setLibrary(resolved);
    setIsSample(!lib);
    setStats(computeBacklogStats(resolved));
  }, []);

  function run() {
    if (!stats) return;
    setError(null);
    setPending(true);

    // Templates first, so there is always something to show. The model gets to
    // beat them if it answers in time; if it doesn't, nobody notices.
    const local = roastBacklog(stats);
    const ai = getAiRoast({ deviceId: deviceId(), stats })
      .then((r) => (r.ok ? r.roast : null))
      .catch(() => null);

    const waited = new Promise<void>((resolve) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(resolve, SHARPEN_MS);
    });

    Promise.all([waited, ai]).then(([, generated]) => {
      setPending(false);
      if (generated) setRoast(generated);
      else if (local.ok) setRoast(local.roast);
      else setError(local.error);
    });
  }

  if (!stats) return null;

  const pctUnplayed = stats.total
    ? Math.round((stats.neverPlayed / stats.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Roast my backlog
        </h1>
        <p className="mt-1 text-sm text-muted">
          Brace yourself. Your {isSample ? "(sample) " : ""}numbers are about to
          say the quiet part out loud.
        </p>
        <p className="mt-2 font-mono text-xs text-subtle">
          {isSample ? (
            <>
              Using a sample library ·{" "}
              <Link href="/connect" className="text-accent-soft hover:underline">
                roast your real one
              </Link>
            </>
          ) : (
            <>Analysing your {stats.total} games</>
          )}
        </p>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={String(stats.total)} label="Games owned" />
          <Stat value={String(stats.played)} label="Actually played" />
          <Stat value={`${pctUnplayed}%`} label="Never launched" accent />
          <Stat value={`${stats.totalHours}h`} label="Total hours" />
        </section>

        <button
          onClick={run}
          disabled={pending}
          className="mt-6 w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(124,92,255,0.4)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {pending ? "Sharpening jokes…" : roast ? "Roast me again 🔥" : "Roast me 🔥"}
        </button>
      </div>

      {error && (
        <div className="card border-amber/30 bg-amber/5 p-4 text-sm text-amber">
          {error}
        </div>
      )}

      {roast && (
        <div className="card glow-border space-y-4 p-6">
          <p className="text-lg font-semibold leading-snug">
            “{roast.verdict}”
          </p>
          <ul className="space-y-2.5">
            {roast.lines.map((line, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-6 text-muted">
                <span className="text-accent-soft">🔥</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-border pt-4 text-sm italic text-subtle">
            {roast.redemption}
          </p>
          <div className="flex justify-end">
            <Link
              href="/play"
              className="text-xs text-accent-soft hover:underline"
            >
              Okay okay — just tell me what to play →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p
        className={`font-mono text-2xl font-semibold tracking-tight ${
          accent ? "text-accent-soft" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-subtle">{label}</p>
    </div>
  );
}
