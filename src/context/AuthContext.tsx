"use client";

import { api, refreshSession } from "@/lib/api";
import { AuthUser, useAuthStore, hasSessionExists } from "@/stores/auth.store";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { clearPersistedQueryCache } from "@/lib/queryPersister";
import { clearPersistedTaskCaches } from "@/stores/clearTaskCaches";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const AUTH_PAGES = ["/signin", "/signup", "/forgot-password", "/verify-otp", "/verify-email", "/reset-password", "/auth/callback", "/auth/continue"];

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** true while the initial session restore is in-flight */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<string>;
  verifyEmail: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user, setAuth, clearAuth } = useAuthStore();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // On auth pages (signin, signup) there is no session to restore — skip entirely
    if (AUTH_PAGES.some((p) => pathname.startsWith(p))) {
      setIsLoading(false);
      return;
    }

    const state = useAuthStore.getState();

    if (state.accessToken && state.user) {
      // Token + user already in memory (same-tab navigation) — nothing to do
      setIsLoading(false);
      return;
    }

    if (state.accessToken && !state.user) {
      // Token survived page refresh via sessionStorage but user profile was lost.
      // Re-fetch profile only — no need to hit /auth/refresh.
      api
        .get<AuthUser>("/user/profile")
        .then(({ data }) => {
          setAuth(state.accessToken!, data, data.role ?? undefined);
        })
        .catch(() => {
          clearAuth();
          refreshSession()
            .then((data) => setAuth(data.accessToken, data.user, data.user.role ?? undefined))
            .catch(() => clearAuth());
        })
        .finally(() => setIsLoading(false));
      return;
    }

    // No token — only attempt refresh if the user has logged in before in this
    // tab. If session_exists is absent they were never authenticated (or explicitly
    // logged out), so go straight to the loading=false state; the route guard or
    // middleware will redirect to /signin.
    if (!hasSessionExists()) {
      setIsLoading(false);
      return;
    }

    refreshSession()
      .then((data) => setAuth(data.accessToken, data.user, data.user.role ?? undefined))
      .catch(() => clearAuth())
      .finally(() => setIsLoading(false));

  // Run once on mount only — deps array intentionally empty
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<{ user: AuthUser; accessToken: string }>(
        "/auth/login",
        { email, password }
      );
      setAuth(data.accessToken, data.user, data.user.role ?? undefined);
    },
    [setAuth]
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const { data } = await api.post<{ message: string }>(
        "/auth/register",
        { fullName, email, password }
      );
      return data.message;
    },
    []
  );

  const verifyEmail = useCallback(
    async (email: string, otp: string) => {
      const { data } = await api.post<{ user: AuthUser; accessToken: string }>(
        "/auth/verify-email",
        { email, otp }
      );
      setAuth(data.accessToken, data.user, data.user.role ?? undefined);
      // Accounting access is per-workspace now and resolves asynchronously, so
      // it can't steer this redirect. Everyone lands on the portal picker; the
      // accounting rail appears once workspace membership loads.
      window.location.replace("/portal-select");
    },
    [setAuth]
  );

  const logout = useCallback(async () => {
    try {
      // Invalidates the refresh_token cookie server-side.
      // Returns 200 even if the cookie is already gone — safe to always call.
      await api.post("/auth/logout");
    } catch {
      // Swallow errors — we always clear local state regardless
    } finally {
      clearAuth();
      // Defensive: the hard navigation below already drops the in-memory
      // QueryClient today, but clear explicitly so a future switch to
      // client-side redirect can't leak cached data into the next session.
      queryClient.clear();
      // The persisted caches live in IndexedDB and survive navigation/reload,
      // so they must be wiped explicitly or the next user on this browser would
      // restore the previous user's task data before their own loads.
      void clearPersistedQueryCache();
      clearPersistedTaskCaches();
      // Hard navigation so the middleware re-evaluates with the cleared cookie
      // and no RSC prefetch races occur. router.replace would trigger an RSC
      // fetch against the protected route before the redirect completes.
      window.location.replace("/signin");
    }
  }, [clearAuth, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!accessToken,
        isLoading,
        login,
        register,
        verifyEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
