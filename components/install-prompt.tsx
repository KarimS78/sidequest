"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Android / desktop Chrome install affordance. iOS has no equivalent event —
 * nothing is shown there for now.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred) return null;

  return (
    // Phone: above the bottom nav, never over it. Desktop: parked in the
    // corner, where a system prompt belongs.
    <div
      className="install-dock fixed inset-x-0 z-40 flex justify-center px-4 lg:inset-x-auto lg:right-6 lg:justify-end"
    >
      <div className="flex items-center gap-3 rounded-[3px] border border-line bg-plank px-3 py-2 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.9)]">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
          Install SideQuest
        </span>
        <button
          type="button"
          onClick={async () => {
            const event = deferred;
            setDeferred(null);
            await event.prompt();
          }}
          className="switch w-auto px-3 py-1.5 font-display text-[14px] font-bold uppercase tracking-[0.1em]"
        >
          Install
        </button>
        <button
          type="button"
          onClick={() => setDeferred(null)}
          aria-label="Dismiss"
          className="px-1 text-ink-soft transition-colors hover:text-label"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
