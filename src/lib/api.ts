import axios from "axios";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/stores/auth.store";
import { getActiveWorkspaceId } from "@/stores/workspace.store";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // sends httpOnly refresh_token cookie automatically
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Attach access token + active workspace id on every outgoing request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const workspaceId = getActiveWorkspaceId();
  if (workspaceId) {
    config.headers["x-workspace-id"] = workspaceId;
  }

  return config;
});

// ── Shared refresh session ────────────────────────────────────────────────────
// Single in-flight promise shared by every caller (this interceptor,
// universityApi.ts, the socket clients, the SSE streams, and AuthContext).
// This guarantees only ONE /auth/refresh HTTP call fires at a time per tab,
// preventing rotating-token reuse errors when multiple callers race to refresh.
export interface RefreshResult {
  accessToken: string;
  user: import("@/stores/auth.store").AuthUser;
}

let _refreshPromiseFull: Promise<RefreshResult> | null = null;

// The refresh_token cookie is shared across every tab of this origin, and the
// backend rotates it on each use (old token deleted immediately, no reuse
// grace period). Without this lock, two tabs whose access tokens expire
// around the same moment can both fire /auth/refresh with the same cookie;
// the loser presents an already-consumed token and gets rejected. The Web
// Locks API serializes the network call across tabs — the delayed tab still
// succeeds afterwards because it picks up the already-rotated cookie.
function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    return fn();
  }
  return navigator.locks.request("auth-refresh-lock", fn) as Promise<T>;
}

export function refreshSession(): Promise<RefreshResult> {
  if (!_refreshPromiseFull) {
    _refreshPromiseFull = withCrossTabLock(() =>
      api.post<RefreshResult>("/auth/refresh").then((res) => {
        setAccessToken(res.data.accessToken);
        return res.data;
      })
    ).finally(() => {
      _refreshPromiseFull = null;
    });
  }
  return _refreshPromiseFull;
}

export function redirectToLogin() {
  clearAccessToken();
  if (typeof window !== "undefined") {
    window.location.href = "/signin";
  }
}

// ── 401 interceptor ───────────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config;
    const url: string = originalConfig?.url ?? "";

    // These endpoints must NEVER trigger a silent refresh — they handle 401
    // as a normal business error (wrong credentials, expired OTP, etc.)
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/verify-email") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password") ||
      url.includes("/auth/google") ||
      // Kept for /user/change-password, which legitimately 401s on a wrong
      // current password and must not trigger a refresh-and-retry loop.
      url.includes("/password");

    // Pass non-401 errors and auth-endpoint 401s straight through
    if (error.response?.status !== 401 || isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Already retried once with a freshly-refreshed token and still got a 401.
    // That means this specific endpoint has its own problem — refreshSession()
    // already proved the session itself is fine — so don't force a global
    // logout, just let the error surface normally to whoever made this call.
    if (originalConfig._retry) {
      return Promise.reject(error);
    }

    // No token in memory → user was never authenticated in this session.
    // There is nothing to refresh, skip straight to login.
    if (!getAccessToken()) {
      redirectToLogin();
      return Promise.reject(error);
    }

    // Mark this request so we don't retry it again
    originalConfig._retry = true;

    try {
      // Deduplicate — shares the same in-flight refresh as every other
      // caller (universityApi, sockets, SSE streams), so a 401 here never
      // races a second, independent /auth/refresh call against them.
      const { accessToken } = await refreshSession();

      // Retry original request with the fresh token
      originalConfig.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalConfig);
    } catch {
      // Refresh failed — cookie expired or missing, send user to login
      redirectToLogin();
      return Promise.reject(error);
    }
  }
);

// ── Error parser ──────────────────────────────────────────────────────────────
// Normalises both backend error shapes into one consistent object.
//
// Shape 1 — custom envelope: { success: false, error: { code, message, details } }
// Shape 2 — bare NestJS:    { statusCode, message, errors? }
//            (422 includes: errors: [{ field, message }])
/**
 * One readable line for a 422 `{ field, message }` entry, e.g.
 * "Description must be 1000 characters or fewer" instead of the raw
 * "Too big: expected string to have <=1000 characters".
 */
