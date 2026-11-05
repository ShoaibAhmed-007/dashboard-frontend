import { api } from "@/lib/api";
import { parseContentDispositionFilename } from "@/lib/download";

// ── Envelopes ─────────────────────────────────────────────────────────────────
// The accounting modules use the app's standard response envelope. Every one of
// these endpoints is workspace-scoped and requires the `x-workspace-id` header
// the axios interceptor attaches unconditionally — a request without it 403s.

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface AccountingMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface PaginatedApiWrapper<T> extends ApiWrapper<T> {
  meta: AccountingMeta;
}

export interface Paginated<T> {
  items: T[];
  meta: AccountingMeta;
}

// ── Shared enums ──────────────────────────────────────────────────────────────

/**
 * Backend `Currency` enum — all seven values the API accepts, verified against
 * the server's own validator. Source of truth is `enum Currency` in
 * `prisma/schema.prisma`, mirrored by `CURRENCY_VALUES` in
 * `transaction.constants.ts`; each value has a matching `EXCHANGE_RATES_TO_USD`
 * entry (`CRYPTO` is a 1:1 placeholder, not a real rate).
 */
export const CURRENCIES = ["USD", "HKD", "PKR", "AED", "EUR", "GBP", "CRYPTO"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Backend `AccountType` enum for bank accounts. */
export const ACCOUNT_TYPES = ["LOCAL", "INTERNATIONAL"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * The only currency a LOCAL account deals in — the business operates in
 * Pakistan, so "local" means PKR by definition.
 *
 * For **transactions this is server-enforced**: posting a non-PKR sale to a
 * LOCAL account returns `400 "A LOCAL bank account only accepts PKR
 * transactions"`. An INTERNATIONAL account is currency-agnostic and accepts
 * anything, PKR included (verified live).
 *
 * For **bank accounts themselves** it remains a frontend-only convention:
 * `POST /bank-accounts` will accept any currency for either type, so this
 * stops nonsense being entered by hand rather than mirroring a server rule.
 */
export const LOCAL_CURRENCY = "PKR" satisfies Currency;

/**
 * The currencies a **commission** may be entered in.
 *
 * Deliberately narrower than {@link CURRENCIES}: the API accepts the full
 * `CURRENCY_VALUES` enum for `commissionCurrency`, but commission is only ever
 * paid in USD or PKR, so offering AED/EUR/HKD/CRYPTO would invite entries the
 * business does not actually make. The server converts whatever is sent to PKR
 * for storage either way — this is a product constraint, not a server one.
 */
export const COMMISSION_CURRENCIES = ["PKR", "USD"] as const satisfies readonly Currency[];
export type CommissionCurrency = (typeof COMMISSION_CURRENCIES)[number];

/**
 * Currencies a **bank account itself** can be denominated in. INTERNATIONAL
 * excludes PKR, since a PKR-denominated account is by definition a local one.
 * Frontend convention only — the API accepts any pairing.
 */
export function currenciesForAccountType(accountType: AccountType): readonly Currency[] {
  return accountType === "LOCAL"
    ? [LOCAL_CURRENCY]
    : CURRENCIES.filter((code) => code !== LOCAL_CURRENCY);
}

/**
 * Currencies a **transaction** may be recorded in against an account of this
 * type — a different question from what the account is denominated in.
 *
 * INTERNATIONAL returns every currency, PKR included: such an account can
 * legitimately receive a PKR sale (verified live), so excluding it would block
 * a valid entry. LOCAL is PKR-only, and that one *is* enforced server-side.
 */
export function transactionCurrenciesForAccountType(
  accountType: AccountType
): readonly Currency[] {
  return accountType === "LOCAL" ? [LOCAL_CURRENCY] : CURRENCIES;
}

export type SortOrder = "asc" | "desc";

// ── Entities ──────────────────────────────────────────────────────────────────

/** Per-currency sale total, as returned in `Clients.totalSaleAmount`. */
export interface CurrencyTotal {
  currency: Currency;
  total: number;
}

export interface AccountingClient {
  id: string;
  clientName: string;
  /**
   * @deprecated Legacy hand-typed figure, frozen at `0` for every client
   * created since the backend stopped accepting it. Never updates as sales
   * come in — bind anything labelled "Total Revenue" to `totalRevenueUsd`.
   */
  totalRevenue: number;
  /** @deprecated Always `null` on newly created clients; revenue is USD. */
  currencyType: Currency | null;
  /**
   * Every currency in `totalSaleAmount` converted at live FX and summed. The
   * real, transaction-derived revenue figure — always USD.
   */
  totalRevenueUsd: number;
  /** Summed from this client's transactions, grouped by currency. */
  totalSaleAmount: CurrencyTotal[];
  _count: { transactions: number };
  createdAt: string;
  updatedAt: string;
  /**
   * Every linked transaction, newest first. `GET /clients` embeds these on
   * each row now, not just `GET /clients/:id` — so the list is enough to open
   * a per-client transaction view without a second request.
   *
   * Unpaginated on the backend by design, so a client with a very long history
   * returns all of it. Optional here so an older API build degrades to an
   * empty list rather than crashing the table.
   */
  transactions?: ClientTransaction[];
}

/** A client's nested transaction, as returned by `GET /clients`. */
export interface ClientTransaction {
  id: string;
  saleAmount: number;
  currency: Currency;
  refId: string;
  description: string | null;
  saleDate: string;
  createdAt: string;
  updatedAt: string;
  /** The account the payment came in through — the closest thing to a
   *  "payment method" now that there's no PaymentPlatform enum. */
  bankAccount: { id: string; bankName: string; logoUrl: string | null };
}

export interface AccountingClientDetail extends AccountingClient {
  transactions: ClientTransaction[];
}

/** Minimal shape returned by `GET /clients/search`. */
export interface ClientSearchResult {
  id: string;
  clientName: string;
}

/**
 * One sale an employee earned commission on. Mirrors {@link ClientTransaction}
 * plus `commissionAmount`, which is the reason the list exists on an employee
 * at all: *which* sale a given PKR figure came from.
 */
export interface EmployeeTransaction {
  id: string;
  clientName: string;
  saleAmount: number;
  currency: Currency;
  refId: string;
  description: string | null;
  saleDate: string;
  /** PKR earned on this specific sale. */
  commissionAmount: number;
  createdAt: string;
  updatedAt: string;
  bankAccount: { id: string; bankName: string; logoUrl: string | null };
}

/**
 * `paidCommission`/`pendingCommission` are two manually entered PKR figures on
 * the employee itself, plus a server-computed sum. They are **stored** in PKR
 * only — the model has no currency column — but each carries a `*Usd` sibling
 * computed at read time from the live rate, for display alongside the PKR
 * figure. Writes are always PKR.
 *
 * `transactions` is the employee's sales, embedded on **every** response
 * (create, list, get-one, update) — not detail-only — so a list view can show
 * a sale count without a second call. Commission sync is fully reversible: a
 * transaction's commission is applied on create, re-applied as a delta on
 * edit, and unwound on delete, so these figures track their transactions
 * without manual correction.
 *
 * The same shape comes back from create, list, get-one and update.
 */
export interface AccountingEmployee {
  id: string;
  name: string;
  /** PKR. Manually entered, never negative. */
  paidCommission: number;
  /** Server-computed USD equivalent of `paidCommission`, at the live rate.
   *  Optional so an older API build degrades to hiding the USD figure. */
  paidCommissionUsd?: number;
  /** PKR. Manually entered, never negative. */
  pendingCommission: number;
  /** Server-computed USD equivalent of `pendingCommission`. */
  pendingCommissionUsd?: number;
  /**
   * **Read-only.** `paid + pending`, recomputed server-side on every read, so
   * it cannot drift. Sending it is ignored — never put it in a payload.
   */
  totalCommission: number;
  /** Server-computed USD equivalent of `totalCommission`. */
  totalCommissionUsd?: number;
  /** How many sales are credited to this employee. */
  _count?: { transactions: number };
  /** The sales themselves, newest first. */
  transactions?: EmployeeTransaction[];
  createdAt: string;
  updatedAt: string;
}

/** Minimal shape returned by `GET /employees/search`. */
export interface EmployeeSearchResult {
  id: string;
  name: string;
}

/**
 * A vendor is a name and one amount owed — nothing else. Deliberately shaped
 * like {@link AccountingEmployee}, but with a single figure rather than a
 * paid/pending pair, and no computed total to display alongside it.
 *
 * No relation to `Transaction`: `pendingPayment` is manual, never derived from
 * a purchase or sale.
 */
export interface AccountingVendor {
  id: string;
  name: string;
  /** PKR. Manually entered, never negative, defaults to 0. */
  pendingPayment: number;
  /** ISO datetime for when `pendingPayment` is due, or null if none is set.
   *  Purely informational server-side — no reminder or overdue logic exists,
   *  so any "overdue" styling is a frontend-only reading of this date. */
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Minimal shape returned by `GET /vendors/search`. */
export interface VendorSearchResult {
  id: string;
  name: string;
}

export interface AccountingTransaction {
  id: string;
  clientId: string;
  /** Denormalized snapshot of the client's name at creation time. */
  clientName: string;
  /** The bank account this transaction credits. */
  bankAccountId: string;
  currency: Currency;
  saleAmount: number;
  refId: string;
  description: string | null;
  /** When the sale actually happened — distinct from `createdAt` (row insert). */
  saleDate: string;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; clientName: string };
  /** `logoUrl` may be absent on older responses — fall back to initials. */
  bankAccount?: { id: string; bankName: string; logoUrl?: string | null };
  /** Who gets credited for this sale. Null on most historical transactions —
   *  not every sale has an employee attached. */
  employeeId?: string | null;
  employee?: { id: string; name: string } | null;
  /** PKR, manually entered — never computed from saleAmount. Paired with
   *  `employeeId`: both set together, or neither. */
  commissionAmount?: number | null;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountType: AccountType;
  currencyType: Currency;
  amount: number;
  /** Public S3 URL set via the logo-presign flow. Null when no logo uploaded. */
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Payloads ──────────────────────────────────────────────────────────────────

/**
 * `POST /clients` accepts `clientName` and nothing else. A sent
 * `totalRevenue`/`currencyType` is silently discarded (still a 201), so those
 * fields are omitted here rather than typed as optional — revenue is derived
 * from transactions, never entered.
 */
export interface CreateClientPayload {
  clientName: string;
}

/** `PATCH /clients/:clientId` accepts `clientName` only. */
export interface UpdateClientPayload {
  clientName: string;
}

export interface CreateTransactionPayload {
  /** Must resolve to an existing client — the API no longer accepts a bare name. */
  clientId: string;
  /** Required. Must exist in the current workspace, and its `currencyType` must
   *  match `currency` exactly — the API 400s on a mismatch (no FX conversion).
   *  Creating a transaction increments this account's balance by `saleAmount`. */
  bankAccountId: string;
  refId: string;
  saleAmount: number;
  currency: Currency;
  /** ISO datetime. Omit to default to now; set it to backdate a late entry. */
  saleDate?: string;
  description?: string;
  /** Who gets credited for this sale. Optional — not every sale has one, but
   *  it must be sent together with `commissionAmount` or not at all (422). */
  employeeId?: string;
  /** Manually entered — never computed from saleAmount. Paired with
   *  `employeeId`, and denominated in `commissionCurrency`. */
  commissionAmount?: number;
  /** The currency `commissionAmount` is entered in; defaults to PKR.
   *
   *  Write-only: the server converts once at write time and stores PKR, so this
   *  never comes back on a read. The transaction's own `currency` is separate —
   *  a USD sale can carry a PKR commission and vice versa. */
  commissionCurrency?: CommissionCurrency;
}

export interface UpdateTransactionPayload {
  clientId?: string;
  /** Send alongside `clientId` on a reassignment — the backend does not refresh
   *  the denormalized name on its own. */
  clientName?: string;
  /** Changing this, `saleAmount` or `currency` re-runs the balance sync: the
   *  old amount is reversed and the new one applied, in one DB transaction. */
  bankAccountId?: string;
  saleAmount?: number;
  currency?: Currency;
  saleDate?: string;
  description?: string;
  /** Send `null` to clear the assignment. Must be sent together with
   *  `commissionAmount` or not at all — to clear, send `employeeId: null` and
   *  `commissionAmount: 0` in the same request. */
  employeeId?: string | null;
  /** Denominated in `commissionCurrency`. The server re-applies the difference
   *  against the employee's `pendingCommission` as a delta. */
  commissionAmount?: number | null;
  /** Currency for `commissionAmount`; the server assumes PKR when omitted.
   *  Write-only — converted to PKR on save and never returned. */
  commissionCurrency?: CommissionCurrency;
}

/** Commission fields are optional and default to `0` — never `null`. */
export interface CreateEmployeePayload {
  name: string;
  paidCommission?: number;
  pendingCommission?: number;
}

/**
 * Every field is optional and independent — send only what changed; editing one
 * amount never disturbs the other. An empty body is a 422, so guard against
 * submitting nothing.
 *
 * `totalCommission` is absent by design: it is computed, not written.
 */
export interface UpdateEmployeePayload {
  name?: string;
  paidCommission?: number;
  pendingCommission?: number;
}

/** `pendingPayment` is optional and defaults to `0`. */
export interface CreateVendorPayload {
  name: string;
  pendingPayment?: number;
  /** ISO datetime. Omit for no due date. */
  dueDate?: string;
}

/** Both optional and independent — send only what changed. `{}` is a 422. */
export interface UpdateVendorPayload {
  name?: string;
  pendingPayment?: number;
  /** ISO datetime to set it, `null` to clear it, omitted to leave it alone —
   *  the three states the API distinguishes. */
  dueDate?: string | null;
}

export interface CreateBankAccountPayload {
  bankName: string;
  accountType: AccountType;
  currencyType: Currency;
  amount: number;
  /** Permanent public URL returned by the logo-presign step. */
  logoUrl?: string;
}

/** Accepted by `POST /bank-accounts/logo-presign`. */
export const LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
] as const;

export const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB, enforced server-side too

/**
 * Note: `logoUrl` can be set or replaced, but **not cleared** — the API's
 * validator rejects `null` ("expected string, received null") and omitting the
 * field leaves the stored value untouched. Removing a logo needs a backend
 * change (accept `null`, or a dedicated delete route).
 */
export type UpdateBankAccountPayload = Partial<CreateBankAccountPayload>;

// ── List params ───────────────────────────────────────────────────────────────

interface BaseListParams {
  q?: string;
  page?: number;
  limit?: number;
  sortOrder?: SortOrder;
}

export interface ClientListParams extends BaseListParams {
  sortBy?: "clientName" | "createdAt" | "updatedAt";
}

/** `sortBy` deliberately excludes the commission fields — the API rejects
 *  them, so sorting by amount has to happen client-side. */
export interface EmployeeListParams extends BaseListParams {
  sortBy?: "name" | "createdAt" | "updatedAt";
}

/** Same constraint as employees: `pendingPayment` is not a sortable field. */
export interface VendorListParams extends BaseListParams {
  sortBy?: "name" | "dueDate" | "createdAt" | "updatedAt";
}

export interface TransactionListParams extends BaseListParams {
  clientId?: string;
  bankAccountId?: string;
  /** Serialized comma-separated. */
  currency?: Currency[];
  /**
   * Filters on the *linked bank account's* type, not a column on the
   * transaction. Surfaced in the UI as "Payment Platform" — LOCAL means the
   * Pakistan accounts, INTERNATIONAL everything else — since the old
   * `PaymentPlatform` field was removed and the account now carries that
   * meaning. Serialized comma-separated.
   */
  accountType?: AccountType[];
  /**
   * Filter on `saleDate` (not `createdAt`). A bare `YYYY-MM-DD` is expanded
   * server-side to the start/end of that UTC day.
   */
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "createdAt" | "updatedAt" | "clientName" | "saleAmount" | "saleDate";
}

export interface BankAccountListParams extends BaseListParams {
  accountType?: AccountType;
  currencyType?: Currency;
  sortBy?:
    | "createdAt"
    | "updatedAt"
    | "bankName"
    | "accountType"
    | "currencyType"
    | "amount";
}

/**
 * Drops empty values and joins arrays with commas, matching
 * `serializeTaskSearchParams` in task.service.ts. The API accepts
 * comma-separated values for `paymentPlatform` and `currency`.
 */
function serializeParams(
  params?: object
): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;

  const query: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      query[key] = value.join(",");
      continue;
    }
    query[key] = value as string | number | boolean;
  }
  return query;
}

