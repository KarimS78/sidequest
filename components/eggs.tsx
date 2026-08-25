"use client";

import { useEffect, useState } from "react";
import { EGGS, loadFound, unlock, type Egg, type EggId } from "@/lib/eggs";

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
  const [toasts, setToasts] = useState<Toast[]>([]);

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
          className="trophy w-full max-w-[19rem] overflow-hidden rounded-[3px] border border-[#4d3f36] bg-plank shadow-[0_18px_30px_-14px_rgba(0,0,0,.85)]"
        >
          <div className="trophy-write h-[3px] origin-left bg-contacts" />
          <div className="px-3 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-contacts">
              Trophy · {egg.name}
            </p>
            <p className="mt-1 font-display text-[19px] font-bold uppercase leading-none tracking-[0.02em] text-label">
              {egg.line}
            </p>
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

export function TrophyCase() {
  const [found, setFound] = useState<EggId[] | null>(null);

  useEffect(() => {
    setFound(loadFound());
    const onEgg = () => setFound(loadFound());
    window.addEventListener("sq:egg", onEgg);
    return () => window.removeEventListener("sq:egg", onEgg);
  }, []);

  if (found === null) return null;

  return (
    <section className="mt-8">
      <p className="rule">
        Trophy case · {found.length}/{EGGS.length}
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {EGGS.map((egg) => {
          const got = found.includes(egg.id);
          return (
            <div
              key={egg.id}
              className={`flex items-start gap-2.5 rounded-[2px] border p-2.5 ${
                got ? "border-contacts/40 bg-contacts/[0.06]" : "border-line-soft"
              }`}
            >
              <span
                aria-hidden
                className={`mt-[3px] h-[13px] w-[9px] shrink-0 rounded-[1px] ${
                  got ? "bg-contacts" : "bg-[#3a2f28]"
                }`}
              />
              <div className="min-w-0">
                <p
                  className={`font-display text-[15px] font-bold uppercase leading-none ${
                    got ? "text-label" : "text-ink-soft"
                  }`}
                >
                  {got ? egg.name : "Locked"}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-ink-soft">
                  {got ? egg.line : egg.hint}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#6a5c52]">
        Kept in this browser only. Nothing is sent anywhere.
      </p>
    </section>
  );
}
