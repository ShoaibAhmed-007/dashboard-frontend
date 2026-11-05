import type { Currency } from "@/services/accounting.service";

// Shared formatting helpers for the accounting screens. Payment platforms were
// removed from the data model — a transaction now records only the bank account
// it debits or credits — so the platform logo/colour table that used to live
// here is gone with it. Bank avatars come from `BankAccount.logoUrl`, falling
// back to generated initials (see ./avatar).

const FALLBACK_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

/**
 * The panel/card surface every accounting screen sits its content on. Shared
 * so a change to the border or dark-mode background lands everywhere at once
 * rather than drifting per screen.
 */
export const CARD_CLASS =
  "rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-901";

/** Stable colour per string so the same platform/bank always renders alike. */
export function colorFromString(value: string): string {
  const sum = value
    .split("")
    .reduce((total, letter) => total + letter.charCodeAt(0), 0);
  return FALLBACK_COLORS[sum % FALLBACK_COLORS.length];
}

/** `USD 1,234.56` — money formatting shared across the accounting screens. */
export function formatMoney(currency: Currency | string, amount: number): string {
  return `${currency} ${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

/** Renders a per-currency total list as `PKR 8,165,000 · USD 1,200`. */
export function formatCurrencyTotals(
  totals: { currency: Currency; total: number }[]
): string {
  if (totals.length === 0) return "—";
  return totals.map((entry) => formatMoney(entry.currency, entry.total)).join(" · ");
}

/**
 * Formats an ISO timestamp as `04 Aug 2026`, in UTC — matches how the API
 * interprets whole-day values, so a sale date never renders off by one.
 */
export function formatIsoDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * `YYYY-MM-DD` for an `<input type="date">`, read in UTC.
 *
 * `saleDate` is a whole-day value semantically, and the API expands a bare
 * `YYYY-MM-DD` to UTC day boundaries — so reading it back in UTC keeps a sale
 * dated the 4th from displaying as the 3rd for users behind UTC.
 */
export function toDateInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Today as `YYYY-MM-DD` in UTC, to pair with `toDateInputValue`. */
export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * `YYYY-MM-DD` from a date input → midday-UTC ISO datetime. Midday rather than
 * midnight so the calendar date survives a timezone shift in either direction.
 */
export function fromDateInputValue(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Formats an ISO timestamp as `04 Aug 2026, 14:30`. */
export function formatIsoDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