function formatFieldError(detail: { field?: string; message?: string }): string {
  const raw = detail?.message ?? "";
  const tooBig = raw.match(/^Too big: expected string to have <=(\d+) characters?$/);
  const text = tooBig ? `must be ${tooBig[1]} characters or fewer` : raw;
  // Only plain field names get a label; nested paths like "tasks.0.title" would read as noise.
  const field = detail?.field;
  if (!field || !/^[A-Za-z]+$/.test(field)) return raw || text;
  const label = field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  const sentence = `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  return tooBig ? `${sentence} ${text}` : `${sentence}: ${text}`;
}

export function parseApiError(error: unknown): {
  message: string;
  code: string;
  details: { field: string; message: string }[] | null;
} {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return {
        message: "Cannot connect to server. Is the backend running?",
        code: "NETWORK_ERROR",
        details: null,
      };
    }

    const data = error.response.data;
    const status = error.response.status;

    const codeMap: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
      429: "TOO_MANY_REQUESTS",
      500: "INTERNAL_ERROR",
    };

    // Shape 1
    if (data?.error && typeof data.error === "object") {
      return {
        message: data.error.message ?? "Something went wrong",
        code: data.error.code ?? codeMap[status] ?? "UNKNOWN",
        details: data.error.details ?? null,
      };
    }

    // Shape 2
    if (data?.message) {
      const raw = data.message;

      /* `message` is not always a string. Nest's own errors send a string (or
         an array of them), but some endpoints throw a structured
         `{ code, message }` — e.g. PROJECT_NOT_FOUND, USER_NOT_PROJECT_MEMBER.
         Returning that object raw made every `toast.error(message)` render
         "[object Object]", so unwrap it to its inner string here.

         Only the *message* is unwrapped, deliberately: `code` stays derived
         from the HTTP status, because callers across the app compare it
         against status names ("CONFLICT", "FORBIDDEN", "NOT_FOUND", ...) and
         letting a nested code win would silently break those. Use
         `getApiErrorCode()` when you need the structured code. */
      const msg: string = Array.isArray(raw)
        ? raw.join(". ")
        : typeof raw === "string"
          ? raw
          : typeof raw?.message === "string"
            ? raw.message
            : "Something went wrong";

      const details: { field: string; message: string }[] | null =
        Array.isArray(data.errors) && data.errors.length > 0
          ? data.errors
          : null;

      /* A 422's `message` is just the generic "Validation failed"; the useful
         part is in `errors`. Surface it so every `toast.error(message)` caller
         shows what is actually wrong. `details` is untouched for callers that
         render per-field errors. */
      const detailMessage =
        status === 422 && details?.[0] ? formatFieldError(details[0]) : null;

      return {
        message: detailMessage ?? msg,
        code: codeMap[status] ?? "UNKNOWN",
        details,
      };
    }

    return {
      message: error.response.statusText || "Something went wrong",
      code: codeMap[status] ?? "UNKNOWN",
      details: null,
    };
  }

  return {
    message: "Something went wrong",
    code: "UNKNOWN",
    details: null,
  };
}

/**
 * The *structured* error code some endpoints send as `message: { code, message }`
 * — distinct from `parseApiError().code`, which is derived from the HTTP status.
 *
 * Use this to branch on a specific server condition (`PROJECT_NOT_FOUND`,
 * `USER_NOT_PROJECT_MEMBER`, ...); use `parseApiError` for the human-readable
 * text and the status-shaped code.
 */
export function getApiErrorCode(error: unknown): string | null {
  const err = error as { response?: { status?: number; data?: unknown } } | null;
  if (err?.response?.status === 429) return "RESET_REQUEST_RATE_LIMITED";
  const payload = err?.response?.data ?? error;
  const p = payload as { message?: { code?: string }; code?: string } | null;
  return p?.message?.code ?? p?.code ?? null;
}
