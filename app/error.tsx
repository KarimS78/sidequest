"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { CrashCard } from "@/components/offline-card";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1">
      <CrashCard retry={() => unstable_retry()} />
    </main>
  );
}
