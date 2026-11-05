"use client";

import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

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

function CallbackHandler() {
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const token = searchParams.get("token");
    const role = searchParams.get("role") ?? undefined;

    if (!token) {
      window.location.replace("/signin?error=oauth_failed");
      return;
    }

    // Fetch the real user profile using the token from the URL.
    // Pass Authorization explicitly so we don't depend on the Zustand store
    // being updated before this request fires.
    api
      .get<{
        id: string;
        fullName: string;
        email: string;
        avatarUrl: string | null;
        avatarColor: string;
      }>("/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        setAuth(token, {
          id: data.id,
          fullName: data.fullName,
          email: data.email,
          avatarUrl: data.avatarUrl,
          avatarColor: data.avatarColor,
        }, role);
        window.location.replace("/");
      })
      .catch(() => {
        // Profile fetch failed — store the token at minimum so the user lands
        // on the portal select. The next page load will restore the full profile.
        setAuth(token, {
          id: "",
          fullName: "User",
          email: "",
          avatarUrl: null,
          avatarColor: "#6366f1",
        }, role);
        window.location.replace("/");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Spinner />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackHandler />
    </Suspense>
  );
}
