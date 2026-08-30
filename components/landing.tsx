"use client";

import Image from "next/image";
import Link from "next/link";
import { Mark } from "@/components/logo";
import { useI18n } from "@/i18n/context";
import { heroFor } from "@/lib/library";

/**
 * The landing.
 *
 * Five sections and not one more: what it does, why that is a problem worth
 * solving, how it decides, what it would cost, who wrote it. The old page
 * carried numbered channels, a service code and a token price list — all of it
 * true, none of it what someone arriving cold needs in the first ten seconds.
 *
 * The card beside the headline is a real verdict panel, the same component
 * shape the app draws into. A screenshot would date; this cannot.
 */

/**
 * What the running deployment can actually do, measured on the server rather
 * than asserted in copy.
 *
 * The pricing grid used to promise a Steam import and an AI layer that the
 * live site had no keys for: three features listed under a price, none of them
 * reachable, and nothing on the page admitting it. Capability now comes from
 * the environment, so the grid corrects itself the moment a key is added
 * instead of waiting for someone to notice the copy is stale.
 */
export type Capabilities = {
  steam: boolean;
  ai: boolean;
  overlay: boolean;
};

// Hades. Picked because its key art is dark enough to read type over, which is
// the whole reason the verdict panel works.
const DEMO_APPID = 1145360;
const DEMO_NAME = "Hades";

function Reassure({ items }: { items: string[] }) {
  return (
    <p className="mono flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-subtle">
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          {item}
        </span>
      ))}
    </p>
  );
}

/** The hero's verdict card: art, scrim, name, one line, three badges. */
function DemoVerdict() {
  const { d } = useI18n();

  return (
    <div className="verdict aspect-[4/5] w-full sm:aspect-[16/11] lg:aspect-[4/5]">
      <div className="verdict-art">
        <Image
          src={heroFor(DEMO_APPID)}
          alt=""
          fill
          sizes="(min-width: 1024px) 40vw, 100vw"
          priority
          className="object-cover"
        />
      </div>
      <div className="verdict-scrim" />

      <div className="verdict-body flex h-full flex-col justify-end gap-3 p-5 sm:p-6">
        <span className="eyebrow">{d.landing.hero.demo.label}</span>
        <h2 className="poster text-[clamp(2rem,6vw,2.9rem)]">{DEMO_NAME}</h2>
        <p className="max-w-sm text-sm text-muted">{d.landing.hero.demo.line}</p>
        <div className="flex flex-wrap gap-2">
          <span className="badge">
            {d.common.components.mood} <b>38/40</b>
          </span>
          <span className="badge">
            {d.common.components.session} <b>18/20</b>
          </span>
          <span className="badge">
            {d.common.components.momentum} <b>7/15</b>
          </span>
        </div>
      </div>
    </div>
  );
}

