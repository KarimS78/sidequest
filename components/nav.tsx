"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The shelf edge: four tabs pinned to the bottom, the active one marked by a
 * gold contact strip — the same gold as a cartridge's edge connector, so the
 * current tab reads as the one that's seated.
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

export function BottomNav() {
  const pathname = usePathname();

  // /connect belongs to the library flow, so Shelf stays lit while you're in it.
  const activeHref =
    TABS.find((t) => pathname === t.href)?.href ??
    (pathname.startsWith("/connect") ? "/dashboard" : null);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#3d3129] bg-plank"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
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
            {active && (
              <span className="absolute top-0 h-[3px] w-10 bg-contacts" />
            )}
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
              {tab.path}
            </svg>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
