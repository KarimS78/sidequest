import type { Metadata } from "next";
import { Logo } from "@/components/nav";

export const metadata: Metadata = {
  title: "Offline — SideQuest AI",
};

export default function Offline() {
  return (
    <div className="ambient flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-5">
        <Logo />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 pb-24 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-elevated text-xl text-subtle">
          ⌁
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your library is still here. Reconnect and SideQuest picks up right
          where you left off.
        </p>
      </main>
    </div>
  );
}
