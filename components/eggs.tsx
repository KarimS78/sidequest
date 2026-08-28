"use client";

import { useEffect, useState } from "react";
import { EGGS, loadFound, unlock, type Egg, type EggId } from "@/lib/eggs";
import { useI18n } from "@/i18n/context";
import { eggCopy } from "@/i18n";

/* ============================================================
   The trophy card
   An unlock is a memory-card write: the card slides in from the edge,
   the gold contact strip fills left to right, then it parks for a few
   seconds and leaves. Same plastic, same gold, same mono labels as the
   rest of the app — a trophy is not a different product.
   ============================================================ */

type Toast = { key: number; egg: Egg };

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

/** Typed words, checked against the tail of everything typed outside a field. */
const WORDS: { word: string; id: EggId }[] = [
  { word: "iddqd", id: "iddqd" },
  { word: "xyzzy", id: "xyzzy" },
  { word: "barrelroll", id: "barrelroll" },
];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}

export function EggHost() {
  const { locale } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const copy = eggCopy[locale];

  // ---- announce ----
  useEffect(() => {
    let seq = 0;
    const onEgg = (e: Event) => {
      const detail = (e as CustomEvent<{ egg: Egg; isNew: boolean }>).detail;
      if (!detail?.egg) return;
      const key = ++seq;
      // Three at once is already a lot of celebrating.
      setToasts((list) => [...list.slice(-2), { key, egg: detail.egg }]);
      window.setTimeout(() => {
        setToasts((list) => list.filter((t) => t.key !== key));
      }, 5200);
    };
    window.addEventListener("sq:egg", onEgg);
    return () => window.removeEventListener("sq:egg", onEgg);
  }, []);

  // ---- the codes ----
  useEffect(() => {
    let konamiAt = 0;
    let buffer = "";

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;

      // Konami. Case-insensitive on the B and A, exact on the arrows.
      const expected = KONAMI[konamiAt];
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      konamiAt = key === expected ? konamiAt + 1 : key === KONAMI[0] ? 1 : 0;
      if (konamiAt === KONAMI.length) {
        konamiAt = 0;
        unlock("konami");
        const root = document.documentElement;
        root.dataset.konami = "1";
        window.setTimeout(() => delete root.dataset.konami, 30_000);
      }

      // Typed words.
      if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
        buffer = (buffer + e.key.toLowerCase()).slice(-16);
        for (const { word, id } of WORDS) {
          if (!buffer.endsWith(word)) continue;
          buffer = "";
          unlock(id);
          if (id === "barrelroll") {
            const cart = document.querySelector<HTMLElement>("[data-cart]");
            if (cart) {
              cart.classList.add("barrel-roll");
              window.setTimeout(() => cart.classList.remove("barrel-roll"), 1200);
            }
          }
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- the hour ----
  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 3 && h < 5) unlock("nightowl");
  }, []);

  if (!toasts.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[76px] z-40 flex flex-col items-end gap-2 lg:inset-x-auto lg:bottom-6 lg:right-6"
    >
      {toasts.map(({ key, egg }) => (
        <div
          key={key}
          className="card seated w-full max-w-[19rem] overflow-hidden shadow-[0_18px_40px_-20px_rgba(0,0,0,.95)]"
        >
          <div className="h-[2px] w-full bg-accent" />
          <div className="px-4 py-3">
            <p className="eyebrow">{copy[egg.id].name}</p>
            <p className="poster mt-1.5 text-[17px]">{copy[egg.id].line}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   The case — rendered in the profile.
   Locked rows print their hint, never their answer. A trophy case with
   nothing but question marks tells you nothing; one that spoils itself
   is not worth opening.
   ============================================================ */

/**
 * The case, and it starts shut.
 *
 * Twelve rows that mostly say "Locked" were the single largest thing on the
 * profile — a list of things you have not done, given more room than anything
 * you have. Collapsed, it is one line that reports a score; opened, it is the
 * same case it always was.
 */
export function TrophyCase() {
  const { d, locale } = useI18n();
  const [found, setFound] = useState<EggId[] | null>(null);
  const [open, setOpen] = useState(false);
  const copy = eggCopy[locale];
  const t = d.profile.trophies;

  useEffect(() => {
    setFound(loadFound());
    const onEgg = () => setFound(loadFound());
    window.addEventListener("sq:egg", onEgg);
    return () => window.removeEventListener("sq:egg", onEgg);
  }, []);

  if (found === null) return null;

  return (
    <section className="card p-5 lg:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="poster text-[1.05rem]">{t.title}</h3>
        <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-subtle">
          {t.found(found.length, EGGS.length)}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="btn btn-quiet ml-auto !px-0 text-[12.5px]"
        >
          {open ? t.hide : t.show}
        </button>
      </div>

      {open && (
        <>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {EGGS.map((egg) => {
              const got = found.includes(egg.id);
              return (
                <li
                  key={egg.id}
                  className={`flex items-start gap-2.5 rounded-btn border p-3 ${
                    got ? "border-accent-line bg-accent-dim" : "border-line"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${
                      got ? "bg-accent" : "bg-line-strong"
                    }`}
                  />
                  <div className="min-w-0">
                    <p
                      className={`poster text-[14px] ${got ? "" : "text-subtle"}`}
                    >
                      {got ? copy[egg.id].name : t.locked}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-snug text-muted">
                      {got ? copy[egg.id].line : copy[egg.id].hint}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mono mt-3 text-[10px] uppercase tracking-[0.1em] text-subtle">
            {t.privacy}
          </p>
        </>
      )}
    </section>
  );
}
