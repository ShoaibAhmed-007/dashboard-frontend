"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Catches render/runtime errors thrown below the root
 * layout and shows a recoverable UI instead of the raw white "application error"
 * screen. Rendered inside the app shell, so it can use Tailwind + dark mode.
 *
 * Also auto-recovers from ChunkLoadError (stale deploy / CDN) by reloading once.
 */
function isChunkLoadError(error: Error): boolean {
  return (
    error?.name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(error?.message || "") ||
    /Loading CSS chunk/i.test(error?.message || "") ||
    /import.*failed/i.test(error?.message || "")
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", { message: error?.message, digest: error?.digest, stack: error?.stack });

    if (typeof window !== "undefined" && isChunkLoadError(error)) {
      const KEY = "chunk-reload-attempt";
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center bg-white dark:bg-gray-900">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Something went wrong</h1>
      <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
        The page failed to load. This is usually temporary — reloading normally fixes it.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            try {
              sessionStorage.removeItem("chunk-reload-attempt");
            } catch {}
            reset();
          }}
          className="rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6d28d9]"
        >
          Try again
        </button>
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          Go home
        </button>
      </div>
    </div>
  );
}
