import type { Currency } from "@/services/accounting.service";

/**
 * Fixed colour per currency so a donut and its legend always agree. Covers
 * all seven `Currency` values — without an entry a slice falls back to grey,
 * and several grey slices at once are indistinguishable from each other.
 */
export const CURRENCY_COLORS: Record<Currency, string> = {
  USD: "#6366f1",
  HKD: "#22c55e",
  PKR: "#f59e0b",
  AED: "#06b6d4",
  EUR: "#ec4899",
  GBP: "#8b5cf6",
  CRYPTO: "#64748b",
};

/** Falls back to grey for a code the API added that this map doesn't know yet. */
export function currencyColor(code: string): string {
  return CURRENCY_COLORS[code as Currency] ?? "#94a3b8";
}
