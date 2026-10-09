// Recommendation history (V1, local-first — same swap-to-Supabase contract as
// lib/library.ts: keep all reads/writes behind these helpers).

import type { PickerTime } from "@/lib/recommend";

export type SessionNote = {
  /**
   * What the player actually typed, kept verbatim. The summary is derived from
   * it and never replaces it — if the model is off or wrong, this is still here.
   */
  raw: string;
  /** One line: where they left off. Falls back to `raw` when not summarised. */
  lastTime: string;
  /** One line: the obvious next step, only when their note implied one. */
  whatsNext?: string;
};

export type HistoryEntry = {
  id: string;
  at: string; // ISO timestamp
  time: PickerTime;
  /** Preset mood key or the player's free-text mood, as a display label. */
  mood: string;
  pick: { appid: number; name: string; coverUrl: string };
  alternatives: { appid: number; name: string }[];
  /** Set when the player marks they actually launched the pick. */
  played: boolean;
  /** What they wrote afterwards — this is what "Last time" reads back. */
  note?: SessionNote;
};

const HISTORY_KEY = "sidequest:history";
const MAX_ENTRIES = 100;
/** Fired on this window whenever the history is written. */
export const HISTORY_EVENT = "sidequest:history-changed";

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  // Same-tab listeners (the install prompt waits for a first draw).
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

// Prepend a new recommendation; returns the created entry (with its id).
export function addHistory(
  entry: Omit<HistoryEntry, "id" | "at" | "played">
): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    at: new Date().toISOString(),
    played: false,
  };
  const next = [full, ...loadHistory()];
  persist(next);
  return full;
}

export function markPlayed(id: string, played = true): HistoryEntry[] {
  const next = loadHistory().map((e) => (e.id === id ? { ...e, played } : e));
  persist(next);
  return next;
}

export function setNote(id: string, note: SessionNote): HistoryEntry[] {
  const next = loadHistory().map((e) => (e.id === id ? { ...e, note } : e));
  persist(next);
  return next;
}

/**
 * The most recent note for a game — what the pick card shows under "Last time".
 * Reads across the whole history, not just the last entry, because the player
 * may have spun a game several times and only written a note once.
 */
export function lastNoteFor(appid: number): SessionNote | null {
  for (const entry of loadHistory()) {
    if (entry.pick.appid === appid && entry.note?.lastTime) return entry.note;
  }
  return null;
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}
