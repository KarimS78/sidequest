"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/context";

/**
 * The heading for /connect, split out because the page itself has to stay a
 * server component: it reads STEAM_API_KEY, and that decides whether this is a
 * real import or a preview.
 */
export function ConnectHeader({ demoMode }: { demoMode: boolean }) {
  const { d } = useI18n();
  const t = d.connect;

  return (
    <header className="flex flex-col gap-4">
      <Link
        href="/dashboard"
        className="mono text-[10px] uppercase tracking-[0.12em] text-subtle transition-colors hover:text-fg"
      >
        ← {t.back}
      </Link>

      <div className="flex flex-col gap-3">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1 className="poster text-[clamp(2rem,5vw,3rem)]">{t.title}</h1>
        <p className="max-w-xl text-[15.5px] leading-relaxed text-muted">{t.lede}</p>
      </div>

      {demoMode && (
        <div className="card-quiet border-accent-line p-4">
          <p className="mono text-[10px] uppercase tracking-[0.14em] text-accent-soft">
            {t.demoMode.title}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            {t.demoMode.line}
          </p>
        </div>
      )}
    </header>
  );
}
