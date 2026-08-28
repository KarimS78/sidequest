import { BacklogRoast } from "@/components/roast";

export default function RoastPage() {
  return (
    <main className="flex-1">
      <div className="wrap has-tabs flex max-w-3xl flex-col gap-6 py-10">
        <BacklogRoast />
      </div>
    </main>
  );
}
