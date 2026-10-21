"use client";

import { ErrorBox } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg">
      <ErrorBox message={error.message || "An unexpected error occurred."} onRetry={reset} />
    </div>
  );
}
