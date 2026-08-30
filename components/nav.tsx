"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { unlock } from "@/lib/eggs";
import { LogoContent, LOGO_WRAPPER } from "@/components/logo";
import { useI18n } from "@/i18n/context";
import { LOCALES, LOCALE_LABEL } from "@/i18n/locale";

/**
 * Two housings, four destinations.
 *
 * On a phone the tab bar sits at the bottom, where a thumb is. On a desktop it
 * becomes a top bar, because a bar glued to the bottom of a 27-inch screen is a
 * phone app in a costume.
 *
 * The landing keeps the top bar but drops the tabs: a visitor who has not seen
 * the product yet has nothing to navigate between. It keeps the language
 * switch, which is the one control that has to be reachable everywhere.
 */
const TABS = [
  {
    href: "/play",
    key: "play",
    // a die: the draw
    path: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <circle cx="9.2" cy="9.2" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="14.8" cy="14.8" r="1.1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    href: "/dashboard",
    key: "shelf",
    // spines standing on a board
    path: (
      <>
        <path d="M5 4v14M10 4v14M15 4v14M19 6v12" />
        <path d="M3 20h18" />
      </>
    ),
  },
  {
    href: "/history",
    key: "saves",
    // a bookmark: where you left off
    path: <path d="M7 4h10v16l-5-4-5 4z" />,
  },
  {
    href: "/profile",
    key: "you",
    path: (
      <>
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
      </>
    ),
  },
] as const;

function TabIcon({ path }: { path: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[19px] w-[19px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {path}
    </svg>
  );
}

function useActiveHref() {
  const pathname = usePathname();
  // /connect belongs to the library flow, so Shelf stays lit inside it.
  return (
    TABS.find((t) => pathname === t.href)?.href ??
    (pathname.startsWith("/connect") ? "/dashboard" : null)
  );
}

/** EN · FR. The language named in itself, never a flag. */
function LanguageSwitch() {
  const { locale, setLocale, d } = useI18n();
  return (
    <div
      className="seg w-[92px]"
      style={{ ["--seg-n" as string]: LOCALES.length, ["--seg-i" as string]: LOCALES.indexOf(locale) }}
      role="group"
      aria-label={d.common.langSwitch}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className="!min-h-[32px]"
        >
          {LOCALE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

/** Ask it nicely three times. */
function useTripleTap() {
  const taps = useRef(0);
  return () => {
    taps.current += 1;
    if (taps.current >= 3) {
      taps.current = 0;
      unlock("kindly");
    }
  };
}

export function AppNav() {
  const { d } = useI18n();
  const pathname = usePathname();
  const activeHref = useActiveHref();
  const tap = useTripleTap();
  const isLanding = pathname === "/";

  return (
    <>
      {/* ---------------- the top bar ---------------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-base">
        <div className="wrap flex h-16 items-center justify-between gap-6">
          <Link
            href={isLanding ? "/" : "/play"}
            aria-label={d.common.brand}
            className={LOGO_WRAPPER}
            onClick={tap}
          >
            <LogoContent />
          </Link>

          {!isLanding && (
            <nav aria-label={d.nav.aria} className="hidden lg:block">
              <ul className="flex items-center gap-1">
                {TABS.map((tab) => {
                  const active = tab.href === activeHref;
                  return (
                    <li key={tab.href}>
                      <Link
                        href={tab.href}
                        aria-current={active ? "page" : undefined}
                        className={`mono flex h-9 items-center gap-2 rounded-btn px-3 text-[11px] uppercase tracking-[0.12em] transition-colors duration-[var(--t-base)] ${
                          active
                            ? "bg-accent-dim text-fg"
                            : "text-subtle hover:text-fg"
                        }`}
                      >
                        <TabIcon path={tab.path} />
                        {d.nav.tabs[tab.key]}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          <LanguageSwitch />
        </div>
      </header>

      {/* ---------------- the phone tab bar ---------------- */}
      {!isLanding && (
        <nav
          aria-label={d.nav.aria}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-base lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <ul className="mx-auto grid max-w-md grid-cols-4">
            {TABS.map((tab) => {
              const active = tab.href === activeHref;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex h-[66px] min-h-11 flex-col items-center justify-center gap-1.5 text-[10px] transition-colors duration-[var(--t-base)] ${
                      active ? "text-fg" : "text-subtle"
                    }`}
                  >
                    {active && (
                      <span className="absolute top-0 h-[2px] w-9 rounded-full bg-accent" />
                    )}
                    <TabIcon path={tab.path} />
                    {d.nav.tabs[tab.key]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
