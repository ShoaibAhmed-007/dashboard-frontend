import { create } from "zustand";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role?: string | null;
  avatarUrl: string | null;
  avatarColor: string;
  /** Company-wide flag, not workspace-scoped. Only true for the platform
   *  admin (set directly in the DB); gates the accounting-access dropdown
   *  in Workspace Settings. */
  isPlatformAdmin?: boolean;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  role: string | null;
  setAuth: (token: string, user: AuthUser, role?: string) => void;
  clearAuth: () => void;
}

// ── sessionStorage helpers ────────────────────────────────────────────────────
// Access token is stored in sessionStorage so it survives page refreshes within
// the same tab but is cleared when the tab closes. The stored expiry lets us
// skip calling /auth/refresh when the token is still valid.

const SESSION_TOKEN_KEY = "access_token";
const SESSION_EXPIRY_KEY = "access_token_expiry";
// Persists in localStorage so it survives tab closes and browser restarts.
// Set on login/register/token refresh, cleared only on explicit logout.
// AuthContext uses this to decide whether to attempt a silent refresh on mount.
const SESSION_EXISTS_KEY = "session_exists";

export function markSessionExists(): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SESSION_EXISTS_KEY, "1"); } catch { /* ignore */ }
}

export function clearSessionExists(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(SESSION_EXISTS_KEY); } catch { /* ignore */ }
}

export function hasSessionExists(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(SESSION_EXISTS_KEY) === "1"; } catch { return false; }
}

function readTokenFromSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const expiry = sessionStorage.getItem(SESSION_EXPIRY_KEY);
    if (!token || !expiry) return null;
    // Treat as expired 30 s early to avoid edge-case races
    if (Date.now() >= Number(expiry) - 30_000) {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_EXPIRY_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function writeTokenToSession(token: string): void {
  if (typeof window === "undefined") return;
  try {
    // Decode expiry from the JWT payload (no verification needed — server verifies)
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expiryMs = (payload.exp as number) * 1000;
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    sessionStorage.setItem(SESSION_EXPIRY_KEY, String(expiryMs));
  } catch {
    // Malformed token — store without expiry tracking; will refresh on next load
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
  }
}

function clearTokenFromSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
  } catch {
    // ignore
  }
}

// ── Zustand store ─────────────────────────────────────────────────────────────
// Access token is initialised from sessionStorage so page refreshes don't
// require a /auth/refresh round-trip when a valid token is already cached.

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: readTokenFromSession(),
  user: null,
  role: null,

  setAuth: (accessToken, user, role) => {
    writeTokenToSession(accessToken);
    markSessionExists();
    set({ accessToken, user, role: role ?? null });
  },

  clearAuth: () => {
    clearTokenFromSession();
    clearSessionExists();
    set({ accessToken: null, user: null, role: null });
  },
}));

// Helpers used by the axios interceptor (outside React tree)
export const getAccessToken = () => useAuthStore.getState().accessToken;

export const setAccessToken = (token: string) => {
  writeTokenToSession(token);
  markSessionExists();
  useAuthStore.setState((s) => ({ ...s, accessToken: token }));
};

export const clearAccessToken = () => {
  clearTokenFromSession();
  clearSessionExists();
  useAuthStore.setState((s) => ({ ...s, accessToken: null, user: null }));
};