// ── Dashboard overview ────────────────────────────────────────────────────────

export type OverviewPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface RevenueStat {
  totalUsd: number;
  changePercent: number;
}

/**
 * Bank balances grouped by account type, plus the fixed conversion table used
 * to reach `totalBalanceUsd`. Shared by `/overview` and `/daily-report`, which
 * return a byte-identical shape.
 *
 * These are always **current** balances — there is no historical ledger, so a
 * report for a past date still reports today's figures. Any screen showing
 * these against a past date must say so.
 */
/** A bank account as listed on `/overview`'s balance panels. */
export interface OverviewBankAccount {
  id: string;
  bankName: string;
  currencyType: Currency;
  amount: number;
  /** Nullable — an account without an uploaded logo falls back to initials. */
  logoUrl?: string | null;
}

export interface BalanceSummary {
  byAccountType: {
    accountType: AccountType;
    /** Per-currency native totals — a bucket can hold several (an
     *  INTERNATIONAL group may span USD, AED, GBP…). */
    totals: CurrencyTotal[];
    accountCount: number;
    /**
     * Every currency in this bucket converted and summed into one USD figure —
     * the single number to show when a group spans multiple currencies.
     * Optional so an older API build degrades rather than rendering `NaN`.
     */
    totalUsd?: number;
  }[];
  totalBalanceUsd: number;
  /**
   * Live rates, refreshed hourly server-side with the static table as fallback,
   * so these are fractional (`PKR: 277.73…`) rather than round placeholders.
   * Read as "units of this currency per 1 USD".
   */
  exchangeRatesToUsd: Record<string, number>;
}

