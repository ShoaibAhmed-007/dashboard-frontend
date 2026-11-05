"use client";

import { refreshSession } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

/** Where to land when the sender didn't say: the portal picker, like a fresh sign-in. */
const DEFAULT_DESTINATION = "/portal-select";

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        <p className="text-sm text-gray-500">Signing you in...</p>
      </div>
    </div>
  );
}

/** Only same-origin paths — a `next` of `//evil.com` or `https://…` would be an open redirect. */
function safeDestination(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return DEFAULT_DESTINATION;
  }
  return raw;
}

/**
 * Landing point for a sign-in that happened on another Dashboard site (the
 * marketing website). That login already set the httpOnly `refresh_token`
 * cookie on the API, so there is nothing to carry in the URL: exchange the
 * cookie for an access token here, exactly as a returning visitor's session
 * restore does. `AuthContext` can't do it on its own because it only tries a
 * restore when this origin has seen a login before (`session_exists`), which a
 * login elsewhere can't set.
 */
function ContinueHandler() {
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  // Refresh tokens rotate on use, so a second call (React StrictMode runs
  // effects twice in dev) would present an already-consumed token.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    refreshSession()
      .then((data) => {
        setAuth(data.accessToken, data.user, data.user.role ?? undefined);
        window.location.replace(safeDestination(searchParams.get("next")));
      })
      .catch(() => {
        window.location.replace("/signin?error=session_expired");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Spinner />;
}

export default function AuthContinuePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ContinueHandler />
    </Suspense>
  );
}
