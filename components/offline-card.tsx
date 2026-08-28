"use client";

import { Mark } from "@/components/logo";
import { useI18n } from "@/i18n/context";

export function OfflineCard() {
  const { d } = useI18n();
  return (
    <div className="wrap flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <Mark size={44} />
      <h1 className="poster text-[clamp(2rem,6vw,3rem)]">{d.connect.offline.title}</h1>
      <p className="max-w-sm text-muted">{d.connect.offline.line}</p>
    </div>
  );
}
