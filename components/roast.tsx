"use client";

import { useEffect, useRef, useState } from "react";
import {
  computeBacklogStats,
  loadLibrary,
  SAMPLE_LIBRARY,
  type BacklogStats,
} from "@/lib/library";
import { roastBacklog, type Roast } from "@/lib/roast";
import { getAiRoast } from "@/app/roast/actions";
import { deviceId } from "@/lib/device";
import { announceAiCall } from "@/lib/ai-events";
import { useI18n } from "@/i18n/context";

/** The templates are instant; the pause is what sells "sharpening". */
const SHARPEN_MS = 450;

/**
 * The warning label.
 *
 * The one inverted surface in the whole app: dark type on light stock, the way
 * a warning is actually printed. That is not decoration and it is not a second
 * accent colour — it is what makes this card readable as the joke at a glance,
 * sitting next to a portrait that takes the same numbers seriously.
 *
 * `stats` is passed in when embedded in the profile; without it the component
 * reads the library itself, so /roast still works as a direct link.
 */
export function BacklogRoast({ stats: given }: { stats?: BacklogStats }) {
  const { d, locale } = useI18n();
  const [stats, setStats] = useState<BacklogStats | null>(given ?? null);
  const [roast, setRoast] = useState<Roast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = d.profile.roast;

  useEffect(() => {
    if (given) {
      setStats(given);
      return;
    }
    setStats(computeBacklogStats(loadLibrary() ?? SAMPLE_LIBRARY));
  }, [given]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  // Same rule as the portrait: generated copy does not survive a language
  // switch. The chrome around it changes instantly, and three English jabs
  // under a French heading read as a bug, because they are one.
  useEffect(() => setRoast(null), [locale]);

  function run() {
    if (!stats) return;
    setError(null);
    setPending(true);

    // Templates first, so there is always something to show. The model gets to
    // beat them if it answers in time; if it does not, nobody notices.
    const local = roastBacklog(stats);
    const ai = getAiRoast({ deviceId: deviceId(), stats, locale })
      .then((r) => (r.ok ? r.roast : null))
      .catch(() => null);

    const waited = new Promise<void>((resolve) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(resolve, SHARPEN_MS);
    });

    Promise.all([waited, ai]).then(([, generated]) => {
      setPending(false);
      announceAiCall();
      if (generated) setRoast(generated);
      else if (local.ok) setRoast(local.roast);
      else setError(local.error);
    });
  }

  if (!stats) return null;

  return (
    <section
      className="flex flex-col rounded-card p-5 lg:p-6"
      style={{ background: "var(--foreground)", color: "var(--background)" }}
    >
      <div
        className="flex items-baseline justify-between gap-3 border-b-2 pb-2"
        style={{ borderColor: "var(--background)" }}
      >
        <h3 className="poster text-[1.05rem]">{t.title}</h3>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="mono shrink-0 text-[10px] uppercase tracking-[0.12em] opacity-60 transition-opacity hover:opacity-100 disabled:opacity-40"
        >
          {pending ? t.pending : roast ? t.again : t.cta}
        </button>
      </div>

      {error && <p className="mt-4 text-[14px]">{error}</p>}

      {!roast && !error && (
        <p className="mt-4 text-[14px] leading-relaxed opacity-70">{t.idle}</p>
      )}

      {roast && (
        <>
          <p className="poster mt-4 text-[1.35rem] leading-[1.1]">{roast.verdict}</p>
          <ul className="mt-4 grid gap-2.5">
            {roast.lines.map((line, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] leading-snug opacity-80">
                <span className="poster shrink-0" aria-hidden>
                  !
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {roast.redemption && (
            <p
              className="mono mt-4 border-t pt-3 text-[11px] uppercase leading-relaxed tracking-[0.08em] opacity-60"
              style={{ borderColor: "rgba(13,17,20,0.2)" }}
            >
              {roast.redemption}
            </p>
          )}
        </>
      )}
    </section>
  );
}
