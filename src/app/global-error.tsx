"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary. Catches errors thrown in the root layout / providers
 * (anything the route-level error.tsx can't reach). Must render its own <html>/<body>.
 *
 * Also auto-recovers from ChunkLoadError — the most common cause of the generic
 * "application error: a client-side exception has occurred" white screen on
 * production, which happens when a browser/CDN holds stale HTML that points at
 * JS chunks removed by a newer deploy. We reload once (guarded by sessionStorage
 * so we never loop) to fetch the fresh HTML + chunks.
 */
function isChunkLoadError(error: Error): boolean {
  return (
    error?.name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(error?.message || "") ||
    /Loading CSS chunk/i.test(error?.message || "") ||
    /import.*failed/i.test(error?.message || "")
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the real, unminified-as-possible error so production incidents are diagnosable.
    // digest is the server-generated id you can correlate with server logs.
    console.error("[global-error]", { message: error?.message, digest: error?.digest, stack: error?.stack });

    if (typeof window !== "undefined" && isChunkLoadError(error)) {
      const KEY = "chunk-reload-attempt";
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
            padding: "24px",
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            textAlign: "center",
            background: "#ffffff",
            color: "#1f2937",
          }}
        >
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: 0, maxWidth: "420px" }}>
            The page failed to load. This is usually temporary — reloading normally fixes it.
          </p>
          <button
            onClick={() => {
              try {
                sessionStorage.removeItem("chunk-reload-attempt");
              } catch {}
              reset();
            }}
            style={{
              border: "none",
              borderRadius: "8px",
              background: "#7C3AED",
              color: "#ffffff",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
