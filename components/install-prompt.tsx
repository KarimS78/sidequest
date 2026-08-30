"use client";

import { useEffect, useState } from "react";
import { Mark } from "@/components/logo";
import { useI18n } from "@/i18n/context";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Android / desktop Chrome install affordance. iOS fires no such event, so
 * nothing is shown there.
 *
 * It parks at the bottom — above the phone tab bar, in the corner on a desktop.
 * Never at the top: the one thing a visitor is looking for in the first second
 * is the headline, and a bar over the header hides the product to advertise it.
 */
export function InstallPrompt() {
  const { d } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const t = d.common.install;

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
    <div
      className="fixed inset-x-0 bottom-[calc(66px+env(safe-area-inset-bottom)+12px)] z-50 flex justify-center px-4 lg:inset-x-auto lg:bottom-6 lg:right-6"
      role="dialog"
      aria-label={t.pitch}
    >
      <div className="card flex items-center gap-3 px-3 py-2.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.95)]">
        <Mark size={26} />
        <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-muted">
          {t.pitch}
        </span>
        <button
          type="button"
          onClick={async () => {
            const event = deferred;
            setDeferred(null);
            await event.prompt();
          }}
          className="btn btn-primary !min-h-[34px] !px-3 text-[11px]"
        >
          {t.install}
        </button>
        <button
          type="button"
          onClick={() => setDeferred(null)}
          aria-label={t.dismiss}
          className="px-1 text-subtle transition-colors hover:text-fg"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
