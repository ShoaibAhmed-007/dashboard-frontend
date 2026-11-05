import { parseApiError } from "@/lib/api";

/**
 * Reshapes a 422's `errors: [{ field, message }]` into a map keyed by field,
 * so a form can render each message beside the input it belongs to instead of
 * dropping them all into one banner.
 *
 * Returns an empty object for any other failure — a network error, a 409, a
 * 422 with no per-field detail — so the caller can fall back to its general
 * error line by checking whether the map is empty.
 */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  const { details } = parseApiError(error);
  if (!details) return {};

  const map: Record<string, string> = {};
  for (const detail of details) {
    // Keep the first message per field: the API sends them most-specific
    // first, and stacking several under one input reads as noise.
    if (detail?.field && !map[detail.field]) {
      map[detail.field] = detail.message;
    }
  }
  return map;
}
