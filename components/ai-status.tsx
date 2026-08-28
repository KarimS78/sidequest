"use client";

import { useEffect, useState } from "react";
import { getAiStatus, type AiStatus } from "@/app/profile/actions";
import { onAiCall } from "@/lib/ai-events";
import { useI18n } from "@/i18n/context";

/**
 * Money, at the scale this app actually spends it.
 *
 * A day of heavy use is worth a few cents, and "$0.00" is the one rendering
 * that would make the gauge useless — so under a cent it reads in cents, with
 * enough decimals to move when a call lands.
 */
function money(usd: number): string {
  if (usd <= 0) return "0¢";
  const cents = usd * 100;
  if (cents < 0.01) return `${cents.toFixed(3)}¢`;
  if (cents < 1) return `${cents.toFixed(2)}¢`;
  if (usd < 1) return `${cents.toFixed(1)}¢`;
  return `$${usd.toFixed(2)}`;
}

/**
 * The AI layer, and what it has cost today.
 *
 * The previous version printed everything the guard knows: two token counts, a
 * per-million price list, a reset time and a percentage, all at once, in mono,
 * all the same size. That is a log, not a readout. What a person actually wants
 * to know here is three things — is it on, what did it cost, and does anything
 * break without it — so those are the only three at full size. The arithmetic
 * that backs them is still on the page, one disclosure away, for whoever wants
 * to check the number rather than believe it.
 *
 * Off is not an error state and is not styled as one.
 */
export function AiStatusPanel() {
  const { d, locale } = useI18n();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const t = d.profile.supply;

  useEffect(() => {
    const refresh = () =>
      getAiStatus()
        .then(setStatus)
        // The readout is a nicety; the profile is not going to error over it.
        .catch(() => setStatus(null));

    refresh();
    // The portrait and the roast sit on this same screen. Without this the
    // gauge kept showing the count from before you pressed them.
    return onAiCall(refresh);
  }, []);

  if (!status) return null;

  const pct =
    status.tokensLimit > 0
      ? Math.min(100, (status.tokens / status.tokensLimit) * 100)
      : 0;
  const n = (v: number) => v.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB");

  return (
    <section className="card p-5 lg:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${
            status.on ? "bg-accent shadow-[0_0_10px_var(--accent)]" : "bg-subtle"
          }`}
        />
        <h3 className="poster text-[1.05rem]">{t.title}</h3>
        <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-subtle">
          {status.on ? t.live : t.off}
        </span>
        {status.on && (
          <span className="mono ml-auto text-[10.5px] uppercase tracking-[0.1em] text-subtle">
            {t.calls(status.calls, status.callsLimit)}
          </span>
        )}
      </div>

      <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-muted">
        {status.on ? t.liveLine : t.offLine}
      </p>

      {status.on && (
        <>
          {/* Two numbers, one of which is the only one anybody argues about.
              Tokens are what the bill is in; cents are what a decision is in. */}
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="card-quiet p-3.5">
              <dt className="mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                {t.spent}
              </dt>
              <dd className="mono mt-1.5 text-[1.5rem] leading-none text-accent-soft">
                {money(status.spentUsd)}
              </dd>
            </div>
            <div className="card-quiet p-3.5">
              <dt className="mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                {t.ceiling}
              </dt>
              <dd className="mono mt-1.5 text-[1.5rem] leading-none">
                {money(status.ceilingUsd)}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-surface2"
              role="meter"
              aria-valuenow={status.tokens}
              aria-valuemin={0}
              aria-valuemax={status.tokensLimit}
              aria-label={t.budget}
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-[var(--t-slow)]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mono mt-2 text-[10px] uppercase tracking-[0.1em] text-subtle">
              {t.budget} · {Math.round(pct)}%
            </p>
          </div>

          <details className="mt-4 border-t border-line pt-3">
            <summary className="mono cursor-pointer list-none text-[10px] uppercase tracking-[0.12em] text-subtle transition-colors hover:text-fg">
              {t.detail}
            </summary>
            <p className="mono mt-2 text-[11px] leading-relaxed text-subtle">
              {t.detailLine(
                n(status.inputTokens),
                n(status.outputTokens),
                status.price.input.toFixed(2),
                status.price.output.toFixed(2)
              )}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
