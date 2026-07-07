"use client";

import { ErrorDisplay } from "@amazecontinuityprojects/amazeui";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-[#03060F] p-4">
      <div className="max-w-md w-full">
        <ErrorDisplay 
          message={error.message || "An unexpected application error occurred."} 
          variant="error"
          onRetry={() => reset()}
        />
      </div>
    </div>
  );
}
