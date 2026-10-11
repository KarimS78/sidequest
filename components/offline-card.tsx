"use client";

import Link from "next/link";
import { Mark } from "@/components/logo";
import { useI18n } from "@/i18n/context";

/**
 * The three screens with nothing to show — offline, 404, crash — share one
 * shape: the mark, a poster line, one sentence, and always a way out. A page
 * that only says what went wrong is a dead end.
 */
export function FallbackCard({
  title,
  line,
  children,
}: {
  title: string;
  line: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="wrap has-tabs flex min-h-[70vh] flex-col items-center justify-center gap-5 py-16 text-center">
      <Mark size={44} />
      <h1 className="poster max-w-[18ch] text-[clamp(1.9rem,5.5vw,3rem)]">{title}</h1>
      <p className="max-w-md text-muted">{line}</p>
      {children && <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

export function OfflineCard() {
  const { d } = useI18n();
  return (
    <FallbackCard title={d.connect.offline.title} line={d.connect.offline.line}>
      <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
        {d.common.actions.retry}
      </button>
    </FallbackCard>
  );
}

export function NotFoundCard() {
  const { d } = useI18n();
  return (
    <FallbackCard title={d.common.notFound.title} line={d.common.notFound.line}>
      <Link href="/play" className="btn btn-primary">
        {d.common.notFound.play} <span className="arrow">→</span>
      </Link>
      <Link href="/" className="btn btn-ghost">
        {d.common.notFound.home}
      </Link>
    </FallbackCard>
  );
}

export function CrashCard({ retry }: { retry: () => void }) {
  const { d } = useI18n();
  return (
    <FallbackCard title={d.common.crash.title} line={d.common.crash.line}>
      <button type="button" className="btn btn-primary" onClick={retry}>
        {d.common.actions.retry}
      </button>
      <Link href="/play" className="btn btn-ghost">
        {d.common.notFound.play}
      </Link>
    </FallbackCard>
  );
}