export interface OverviewResponse {
  balances: BalanceSummary;
  revenueSummary: {
    today: RevenueStat;
    /**
     * Today *so far*, compared against all of yesterday — a deliberately
     * partial figure, unlike `today` (which is yesterday-vs-the-day-before).
     * Reads as a large negative early in the morning by design, so label it
     * as a running total, never as a completed day.
     *
     * Optional so an older API build degrades to hiding the card.
     */
    todayVsYesterday?: RevenueStat;
    thisMonth: RevenueStat;
    thisYear: RevenueStat;
    totalSales: { count: number; changePercent: number };
  };
  revenueOverview: {
    period: OverviewPeriod;
    /** `label` is YYYY-MM-DD (daily/weekly), YYYY-MM (monthly), or a year. */
    points: { label: string; totalUsd: number }[];
  };
  /**
   * All-time revenue per bank account — both LOCAL and INTERNATIONAL, uncapped,
   * sorted by `totalRevenueUsd` descending. Transaction-driven (summed from
   * `Transaction.saleAmount`, no date filter), *not* the account's balance —
   * that's `bankAccounts`. Accounts with no sales are still listed, at 0.
   * Optional so an older/newer API shape can't crash the screen.
   */
  revenueByBankAccount?: {
    id: string;
    bankName: string;
    accountType: AccountType;
    currencyType: Currency;
    /**
     * Native-currency total. `null` when an account holds sales in more than
     * one currency — summing unlike currencies would be meaningless. Use
     * `totalRevenueUsd` for anything that must always have a value.
     */
    totalRevenue: number | null;
    totalRevenueUsd: number;
    salesCount: number;
    /** Nullable — an account without an uploaded logo falls back to initials. */
    logoUrl?: string | null;
  }[];
  /**
   * All-time revenue grouped by `Transaction.currency`. Transaction-driven.
   * Returns `[]` on a workspace with no transactions — unlike the old
   * balance-driven version, there is no row-per-currency guarantee.
   */
  revenueByCurrency?: {
    currency: Currency;
    total: number;
    totalUsd: number;
    percent: number;
  }[];
  /**
   * Top accounts per type by current balance, capped at 4 each. A narrower
   * shape than the full `BankAccount` — `/overview` selects only these five
   * fields, so typing it as `BankAccount` would promise `accountType`,
   * `createdAt` and `updatedAt` that never arrive.
   */
  bankAccounts: {
    local: OverviewBankAccount[];
    international: OverviewBankAccount[];
  };
  /**
   * Transaction-derived and sorted by `totalRevenueUsd` descending. Clients
   * with no transactions are absent rather than zero-filled, so this can hold
   * fewer than five entries — or none at all.
   */
  topClients: {
    id: string;
    clientName: string;
    /** `null` unless every one of the client's sales shares one currency. */
    totalRevenue: number | null;
    /** The figure to render — always USD. */
    totalRevenueUsd: number;
    salesCount: number;
    currencyType: Currency | null;
  }[];
}

