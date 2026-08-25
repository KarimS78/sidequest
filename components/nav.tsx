"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { unlock } from "@/lib/eggs";

/**
 * Two housings for the same four seats.
 *
 * On a phone: the shelf edge, four tabs pinned to the bottom.
 * On a desktop: the console's front panel down the left, because a bar
 * glued to the bottom of a 27-inch screen is a phone app in a costume.
 *
 * Either way the active seat is marked by a gold contact strip — the same
 * gold as a cartridge's edge connector, so the current tab reads as the
 * one that's seated.
 */
const TABS = [
  {
    href: "/play",
    label: "Pull",
    // a cartridge above its slot
    path: (
      <>
        <path d="M5 9h14v10H5z" />
        <path d="M8 9V5h8v4" />
        <path d="M9 19v2M15 19v2" />
      </>
    ),
  },
  {
    href: "/dashboard",
    label: "Shelf",
    // spines standing on a board
    path: (
      <>
        <path d="M4 4v16M9 4v16M14 4v16M19 4v16" />
        <path d="M3 20h18" />
      </>
    ),
  },
  {
    href: "/history",
    label: "Saves",
    // a memory card
    path: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <path d="M8 4v6h8V4" />
        <path d="M8 20v-4h8v4" />
      </>
    ),
  },
  {
    href: "/profile",
    label: "You",
    path: (
      <>
        <circle cx="12" cy="8.5" r="3.7" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </>
    ),
  },
];

function useActiveHref() {
  const pathname = usePathname();
  // /connect belongs to the library flow, so Shelf stays lit while you're in it.
  return (
    TABS.find((t) => pathname === t.href)?.href ??
    (pathname.startsWith("/connect") ? "/dashboard" : null)
  );
}

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

/** The moulded mark at the top of the rail. Ask it nicely three times. */
function Mark() {
  const taps = useRef(0);
  return (
    <button
      onClick={() => {
        taps.current += 1;
        if (taps.current >= 3) {
          taps.current = 0;
          unlock("kindly");
        }
      }}
      aria-label="SideQuest"
      className="grid h-10 w-10 place-items-center rounded-[3px] bg-gradient-to-b from-shell to-shell-dark font-display text-[17px] font-extrabold leading-none text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_6px_12px_-8px_rgba(0,0,0,.9)] transition-transform duration-[var(--fast)] active:translate-y-px"
    >
      SQ
    </button>
  );
}

export function BottomNav() {
  const activeHref = useActiveHref();

  return (
    <>
      {/* ---------------- phone: the shelf edge ---------------- */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#3d3129] bg-plank lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((tab) => {
            const active = tab.href === activeHref;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-[62px] min-h-11 flex-col items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors duration-[var(--fast)] ${
                  active ? "text-label" : "text-ink-soft hover:text-label"
                }`}
              >
                {active && <span className="absolute top-0 h-[3px] w-10 bg-contacts" />}
                <TabIcon path={tab.path} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ---------------- desktop: the front panel ---------------- */}
      <nav
        aria-label="Main"
        className="rail fixed inset-y-0 left-0 z-30 hidden w-[84px] flex-col items-center py-5 lg:flex"
      >
        <Mark />

        <div className="mt-9 flex w-full flex-col">
          {TABS.map((tab) => {
            const active = tab.href === activeHref;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-[68px] flex-col items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors duration-[var(--fast)] ${
                  active ? "text-label" : "text-ink-soft hover:text-label"
                }`}
              >
                {active && <span className="absolute left-0 h-9 w-[3px] bg-contacts" />}
                <TabIcon path={tab.path} />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Power. It is on. That is the whole message. */}
        <i className="deck-led mt-auto !bg-contacts opacity-70" aria-hidden />
      </nav>
    </>
  );
}
