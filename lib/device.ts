// A per-browser id, used only to spread the AI quota across devices instead of
// one player burning the whole daily budget. Not identity, not analytics: it is
// never sent anywhere except our own Server Actions, and it is trivially
// resettable by clearing site data.

const KEY = "sidequest:device";

export function deviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // private mode / storage blocked — everyone shares the "anonymous" bucket
    return "anonymous";
  }
}
