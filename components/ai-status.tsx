"use client";

import { useEffect, useState } from "react";
import { getAiStatus, type AiStatus } from "@/app/profile/actions";

/**
 * The AI supply readout.
 *
 * The whole AI design is "bounded spend, and the local engine still works
 * without it" — but until this existed you had to read lib/ai-guard.ts to know
 * either of those was true. A machine with a budget shows the gauge.
 *
 * Off is not an error state and is not styled as one: every screen works, it
 * just phrases things from templates. That is the honest reading and the panel
 * says it that way.
 */
export function AiStatusPanel() {
  const [status, setStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    getAiStatus()
      .then(setStatus)
      // The readout is a nicety; the profile is not going to error over it.
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  const pct = (n: number, of: number) => (of > 0 ? Math.min(100, (n / of) * 100) : 0);
  const tokenPct = pct(status.tokens, status.tokensLimit);

  return (
    <>
      <p className="rule mt-7">AI supply</p>

      <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.14em]">
        <i
          className={`led ${status.on ? "led-on" : ""}`}
          style={{ "--lit": "var(--contacts)" } as React.CSSProperties}
          aria-hidden
        />
        <span className={status.on ? "text-label" : "text-ink-soft"}>
          {status.on ? "Live" : "Local only"}
        </span>
        <span className="h-px flex-1 bg-line-soft" />
        <span className="text-ink-soft">
          {status.calls}/{status.callsLimit} calls today
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{status.why}</p>

      {status.on && (
        <>
          {/* The gauge reads in tokens because tokens are what the bill is in.
              Calls are the count you can feel; tokens are the one that runs out. */}
          <div
            className="mt-3 h-2 overflow-hidden rounded-[1px] bg-[#10171b] shadow-[inset_0_1px_2px_rgba(0,0,0,.8)]"
            role="meter"
            aria-valuenow={status.tokens}
            aria-valuemin={0}
            aria-valuemax={status.tokensLimit}
            aria-label="Daily token budget used"
          >
            <div
              className="h-full bg-contacts shadow-[0_0_8px_-1px_var(--contacts)] transition-[width] duration-[var(--slow)]"
              style={{ width: `${tokenPct}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft">
            {status.tokens.toLocaleString("en-GB")} of{" "}
            {status.tokensLimit.toLocaleString("en-GB")} tokens · resets at midnight UTC
          </p>
        </>
      )}

      {!status.on && (
        <p className="mt-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-[#5b6a72]">
          The picker, the roast and the notes all still work — the scoring engine
          is local and was never the part that needed a model.
        </p>
      )}
    </>
  );
}
