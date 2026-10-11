import type { Metadata } from "next";
import { NotFoundCard } from "@/components/offline-card";
import { dictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: `404 · ${dictionary(locale).common.notFound.title} — SideQuest` };
}

export default function NotFound() {
  return (
    <main className="flex-1">
      <NotFoundCard />
    </main>
  );
}
