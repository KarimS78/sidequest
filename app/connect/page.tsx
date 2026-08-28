import { SteamConnect } from "@/components/steam-connect";
import { ConnectHeader } from "@/components/connect-header";

export default function ConnectPage() {
  // Read on the server so the demo-mode warning can never disagree with what
  // the import will actually do.
  const hasKey = Boolean(process.env.STEAM_API_KEY?.trim());

  return (
    <main className="flex-1">
      <div className="wrap has-tabs flex max-w-2xl flex-col gap-6 py-8 lg:py-12">
        <ConnectHeader demoMode={!hasKey} />
        <SteamConnect demoMode={!hasKey} />
      </div>
    </main>
  );
}
