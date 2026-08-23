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
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="card flex items-center gap-3 px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-white">
          S
        </span>
        <span className="text-sm text-muted">Install SideQuest</span>
        <button
          type="button"
          onClick={async () => {
            const event = deferred;
            setDeferred(null);
            await event.prompt();
          }}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          Install app
        </button>
        <button
          type="button"
          onClick={() => setDeferred(null)}
          aria-label="Dismiss"
          className="px-1 text-subtle transition-colors hover:text-foreground"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
