import type { Metadata } from "next";
import { OfflineCard } from "@/components/offline-card";
import { dictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";

// The card below already speaks the dictionary; the tab title was the one
// English word left on the screen in French.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: `${dictionary(locale).connect.offline.title} — SideQuest` };
}

export default function Offline() {
  return (
    <main className="flex-1">
      <OfflineCard />
    </main>
  );
}
