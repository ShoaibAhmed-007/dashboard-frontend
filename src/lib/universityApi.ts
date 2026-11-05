/**
 * University API client
 *
 * Separate from the main dashboard `api` client because:
 * - University API is an independent service on its own port/host
 * - No workspace header — University API does not accept x-workspace-id
 * - Error envelopes follow the University normalized shape (01-foundations.md)
 * - Bearer token is the same dashboard-issued JWT, attached here independently
 *
 * Base URL must already include /api/v1 per 01-foundations.md.
 */

import axios, { type AxiosError } from "axios";
import { getAccessToken } from "@/stores/auth.store";
import { refreshSession, redirectToLogin } from "@/lib/api";

const UNIVERSITY_BASE =
  process.env.NEXT_PUBLIC_UNIVERSITY_API_URL ?? "http://localhost:3003/api/v1";

export const universityApi = axios.create({
  baseURL: UNIVERSITY_BASE,
  withCredentials: true, // required for CloudFront signed-cookie delivery
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request: attach dashboard bearer token ────────────────────────────────────
universityApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: refresh-on-401 ──────────────────────────────────────────────────
// Mirrors src/lib/api.ts's interceptor — reuses the same single-flight
// refreshSession() so a University API 401 doesn't trigger a duplicate
// /auth/refresh call if one is already in flight from the main api client.
universityApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config;

    // Already retried once with a freshly-refreshed token and still got a 401.
    // refreshSession() already proved the session itself is fine, so this is
    // this endpoint's own problem — don't force a global logout for it.
    if (error.response?.status !== 401 || originalConfig?._retry) {
      return Promise.reject(error);
    }

    originalConfig._retry = true;

    try {
      const { accessToken } = await refreshSession();
      originalConfig.headers.Authorization = `Bearer ${accessToken}`;
      return universityApi(originalConfig);
    } catch {
      redirectToLogin();
      return Promise.reject(error);
    }
  }
);

// ── Types ─────────────────────────────────────────────────────────────────────

/** Single-item success envelope — { data: T } */
export interface UniversityEnvelope<T> {
  data: T;
}

/** Paginated success envelope — { data: T[], meta } */
export interface UniversityPaginatedEnvelope<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** Normalized error shape from 01-foundations.md */
export interface UniversityApiError {
  message: string;
  code: string;
  httpStatus: number;
  details: { field: string; message: string }[] | null;
}

// ── Error parser ──────────────────────────────────────────────────────────────
/**
 * Parses the University API normalized error envelope per 01-foundations.md.
 * Branch on httpStatus for 401 / 403 / 422 / 429 handling in callers.
 */
export function parseUniversityError(error: unknown): UniversityApiError {
  if (!axios.isAxiosError(error)) {
    return { message: "Something went wrong", code: "UNKNOWN", httpStatus: 0, details: null };
  }

  const axiosErr = error as AxiosError<{
    error?: { code?: string; message?: string; details?: { field: string; message: string }[] };
  }>;

  if (!axiosErr.response) {
    return { message: "Cannot connect to University API. Is it running on port 3003?", code: "NETWORK_ERROR", httpStatus: 0, details: null };
  }

  const status = axiosErr.response.status;
  const body = axiosErr.response.data;

  const statusCodeMap: Record<number, string> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "REQUEST_FAILED",
    500: "INTERNAL_SERVER_ERROR",
  };

  if (body?.error && typeof body.error === "object") {
    return {
      message: body.error.message ?? "Something went wrong",
      code: body.error.code ?? statusCodeMap[status] ?? "UNKNOWN",
      httpStatus: status,
      details: body.error.details ?? null,
    };
  }

  return {
    message: axiosErr.response.statusText || "Something went wrong",
    code: statusCodeMap[status] ?? "UNKNOWN",
    httpStatus: status,
    details: null,
  };
}

// ── Envelope helpers ──────────────────────────────────────────────────────────

/** GET and unwrap single { data } envelope */
export async function uGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await universityApi.get<UniversityEnvelope<T>>(path, { params });
  return res.data.data;
}

/** GET and return full paginated { data[], meta } envelope */
export async function uGetPaginated<T>(
  path: string,
  params?: Record<string, unknown>
): Promise<UniversityPaginatedEnvelope<T>> {
  const res = await universityApi.get<UniversityPaginatedEnvelope<T>>(path, { params });
  return res.data;
}

/** POST and unwrap single { data } envelope */
export async function uPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await universityApi.post<UniversityEnvelope<T>>(path, body);
  return res.data.data;
}