/** `GET /accounting-dashboard/search` — up to 5 of each, not paginated. */
export interface DashboardSearchResponse {
  clients: {
    id: string;
    clientName: string;
    totalRevenue: number;
    currencyType: Currency | null;
  }[];
  transactions: {
    id: string;
    refId: string;
    clientName: string;
    saleAmount: number;
    currency: Currency;
    saleDate: string;
    description: string | null;
  }[];
}

// ── Services ──────────────────────────────────────────────────────────────────

export const clientService = {
  list: (params?: ClientListParams) =>
    api
      .get<PaginatedApiWrapper<AccountingClient[]>>("/clients", {
        params: serializeParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  /**
   * Every client in the workspace, uncapped and sorted A–Z. Despite the route
   * name this no longer searches: the backend ignores `q` entirely (it returns
   * the full list for any query), so filtering is the caller's job. Fetch once
   * and filter locally rather than issuing a request per keystroke.
   */
  searchAll: () =>
    api
      .get<ApiWrapper<ClientSearchResult[]>>("/clients/search")
      .then((r) => r.data.data),

  get: (clientId: string) =>
    api
      .get<ApiWrapper<AccountingClientDetail>>(`/clients/${clientId}`)
      .then((r) => r.data.data),

  create: (payload: CreateClientPayload) =>
    api
      .post<ApiWrapper<AccountingClient>>("/clients", payload)
      .then((r) => r.data.data),

  update: (clientId: string, payload: UpdateClientPayload) =>
    api
      .patch<ApiWrapper<AccountingClient>>(`/clients/${clientId}`, payload)
      .then((r) => r.data.data),

  /** Rejects with 409 if the client still has transactions. */
  delete: (clientId: string) => api.delete(`/clients/${clientId}`),
};

export const employeeService = {
  list: (params?: EmployeeListParams) =>
    api
      .get<
        PaginatedApiWrapper<AccountingEmployee[]> & {
          totalPendingCommission?: number;
          totalPendingCommissionUsd?: number;
        }
      >("/employees", {
        params: serializeParams(params),
      })
      .then((r) => ({
        items: r.data.data,
        meta: r.data.meta,
        /* Summed server-side over every row matching the current filter — not
           just this page — so it tracks the same set `meta.total` counts and
           narrows when a search is active. Optional: an older API build leaves
           it undefined, which the view hides rather than showing a wrong 0. */
        totalPendingCommission: r.data.totalPendingCommission,
        totalPendingCommissionUsd: r.data.totalPendingCommissionUsd,
      })),

  /** Word-order-independent name search. Returns a plain array, not paginated. */
  search: (q: string) =>
    api
      .get<ApiWrapper<EmployeeSearchResult[]>>("/employees/search", {
        params: { q },
      })
      .then((r) => r.data.data),

  /**
   * Every employee in the workspace, alphabetically — `q` is optional on this
   * route, and omitting it returns the full list (sorted server-side with
   * `localeCompare`, so case doesn't split the ordering).
   *
   * Mirrors {@link clientService.searchAll}: a picker fetches once and filters
   * locally rather than round-tripping per keystroke.
   */
  searchAll: () =>
    api
      .get<ApiWrapper<EmployeeSearchResult[]>>("/employees/search")
      .then((r) => r.data.data),

  get: (employeeId: string) =>
    api
      .get<ApiWrapper<AccountingEmployee>>(`/employees/${employeeId}`)
      .then((r) => r.data.data),

  create: (payload: CreateEmployeePayload) =>
    api
      .post<ApiWrapper<AccountingEmployee>>("/employees", payload)
      .then((r) => r.data.data),

  update: (employeeId: string, payload: UpdateEmployeePayload) =>
    api
      .patch<ApiWrapper<AccountingEmployee>>(`/employees/${employeeId}`, payload)
      .then((r) => r.data.data),

  /** Unconditional. `Transaction.employeeId` is `onDelete: SetNull`, so past
   *  sales keep their `commissionAmount` and simply lose the employee link —
   *  deletion is never blocked, and a confirm dialog is the only safeguard. */
  delete: (employeeId: string) => api.delete(`/employees/${employeeId}`),
};

/** Mirrors {@link employeeService} — the resources are deliberately alike. */
export const vendorService = {
  list: (params?: VendorListParams) =>
    api
      .get<
        PaginatedApiWrapper<AccountingVendor[]> & {
          totalPendingPayment?: number;
        }
      >("/vendors", {
        params: serializeParams(params),
      })
      .then((r) => ({
        items: r.data.data,
        meta: r.data.meta,
        /* Summed server-side over every row matching the current filter — see
           the employees list above for the full semantics. */
        totalPendingPayment: r.data.totalPendingPayment,
      })),

  /** Word-order-independent name search. Returns a plain array, not paginated. */
  search: (q: string) =>
    api
      .get<ApiWrapper<VendorSearchResult[]>>("/vendors/search", {
        params: { q },
      })
      .then((r) => r.data.data),

  get: (vendorId: string) =>
    api
      .get<ApiWrapper<AccountingVendor>>(`/vendors/${vendorId}`)
      .then((r) => r.data.data),

  create: (payload: CreateVendorPayload) =>
    api
      .post<ApiWrapper<AccountingVendor>>("/vendors", payload)
      .then((r) => r.data.data),

  update: (vendorId: string, payload: UpdateVendorPayload) =>
    api
      .patch<ApiWrapper<AccountingVendor>>(`/vendors/${vendorId}`, payload)
      .then((r) => r.data.data),

  /** Unconditional — a vendor has no linked records to guard against. */
  delete: (vendorId: string) => api.delete(`/vendors/${vendorId}`),
};

export const transactionService = {
  list: (params?: TransactionListParams) =>
    api
      .get<PaginatedApiWrapper<AccountingTransaction[]>>("/transactions", {
        params: serializeParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  get: (transactionId: string) =>
    api
      .get<ApiWrapper<AccountingTransaction>>(`/transactions/${transactionId}`)
      .then((r) => r.data.data),

  /** 404 if `clientId` doesn't exist, 409 if `refId` is already taken. */
  create: (payload: CreateTransactionPayload) =>
    api
      .post<ApiWrapper<AccountingTransaction>>("/transactions", payload)
      .then((r) => r.data.data),

  update: (transactionId: string, payload: UpdateTransactionPayload) =>
    api
      .patch<ApiWrapper<AccountingTransaction>>(
        `/transactions/${transactionId}`,
        payload
      )
      .then((r) => r.data.data),

  delete: (transactionId: string) => api.delete(`/transactions/${transactionId}`),
};

export const bankAccountService = {
  list: (params?: BankAccountListParams) =>
    api
      .get<PaginatedApiWrapper<BankAccount[]>>("/bank-accounts", {
        params: serializeParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  get: (bankAccountId: string) =>
    api
      .get<ApiWrapper<BankAccount>>(`/bank-accounts/${bankAccountId}`)
      .then((r) => r.data.data),

  create: (payload: CreateBankAccountPayload) =>
    api
      .post<ApiWrapper<BankAccount>>("/bank-accounts", payload)
      .then((r) => r.data.data),

  update: (bankAccountId: string, payload: UpdateBankAccountPayload) =>
    api
      .patch<ApiWrapper<BankAccount>>(
        `/bank-accounts/${bankAccountId}`,
        payload
      )
      .then((r) => r.data.data),

  delete: (bankAccountId: string) =>
    api.delete(`/bank-accounts/${bankAccountId}`),

  /**
   * Step 1 of the logo upload. Unlike the other presign flows in this app this
   * one takes the actual file as multipart/form-data — the backend derives
   * name/mime/size from the bytes rather than trusting client-supplied fields.
   */
  presignLogo: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<ApiWrapper<{ uploadUrl: string; logoUrl: string; expiresIn: number }>>(
        "/bank-accounts/logo-presign",
        form,
        // The axios instance defaults to application/json. Undefined here makes
        // the browser set multipart/form-data with the correct boundary, which
        // it can only do itself — a hardcoded value would omit the boundary and
        // the backend's FileInterceptor would find no file.
        { headers: { "Content-Type": undefined } }
      )
      .then((r) => r.data.data);
  },

  /**
   * Step 2: PUT the raw bytes straight to S3, bypassing this API.
   * `Content-Type` is required — the presigned URL is signed without one, so
   * omitting it makes S3 store the object as application/octet-stream and the
   * logo downloads instead of rendering.
   */
  uploadLogoToS3: async (uploadUrl: string, file: File) => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error(`Logo upload failed: ${res.status}`);
  },

  /** Both steps. Returns the permanent public URL to save as `logoUrl`. */
  uploadLogo: async (file: File): Promise<string> => {
    const { uploadUrl, logoUrl } = await bankAccountService.presignLogo(file);
    await bankAccountService.uploadLogoToS3(uploadUrl, file);
    return logoUrl;
  },
};

export const accountingDashboardService = {
  /** One call backs the entire overview screen. */
  overview: (period: OverviewPeriod = "daily") =>
    api
      .get<ApiWrapper<OverviewResponse>>("/accounting-dashboard/overview", {
        params: { period },
      })
      .then((r) => r.data.data),

  /** Global search across clients + transactions. `q` must be 1-200 chars. */
  search: (q: string) =>
    api
      .get<ApiWrapper<DashboardSearchResponse>>("/accounting-dashboard/search", {
        params: { q },
      })
      .then((r) => r.data.data),
};

// ── Reports ───────────────────────────────────────────────────────────────────
// `/reports/breakdown` answers "what happened in this window", where every
// `/overview` breakdown is all-time. The two are otherwise the same math.

/** Max span `/reports/breakdown` accepts, mirroring the API's own cap so the
 *  client can reject a bad range before spending a round trip on a 422. */
export const REPORTS_MAX_RANGE_DAYS = 400;

export interface ReportBankAccountRevenue {
  id: string;
  bankName: string;
  accountType: AccountType;
  currencyType: Currency;
  /** Native-currency total; `null` when the account's sales in this period
   *  span more than one currency. `totalRevenueUsd` is always populated. */
  totalRevenue: number | null;
  totalRevenueUsd: number;
  salesCount: number;
}

export interface ReportCurrencyRevenue {
  currency: Currency;
  total: number;
  totalUsd: number;
  percent: number;
}

/**
 * Ranked by **summed transaction revenue** in the period — deliberately not the
 * same computation as `OverviewResponse.topClients`, which ranks by the
 * hand-entered `Clients.totalRevenue` field that is known to drift from real
 * activity. Kept as a separate type so the two can't be conflated.
 */
export interface ReportTopClient {
  id: string;
  clientName: string;
  totalRevenue: number | null;
  totalRevenueUsd: number;
  salesCount: number;
  currencyType: Currency | null;
}

export interface ReportsBreakdownResponse {
  dateFrom: string;
  dateTo: string;
  /**
   * Bank balances, narrowed by `bankAccountId`/`accountType`/`currency` only.
   * The date range and `clientId` deliberately do **not** scope these: balances
   * are current-state with no historical ledger, and an account isn't tied to
   * one client. Optional so an older API build degrades gracefully.
   */
  balances?: BalanceSummary;
  /** **Zero-filled**: every bank account appears, even with no sales in the
   *  period. A caller must not treat a non-empty array as proof of activity. */
  revenueByBankAccount: ReportBankAccountRevenue[];
  /** Empty array when nothing sold in the period — no row-per-currency guarantee. */
  revenueByCurrency: ReportCurrencyRevenue[];
  /** Empty array when nothing sold; capped at 5 by the API. */
  topClients: ReportTopClient[];
}

export interface DailyReportClientPayment {
  id: string;
  clientName: string;
  saleAmount: number;
  currency: Currency;
  bankAccount: { id: string; bankName: string; logoUrl: string | null };
}

export interface DailyReportResponse {
  date: string;
  revenueUsd: number;
  salesCount: number;
  /** Current balances — see `BalanceSummary`; not as of `date`. */
  balances: BalanceSummary;
  clientPayments: DailyReportClientPayment[];
}

export interface MonthlyBreakdownResponse {
  year: number;
  /** Always exactly 12 points, January–December, `label` as `YYYY-MM`. */
  points: { label: string; totalUsd: number }[];
}

export interface ReportExportResult {
  blob: Blob;
  filename: string;
}

/** Both export routes take the same params and differ only in output format. */
export type ReportExportFormat = "xlsx" | "pdf";

/**
 * Filters shared by `/reports/export` and `/reports/breakdown`, mirroring the
 * Reports table's controls and matching `GET /transactions`'s own filter set:
 * `currency`/`accountType` are comma-separated lists, `clientId`/`bankAccountId`
 * single values.
 */
export interface ReportFilters {
  clientId?: string;
  bankAccountId?: string;
  accountType?: AccountType[];
  currency?: Currency[];
}

export const reportsService = {
  /** Date-scoped revenue breakdown. Both dates required, `YYYY-MM-DD`,
   *  `dateFrom <= dateTo`, span ≤ `REPORTS_MAX_RANGE_DAYS`. */
  breakdown: (dateFrom: string, dateTo: string, filters: ReportFilters = {}) =>
    api
      .get<ApiWrapper<ReportsBreakdownResponse>>(
        "/accounting-dashboard/reports/breakdown",
        { params: serializeParams({ dateFrom, dateTo, ...filters }) }
      )
      .then((r) => r.data.data),

  dailyReport: (date: string) =>
    api
      .get<ApiWrapper<DailyReportResponse>>("/accounting-dashboard/daily-report", {
        params: { date },
      })
      .then((r) => r.data.data),

  monthlyBreakdown: (year: number) =>
    api
      .get<ApiWrapper<MonthlyBreakdownResponse>>(
        "/accounting-dashboard/monthly-breakdown",
        { params: { year } }
      )
      .then((r) => r.data.data),

  /**
   * Downloads an `.xlsx` workbook for a single day or a whole range.
   *
   * The API accepts **either** `date` **or** `dateFrom` + `dateTo` — passing
   * both, or only one half of a range, is a 422. A range whose ends are the
   * same day is sent as `date`, which is the shape the endpoint documents for
   * a single day (and keeps the single-day filename).
   *
   * Two traps handled here rather than at every call site:
   * 1. With `responseType: "blob"` an **error** body is also a Blob, so the
   *    usual `err.response.data.message` read yields garbage. Unwrap it back
   *    to text and rethrow something a toast can display.
   * 2. `Content-Disposition` is not CORS-safelisted, so cross-origin it reads
   *    as `undefined` unless the API exposes it. The reconstructed name is
   *    exact, so parsing is the optimisation and the fallback is the norm.
   */
  exportWorkbook: async (
    dateFrom: string,
    dateTo: string,
    filters: ReportFilters = {},
    /** `pdf` hits a sibling endpoint; params, filters and auth are identical. */
    format: ReportExportFormat = "xlsx"
  ): Promise<ReportExportResult> => {
    const isSingleDay = dateFrom === dateTo;
    const dateParams = isSingleDay ? { date: dateFrom } : { dateFrom, dateTo };
    const fallbackName = isSingleDay
      ? `accounting-report-${dateFrom}.${format}`
      : `accounting-report-${dateFrom}_to_${dateTo}.${format}`;
    const path =
      format === "pdf"
        ? "/accounting-dashboard/reports/export/pdf"
        : "/accounting-dashboard/reports/export";

    try {
      const response = await api.get(path, {
        params: serializeParams({ ...dateParams, ...filters }),
        responseType: "blob",
      });
      return {
        blob: response.data as Blob,
        filename:
          parseContentDispositionFilename(
            response.headers?.["content-disposition"]
          ) ?? fallbackName,
      };
    } catch (err) {
      throw await unwrapBlobError(err);
    }
  },
};

/** Rewrites an axios error whose body is a Blob into one carrying the real
 *  JSON message, so `parseApiError` and toasts behave as they do elsewhere. */
async function unwrapBlobError(err: unknown): Promise<unknown> {
  const response = (err as { response?: { data?: unknown } })?.response;
  if (!(response?.data instanceof Blob)) return err;

  try {
    const parsed = JSON.parse(await response.data.text()) as {
      message?: string;
    };
    response.data = parsed;
  } catch {
    // Not JSON (an HTML error page, a truncated stream) — leave the original
    // error alone rather than inventing a message for it.
  }
  return err;
}
