// Recommendation history (V1, local-first — same swap-to-Supabase contract as
// lib/library.ts: keep all reads/writes behind these helpers).

import type { PickerTime } from "@/lib/recommend";

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
};

const HISTORY_KEY = "sidequest:history";
const MAX_ENTRIES = 100;

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

export function clearHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}
