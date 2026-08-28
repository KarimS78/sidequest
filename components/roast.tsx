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

/** The templates are instant; the pause is what sells "sharpening". */
const SHARPEN_MS = 450;

/**
 * Rendered as the warning label moulded onto the back of a shell — the one
 * surface in the app that is printed dark-on-light, which is why it stings.
 *
 * `stats` is passed in when embedded in the profile; without it the component
 * reads the library itself, so /roast still works as a direct link.
 */
export function BacklogRoast({ stats: given }: { stats?: BacklogStats }) {
  const [stats, setStats] = useState<BacklogStats | null>(given ?? null);
  const [roast, setRoast] = useState<Roast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function run() {
    if (!stats) return;
    setError(null);
    setPending(true);

    // Templates first, so there is always something to show. The model gets to
    // beat them if it answers in time; if it doesn't, nobody notices.
    const local = roastBacklog(stats);
    const ai = getAiRoast({ deviceId: deviceId(), stats })
      .then((r) => (r.ok ? r.roast : null))
      .catch(() => null);

    const waited = new Promise<void>((resolve) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(resolve, SHARPEN_MS);
    });

    Promise.all([waited, ai]).then(([, generated]) => {
      setPending(false);
      // The supply gauge is a few blocks down the same screen.
      announceAiCall();
      if (generated) setRoast(generated);
      else if (local.ok) setRoast(local.roast);
      else setError(local.error);
    });
  }

  if (!stats) return null;

  return (
    // A warning label keeps its size: it is a sticker on the cabinet, not a
    // banner stretched across a desk. The one printed thing in a steel room.
    <div className="mt-5 max-w-[34rem] rounded-[2px] bg-label p-3.5 text-ink shadow-[0_8px_16px_-10px_rgba(0,0,0,0.8)] lg:p-5">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-1.5">
        <h2 className="font-display text-[20px] font-extrabold uppercase tracking-[0.03em]">
          Warning
        </h2>
        <button
          onClick={run}
          disabled={pending}
          className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-[#5a656b] transition-colors hover:text-ink disabled:opacity-50"
        >
          {pending ? "Sharpening…" : roast ? "Again" : "Read it"}
        </button>
      </div>

      {error && <p className="mt-3 text-[13px] text-challenge">{error}</p>}

      {!roast && !error && (
        <p className="mt-3 text-[13px] leading-relaxed text-[#454e53]">
          This cabinet carries a warning about its operator. Read it at your own
          risk.
        </p>
      )}

      {roast && (
        <>
          <p className="mt-3 font-display text-[19px] font-bold uppercase leading-[1.05]">
            {roast.verdict}
          </p>
          <ul className="mt-3 grid gap-2">
            {roast.lines.map((line, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug text-[#454e53]">
                <span className="font-display font-extrabold text-challenge" aria-hidden>
                  !
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {roast.redemption && (
            <p className="mt-3 border-t border-ink/20 pt-2.5 font-mono text-[10px] uppercase leading-relaxed tracking-[0.06em] text-[#5a656b]">
              {roast.redemption}
            </p>
          )}
        </>
      )}
    </div>
  );
}
