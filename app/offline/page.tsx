import type { Metadata } from "next";
import { OfflineCard } from "@/components/offline-card";

export const metadata: Metadata = {
  title: "Offline — SideQuest",
};

export default function Offline() {
  return (
    <main className="flex-1">
      <OfflineCard />
    </main>
  );
}
