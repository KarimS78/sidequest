import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline — SideQuest",
};

export default function Offline() {
  return (
    <main className="column has-nav flex flex-1 flex-col items-center justify-center text-center">
      <span className="deck-slot w-28" />
      <h1 className="mt-5 font-display text-[30px] font-extrabold uppercase leading-none">
        No signal
      </h1>
      <p className="mt-2.5 max-w-[26ch] text-sm text-ink-soft">
        The shelf is still here. Reconnect and SideQuest picks up where you left
        off.
      </p>
    </main>
  );
}
