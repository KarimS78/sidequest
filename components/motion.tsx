"use client";

import { useEffect, useRef, useState } from "react";

/** One place to ask, so no component has to remember the media query. */
export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts from zero to `target` over half a second.
 *
 * The badges on a verdict are the engine's arithmetic, and a number that lands
 * fully formed reads as decoration. A number that counts reads as a number that
 * was worked out.
 */
export function useCountUp(target: number, run: boolean, ms = 500): number {
  const [value, setValue] = useState(run ? 0 : target);

  useEffect(() => {
    if (!run) {
      setValue(target);
      return;
    }
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // Same curve as every other movement in the app.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);

  return value;
}

/**
 * The primary call to action leans toward the cursor. Four pixels, never more:
 * past that it stops feeling like weight and starts feeling like a bug.
 */
export function useMagnetic<T extends HTMLElement>(max = 4) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      el.style.setProperty("--mx", `${Math.max(-1, Math.min(1, dx)) * max}px`);
      el.style.setProperty("--my", `${Math.max(-1, Math.min(1, dy)) * max}px`);
    };
    const onLeave = () => {
      el.style.setProperty("--mx", "0px");
      el.style.setProperty("--my", "0px");
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [max]);

  return ref;
}

/**
 * A title that arrives letter by letter.
 *
 * The whole string stays in the DOM as one accessible node — a screen reader
 * should hear a game's name, not twelve separate letters.
 */
export function Letters({
  text,
  className = "",
  step = 25,
}: {
  text: string;
  className?: string;
  step?: number;
}) {
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span className="letters" aria-hidden>
        {Array.from(text).map((ch, i) => (
          <span
            key={`${ch}-${i}`}
            style={{ ["--i" as string]: i, animationDelay: `${i * step}ms` }}
          >
            {ch}
          </span>
        ))}
      </span>
    </span>
  );
}