export function Landing({ caps }: { caps: Capabilities }) {
  const { d } = useI18n();
  const l = d.landing;

  /** Per plan, in the order they are written: live, off, or not out yet. */
  const planState = [
    { on: true, note: caps.steam ? null : l.pricing.noSteamKey },
    { on: caps.ai, note: caps.ai ? null : l.pricing.noAiKey },
    { on: caps.overlay, note: caps.overlay ? null : l.pricing.noOverlay },
  ];

  return (
    <main className="flex-1">
      {/* ============ hero ============ */}
      <section className="relative overflow-hidden">
        {/* The one violet pool in the whole app. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-28rem] h-[46rem] w-[68rem] -translate-x-1/2"
          style={{
            // Fades to a transparent VIOLET, not to `transparent` — which is
            // transparent black, and interpolating through it darkens the
            // middle of the glow.
            background:
              "radial-gradient(closest-side, rgba(124,92,255,0.16), rgba(124,92,255,0) 72%)",
          }}
        />

        <div className="wrap relative grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-24">
          <div className="flex flex-col gap-6">
            <span className="eyebrow rise" style={{ ["--i" as string]: 0 }}>
              {l.hero.eyebrow}
            </span>

            <h1
              className="poster rise text-[clamp(2.9rem,9vw,5.4rem)]"
              style={{ ["--i" as string]: 1 }}
            >
              {l.hero.title[0]}
              <br />
              {l.hero.title[1]}
            </h1>

            <p
              className="rise max-w-xl text-[16.5px] leading-relaxed text-muted"
              style={{ ["--i" as string]: 2 }}
            >
              {l.hero.lede}
            </p>

            <div
              className="rise flex flex-wrap items-center gap-3"
              style={{ ["--i" as string]: 3 }}
            >
              <Link href="/play" className="btn btn-primary">
                {l.hero.primary} <span className="arrow">→</span>
              </Link>
              <a href="#how" className="btn btn-ghost">
                {l.hero.secondary}
              </a>
            </div>

            <div className="rise" style={{ ["--i" as string]: 4 }}>
              <Reassure items={l.hero.reassure} />
            </div>
          </div>

          <div className="rise" style={{ ["--i" as string]: 3 }}>
            <DemoVerdict />
          </div>
        </div>
      </section>

      {/* ============ the problem ============ */}
      <section className="border-t border-line">
        <div className="wrap py-16 lg:py-20">
          <span className="eyebrow eyebrow-quiet">{l.problem.eyebrow}</span>
          <h2 className="poster mt-4 max-w-3xl text-[clamp(1.9rem,4.4vw,3rem)]">
            {l.problem.title}
          </h2>

          <ul className="mt-10 grid gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-3">
            {l.problem.lines.map((line) => (
              <li key={line} className="bg-base p-6">
                <p className="text-[15.5px] leading-relaxed text-muted">{line}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============ how it picks ============ */}
      <section id="how" className="scroll-mt-20 border-t border-line">
        <div className="wrap py-16 lg:py-20">
          <span className="eyebrow">{l.how.eyebrow}</span>
          <h2 className="poster mt-4 max-w-3xl text-[clamp(1.9rem,4.4vw,3rem)]">
            {l.how.title}
          </h2>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-muted">
            {l.how.lede}
          </p>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {l.how.items.map((item) => (
              <li key={item.name} className="card p-5">
                <span className="badge">{item.name}</span>
                <p className="mt-3.5 text-[14.5px] leading-relaxed text-muted">
                  {item.line}
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-2xl border-l-2 border-accent pl-4 text-[15px] leading-relaxed text-fg">
            {l.how.closing}
          </p>
        </div>
      </section>

      {/* ============ pricing ============ */}
      <section className="border-t border-line">
        <div className="wrap py-16 lg:py-20">
          <span className="eyebrow eyebrow-quiet">{l.pricing.eyebrow}</span>
          <h2 className="poster mt-4 text-[clamp(1.9rem,4.4vw,3rem)]">
            {l.pricing.title}
          </h2>

          <ul className="mt-10 grid gap-4 lg:grid-cols-3">
            {l.pricing.plans.map((plan, i) => {
              const state = planState[i];
              return (
                <li
                  key={plan.name}
                  className={`card flex flex-col gap-5 p-6 ${
                    plan.featured && state.on ? "border-accent-line" : ""
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono text-[11px] uppercase tracking-[0.14em] text-subtle">
                        {plan.name}
                      </span>
                      {/* Read from the server's environment, not written here. */}
                      <span
                        className={`mono text-[10px] uppercase tracking-[0.12em] ${
                          state.on ? "text-accent-soft" : "text-subtle"
                        }`}
                      >
                        ·{" "}
                        {state.on
                          ? l.pricing.status.live
                          : i === 2
                            ? l.pricing.status.soon
                            : l.pricing.status.off}
                      </span>
                    </div>
                    <p className="mt-2 flex items-baseline gap-2">
                      <span className="poster text-[2.4rem] leading-none">{plan.price}</span>
                      <span className="mono text-[11px] uppercase tracking-[0.12em] text-subtle">
                        {plan.per}
                      </span>
                    </p>
                  </div>

                  <p className="text-[14.5px] leading-relaxed text-muted">{plan.line}</p>

                  <ul className="flex flex-col gap-2 text-[14px] text-muted">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className={`mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full ${
                            state.on ? "bg-accent-soft" : "bg-line-strong"
                          }`}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {state.note && (
                    <p className="border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-subtle">
                      {state.note}
                    </p>
                  )}

                  <div className="mt-auto pt-1">
                    {plan.featured && state.on ? (
                      <Link href="/play" className="btn btn-primary w-full">
                        {plan.cta} <span className="arrow">→</span>
                      </Link>
                    ) : (
                      <Link href="/play" className="btn btn-ghost w-full">
                        {plan.cta}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-8 max-w-2xl text-[13.5px] leading-relaxed text-subtle">
            {l.pricing.honesty}
          </p>
        </div>
      </section>

      {/* ============ footer ============ */}
      <footer className="border-t border-line">
        <div className="wrap flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Mark size={26} />
            <span className="text-sm text-muted">{l.footer.line}</span>
          </div>
          <a
            href="https://github.com/KarimS78/sidequest"
            target="_blank"
            rel="noreferrer"
            className="mono text-[11px] uppercase tracking-[0.12em] text-subtle transition-colors hover:text-fg"
          >
            {l.footer.code}
          </a>
        </div>
      </footer>
    </main>
  );
}
