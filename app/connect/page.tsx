import Link from "next/link";
import { SteamConnect } from "@/components/steam-connect";

export default function ConnectPage() {
  const hasKey = Boolean(process.env.STEAM_API_KEY?.trim());
  return (
    <main className="column has-nav flex-1">
      <div className="pt-5">
        <Link
          href="/dashboard"
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:text-label"
        >
          ← Shelf
        </Link>
        <h1 className="mt-3 font-display text-[30px] font-extrabold uppercase leading-none tracking-[0.02em]">
          Connect Steam
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Import your real library and playtime — no password, no OAuth.
        </p>
      </div>

      {!hasKey && (
        <div className="mt-5 border border-challenge/40 bg-challenge/10 p-3.5 text-sm text-label">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-challenge">
            Demo mode
          </p>
          <p className="mt-1.5 leading-relaxed">
            No <code className="font-mono">STEAM_API_KEY</code> is configured, so
            this shows a sample shelf — <strong>not your real Steam account</strong>.
            Add a key (see <code className="font-mono">.env.example</code>) to
            import your actual games.
          </p>
        </div>
      )}

      <div className="mt-5">
        <SteamConnect demoMode={!hasKey} />
      </div>
    </main>
  );
}
