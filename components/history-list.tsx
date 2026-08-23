"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadHistory,
  markPlayed,
  clearHistory,
  type HistoryEntry,
} from "@/lib/history";

const TIME_LABEL: Record<string, string> = {
  short: "~30 min",
  medium: "1–2 hours",
  long: "All evening",
};

function timeAgo(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function HistoryList() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  function togglePlayed(e: HistoryEntry) {
    setEntries(markPlayed(e.id, !e.played));
  }

  function clearAll() {
    clearHistory();
    setEntries([]);
  }

  if (entries === null) return null; // avoid SSR/CSR flash

  const playedCount = entries.filter((e) => e.played).length;

  if (entries.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-muted">No recommendations yet.</p>
        <Link
          href="/play"
          className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-[0_0_24px_rgba(124,92,255,0.4)] transition-transform hover:-translate-y-0.5"
        >
          Get your first pick →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {entries.length} recommendation{entries.length > 1 ? "s" : ""}
          <span className="text-subtle"> · {playedCount} played</span>
        </p>
        <button
          onClick={clearAll}
          className="text-xs text-subtle transition-colors hover:text-amber"
        >
          Clear history
        </button>
      </div>

      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="card flex items-start gap-4 p-3">
            <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-elevated">
              {e.pick.coverUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={e.pick.coverUrl}
                  alt={e.pick.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{e.pick.name}</p>
              <p className="mt-0.5 text-xs text-subtle">
                {TIME_LABEL[e.time] ?? e.time} · {e.mood} · {timeAgo(e.at)}
              </p>
              {e.note?.lastTime && (
                <p className="mt-1.5 text-xs leading-5 text-muted">
                  {e.note.lastTime}
                </p>
              )}
              {e.alternatives.length > 0 && (
                <p className="mt-1 truncate text-xs text-muted">
                  Alt: {e.alternatives.map((a) => a.name).join(", ")}
                </p>
              )}
            </div>
            <button
              onClick={() => togglePlayed(e)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                e.played
                  ? "border border-green/30 bg-green/10 text-green"
                  : "border border-border bg-elevated text-muted hover:border-accent hover:text-accent-soft"
              }`}
            >
              {e.played ? "Played ✓" : "Mark played"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
