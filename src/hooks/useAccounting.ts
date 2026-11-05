"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseApiError } from "@/lib/api";
import { ACCOUNTING_ROOT_KEY, queryKeys } from "@/queries/keys";
import { useAuthStore } from "@/stores/auth.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { workspaceService } from "@/services/workspace.service";
import { downloadBlob } from "@/lib/download";
import {
  accountingDashboardService,
  bankAccountService,
  clientService,
  employeeService,
  reportsService,
  transactionService,
  vendorService,
  REPORTS_MAX_RANGE_DAYS,
  type BankAccountListParams,
  type ClientListParams,
  type CreateBankAccountPayload,
  type CreateClientPayload,
  type CreateEmployeePayload,
  type CreateTransactionPayload,
  type CreateVendorPayload,
  type EmployeeListParams,
  type OverviewPeriod,
  type ReportExportFormat,
  type ReportFilters,
  type TransactionListParams,
  type UpdateBankAccountPayload,
  type UpdateClientPayload,
  type UpdateEmployeePayload,
  type UpdateTransactionPayload,
  type UpdateVendorPayload,
  type VendorListParams,
} from "@/services/accounting.service";

/**
 * Every accounting mutation invalidates the whole "accounting" key root: the
 * dashboard overview is derived from clients, transactions and bank accounts, so
 * changing any one of them can move numbers on the Overview screen.
 *
 * Mutations here follow the house convention (see useWorkspaceTags): plain async
 * callbacks, no useMutation, and they THROW — the calling component owns the toast.
 */
function useInvalidateAccounting() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: [ACCOUNTING_ROOT_KEY],
        // The role query shares this root but can't be changed by a data
        // mutation, so exclude it rather than refetching it every write.
        predicate: (query) => query.queryKey[1] !== "role",
      }),
    [queryClient]
  );
}

/**
 * The backend gates all four accounting controllers with
 * `@RequireUserRole('CEO','ACCOUNTANT')`, so a user whose role was revoked
 * mid-session still passes the client-side guard (their cached `role` is stale)
 * but gets 403 on every request. Surface that as a permission message rather
 * than a bare "Forbidden".
 */
export const ACCOUNTING_FORBIDDEN_MESSAGE =
  "You no longer have access to accounting. Please sign in again.";

function toAccountingError(error: unknown): string | null {
  if (!error) return null;
  const { message, code } = parseApiError(error);
  return code === "FORBIDDEN" ? ACCOUNTING_FORBIDDEN_MESSAGE : message;
}

/** Never retry a permission denial — the answer won't change. */
const ACCOUNTING_RETRY = (failureCount: number, error: unknown) =>
  parseApiError(error).code === "FORBIDDEN" ? false : failureCount < 1;

/**
 * Every accounting request needs both a token and an `x-workspace-id` header
 * (attached by the axios interceptor from the active workspace). Without an
 * active workspace the header is absent and `WorkspaceGuard` 403s, so gate the
 * queries rather than firing requests that can't succeed.
 */
function useAccountingQueryGate() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return { workspaceId, isReady: !!accessToken && !!workspaceId };
}

/**
 * The caller's accounting role in the active workspace. Accounting access moved
 * off `User.role` onto `WorkspaceMember.accountingRole`, so it's per-workspace
 * and only discoverable via `GET /workspaces/:id`. Probing endpoints can't
 * substitute — the backend returns an identical bare 403 for a null role and a
 * merely-insufficient one.
 *
 * Despite the name, this is really "who am I in this workspace" — it also
 * surfaces `isItManager` (IT Management module access) off the very same
 * call, the same way `useWorkspaceManageAccess` already reuses this query's
 * `workspaceRole` rather than issuing a second request.
 */
export function useAccountingRole() {
  const { workspaceId, isReady } = useAccountingQueryGate();

  const query = useQuery({
    queryKey: queryKeys.accountingRole(workspaceId),
    queryFn: () => workspaceService.getWorkspace(workspaceId!),
    enabled: isReady,
    staleTime: 5 * 60_000,
    // A 403 here means "not a member of this workspace", which is a real answer
    // rather than a transient failure.
    retry: ACCOUNTING_RETRY,
  });

  return {
    accountingRole: query.data?.accountingRole ?? null,
    workspaceRole: query.data?.role ?? null,
    isItManager: query.data?.isItManager ?? false,
    // Treat "no workspace yet" as loading: the answer is genuinely unknown, and
    // reporting "no access" would flash the accounting UI away mid-restore.
    isLoading: query.isLoading || !isReady,
  };
}

// ── Dashboard overview ────────────────────────────────────────────────────────

export function useAccountingOverview(period: OverviewPeriod = "daily") {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingOverview(workspaceId, period),
    [workspaceId, period]
  );

  const query = useQuery({
    queryKey,
    queryFn: () => accountingDashboardService.overview(period),
    enabled: isReady,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
    // Each period is its own cache entry, so switching to one that hasn't been
    // fetched yet would otherwise blank `data` and tear the whole screen down.
    // Keeping the previous period's response on screen makes the toggle swap
    // just the chart once the new data lands.
    placeholderData: (previous) => previous,
  });

  return {
    overview: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}

/**
 * Global accounting search backing the header search bar on /accounts routes.
 * Returns up to 5 clients and 5 transactions; not paginated.
 */
export function useDashboardSearch(term: string, debounceMs = 300) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), debounceMs);
    return () => clearTimeout(timer);
  }, [term, debounceMs]);

  // The API caps `q` at 200 chars and rejects anything longer.
  const trimmed = debounced.trim().slice(0, 200);

  const query = useQuery({
    queryKey: queryKeys.accountingDashboardSearch(workspaceId, trimmed),
    queryFn: () => accountingDashboardService.search(trimmed),
    enabled: isReady && trimmed.length > 0,
    staleTime: 30_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    clients: query.data?.clients ?? [],
    transactions: query.data?.transactions ?? [],
    // Treat the debounce gap as loading so the panel doesn't flash "no results"
    // between a keystroke and the request going out.
    isLoading: query.isFetching || (trimmed.length > 0 && debounced !== term),
    error: toAccountingError(query.error),
  };
}

// ── Mutations without a list subscription ─────────────────────────────────────
// Modals that only write (Add Sale, Add Client) use these so they don't fire a
// throwaway list request just to reach a mutation callback.

export function useClientMutations() {
  const invalidateAccounting = useInvalidateAccounting();

  const createClient = useCallback(
    async (payload: CreateClientPayload) => {
      const created = await clientService.create(payload);
      await invalidateAccounting();
      return created;
    },
    [invalidateAccounting]
  );

  const renameClient = useCallback(
    async (clientId: string, payload: UpdateClientPayload) => {
      const updated = await clientService.update(clientId, payload);
      await invalidateAccounting();
      return updated;
    },
    [invalidateAccounting]
  );

  const deleteClient = useCallback(
    async (clientId: string) => {
      await clientService.delete(clientId);
      await invalidateAccounting();
    },
    [invalidateAccounting]
  );

  return { createClient, renameClient, deleteClient };
}

export function useEmployeeMutations() {
  const invalidateAccounting = useInvalidateAccounting();

  const createEmployee = useCallback(
    async (payload: CreateEmployeePayload) => {
      const created = await employeeService.create(payload);
      await invalidateAccounting();
      return created;
    },
    [invalidateAccounting]
  );

  /** Renamed from `renameEmployee`: a PATCH now edits the commission figures
   *  as well as the name, and takes only the fields that changed. */
  const updateEmployee = useCallback(
    async (employeeId: string, payload: UpdateEmployeePayload) => {
      const updated = await employeeService.update(employeeId, payload);
      await invalidateAccounting();
      return updated;
    },
    [invalidateAccounting]
  );

  const deleteEmployee = useCallback(
    async (employeeId: string) => {
      await employeeService.delete(employeeId);
      await invalidateAccounting();
    },
    [invalidateAccounting]
  );

  return { createEmployee, updateEmployee, deleteEmployee };
}

export function useVendorMutations() {
  const invalidateAccounting = useInvalidateAccounting();

  const createVendor = useCallback(
    async (payload: CreateVendorPayload) => {
      const created = await vendorService.create(payload);
      await invalidateAccounting();
      return created;
    },
    [invalidateAccounting]
  );

  const updateVendor = useCallback(
    async (vendorId: string, payload: UpdateVendorPayload) => {
      const updated = await vendorService.update(vendorId, payload);
      await invalidateAccounting();
      return updated;
    },
    [invalidateAccounting]
  );

  const deleteVendor = useCallback(
    async (vendorId: string) => {
      await vendorService.delete(vendorId);
      await invalidateAccounting();
    },
    [invalidateAccounting]
  );

  return { createVendor, updateVendor, deleteVendor };
}

export function useTransactionMutations() {
  const invalidateAccounting = useInvalidateAccounting();

  const createTransaction = useCallback(
    async (payload: CreateTransactionPayload) => {
      const created = await transactionService.create(payload);
      await invalidateAccounting();
      return created;
    },
    [invalidateAccounting]
  );

  const updateTransaction = useCallback(
    async (transactionId: string, payload: UpdateTransactionPayload) => {
      const updated = await transactionService.update(transactionId, payload);
      await invalidateAccounting();
      return updated;
    },
    [invalidateAccounting]
  );

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      await transactionService.delete(transactionId);
      await invalidateAccounting();
    },
    [invalidateAccounting]
  );

  return { createTransaction, updateTransaction, deleteTransaction };
}

export function useBankAccountMutations() {
  const invalidateAccounting = useInvalidateAccounting();

  const createBankAccount = useCallback(
    async (payload: CreateBankAccountPayload) => {
      const created = await bankAccountService.create(payload);
      await invalidateAccounting();
      return created;
    },
    [invalidateAccounting]
  );

  const updateBankAccount = useCallback(
    async (bankAccountId: string, payload: UpdateBankAccountPayload) => {
      const updated = await bankAccountService.update(bankAccountId, payload);
      await invalidateAccounting();
      return updated;
    },
    [invalidateAccounting]
  );

  const deleteBankAccount = useCallback(
    async (bankAccountId: string) => {
      await bankAccountService.delete(bankAccountId);
      await invalidateAccounting();
    },
    [invalidateAccounting]
  );

  return { createBankAccount, updateBankAccount, deleteBankAccount };
}

// ── Clients ───────────────────────────────────────────────────────────────────

export function useAccountingClients(params: ClientListParams) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingClients(workspaceId, params),
    [workspaceId, params]
  );
  const { createClient, renameClient, deleteClient } = useClientMutations();

  const query = useQuery({
    queryKey,
    queryFn: () => clientService.list(params),
    enabled: isReady,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    clients: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
    createClient,
    renameClient,
    deleteClient,
  };
}

export function useAccountingClient(clientId: string | null) {
  const { workspaceId, isReady } = useAccountingQueryGate();

  const query = useQuery({
    queryKey: queryKeys.accountingClient(workspaceId, clientId ?? ""),
    queryFn: () => clientService.get(clientId!),
    enabled: isReady && !!clientId,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    client: query.data ?? null,
    isLoading: query.isLoading,
    error: toAccountingError(query.error),
  };
}

/**
 * Every client in the workspace, A–Z, for the transaction client picker.
 * `POST /transactions` requires a resolved clientId, so this is the only way to
 * attach a sale.
 *
 * The endpoint stopped filtering server-side — it ignores `q` and always
 * returns the full list — so this fetches once and the caller filters the
 * result locally. No debounce, and no request per keystroke.
 */
export function useClientAll() {
  const { workspaceId, isReady } = useAccountingQueryGate();

  const query = useQuery({
    queryKey: queryKeys.accountingClientSearch(workspaceId, "all"),
    queryFn: () => clientService.searchAll(),
    enabled: isReady,
    staleTime: 30_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    clients: query.data ?? [],
    isLoading: query.isFetching,
    error: toAccountingError(query.error),
  };
}

// ── Employees ─────────────────────────────────────────────────────────────────

export function useAccountingEmployees(params: EmployeeListParams) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingEmployees(workspaceId, params),
    [workspaceId, params]
  );
  const { createEmployee, updateEmployee, deleteEmployee } = useEmployeeMutations();

  const query = useQuery({
    queryKey,
    queryFn: () => employeeService.list(params),
    enabled: isReady,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    employees: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    /** Pending commission summed over the whole filtered set, not this page. */
    totalPendingCommission: query.data?.totalPendingCommission,
    totalPendingCommissionUsd: query.data?.totalPendingCommissionUsd,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}

// ── Vendors ───────────────────────────────────────────────────────────────────

export function useAccountingVendors(params: VendorListParams) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingVendors(workspaceId, params),
    [workspaceId, params]
  );
  const { createVendor, updateVendor, deleteVendor } = useVendorMutations();

  const query = useQuery({
    queryKey,
    queryFn: () => vendorService.list(params),
    enabled: isReady,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    vendors: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    /** Pending payment summed over the whole filtered set, not this page. */
    totalPendingPayment: query.data?.totalPendingPayment,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
    createVendor,
    updateVendor,
    deleteVendor,
  };
}

/**
 * Employee options for a picker, served by `GET /employees/search` in both
 * modes: with no term it returns the whole workspace (so the dropdown has
 * something to show before any typing), and with a term the server does the
 * matching.
 *
 * Server-side filtering rather than a local substring match, because the
 * backend splits the term on whitespace and AND-matches each token — "john
 * smith" finds "Smith, John", which `includes()` never would.
 *
 * The term is debounced so a keystroke isn't a request. Both modes share one
 * query key space keyed by the trimmed term, so the full list is cached under
 * `""` and returned to instantly when the field is cleared.
 */
export function useEmployeeOptions(term: string, debounceMs = 300) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), debounceMs);
    return () => clearTimeout(timer);
  }, [term, debounceMs]);

  const trimmed = debounced.trim();

  const query = useQuery({
    queryKey: queryKeys.accountingEmployeeSearch(workspaceId, trimmed || "all"),
    queryFn: () =>
      trimmed ? employeeService.search(trimmed) : employeeService.searchAll(),
    enabled: isReady,
    staleTime: 30_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    employees: query.data ?? [],
    // Also "loading" while the debounce is still settling, so the list isn't
    // shown as a stale result for a term the user has already moved past.
    isLoading: query.isFetching || debounced !== term,
    error: toAccountingError(query.error),
  };
}

// ── Transactions ──────────────────────────────────────────────────────────────

export function useAccountingTransactions(params: TransactionListParams) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingTransactions(workspaceId, params),
    [workspaceId, params]
  );
  const { createTransaction, updateTransaction, deleteTransaction } =
    useTransactionMutations();

  const query = useQuery({
    queryKey,
    queryFn: () => transactionService.list(params),
    enabled: isReady,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    transactions: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}

// ── Bank accounts ─────────────────────────────────────────────────────────────

export function useBankAccounts(params: BankAccountListParams) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingBankAccounts(workspaceId, params),
    [workspaceId, params]
  );
  const { createBankAccount, updateBankAccount, deleteBankAccount } =
    useBankAccountMutations();

  const query = useQuery({
    queryKey,
    queryFn: () => bankAccountService.list(params),
    enabled: isReady,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
  });

  return {
    bankAccounts: query.data?.items ?? [],
    meta: query.data?.meta ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
  };
}

// ── Reports ───────────────────────────────────────────────────────────────────

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Mirrors the API's own validation so a malformed range never reaches the
 * network. Without this, every intermediate keystroke in a native date input
 * fires a request guaranteed to 422 (a half-typed year is still a valid
 * `change` event).
 */
export function isValidReportRange(
  dateFrom: string | null,
  dateTo: string | null
): boolean {
  if (!dateFrom || !dateTo) return false;
  if (!DATE_PATTERN.test(dateFrom) || !DATE_PATTERN.test(dateTo)) return false;
  if (dateFrom > dateTo) return false;

  const span =
    (Date.parse(`${dateTo}T00:00:00.000Z`) -
      Date.parse(`${dateFrom}T00:00:00.000Z`)) /
    MS_PER_DAY;
  return Number.isFinite(span) && span <= REPORTS_MAX_RANGE_DAYS;
}

/**
 * Date-scoped revenue breakdown — the spine of all three Reports modes (a day
 * is just `dateFrom === dateTo`).
 *
 * Note the asymmetric empty states this returns: `revenueByBankAccount` is
 * zero-filled with every account, while `revenueByCurrency` and `topClients`
 * come back empty. Callers must not read a non-empty account list as evidence
 * that anything sold.
 */
export function useReportsBreakdown(
  dateFrom: string | null,
  dateTo: string | null,
  filters: ReportFilters = {}
) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  // Filters are part of the cache identity — serialized rather than spread so
  // the key stays a flat, stably-comparable tuple.
  const filterKey = JSON.stringify(filters);
  const queryKey = useMemo(
    () =>
      [
        ...queryKeys.accountingReportsBreakdown(workspaceId, dateFrom, dateTo),
        filterKey,
      ] as const,
    [workspaceId, dateFrom, dateTo, filterKey]
  );

  const query = useQuery({
    queryKey,
    queryFn: () => reportsService.breakdown(dateFrom!, dateTo!, filters),
    enabled: isReady && isValidReportRange(dateFrom, dateTo),
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
    // Switching mode or stepping a date is its own cache entry; keeping the
    // previous response on screen swaps the numbers in place rather than
    // collapsing the whole page back to a skeleton.
    placeholderData: (previous) => previous,
  });

  return {
    breakdown: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}

/**
 * Adds the per-payment list and balances that only exist for a single date.
 * `enabled` lets the caller skip the request outside Day mode without
 * conditionally calling the hook.
 */
export function useDailyReport(date: string | null, enabled = true) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingDailyReport(workspaceId, date),
    [workspaceId, date]
  );

  const query = useQuery({
    queryKey,
    queryFn: () => reportsService.dailyReport(date!),
    enabled: enabled && isReady && !!date && DATE_PATTERN.test(date),
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
    placeholderData: (previous) => previous,
  });

  return {
    dailyReport: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}

/** The 12-point Jan–Dec series behind Year mode's trend chart. */
export function useMonthlyBreakdown(year: number | null, enabled = true) {
  const { workspaceId, isReady } = useAccountingQueryGate();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.accountingMonthlyBreakdown(workspaceId, year),
    [workspaceId, year]
  );

  const query = useQuery({
    queryKey,
    queryFn: () => reportsService.monthlyBreakdown(year!),
    enabled: enabled && isReady && !!year,
    staleTime: 60_000,
    retry: ACCOUNTING_RETRY,
    placeholderData: (previous) => previous,
  });

  return {
    monthlyBreakdown: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: toAccountingError(query.error),
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}

/**
 * One-shot `.xlsx`/`.pdf` download. Not a react-query mutation: there's no
 * cacheable result and nothing to invalidate — it matches the module's other
 * write-side helpers, which are plain async callbacks that throw for the caller
 * to toast.
 */
export function useReportExport() {
  /** Which format is in flight, so each menu row can spin independently. */
  const [exportingFormat, setExportingFormat] =
    useState<ReportExportFormat | null>(null);

  const exportReport = useCallback(
    async (
      dateFrom: string,
      dateTo: string,
      filters: ReportFilters = {},
      format: ReportExportFormat = "xlsx"
    ) => {
      // Guard against a double-click producing two downloads of the same file.
      setExportingFormat(format);
      try {
        const { blob, filename } = await reportsService.exportWorkbook(
          dateFrom,
          dateTo,
          filters,
          format
        );
        downloadBlob(blob, filename);
      } finally {
        setExportingFormat(null);
      }
    },
    []
  );

  return { exportReport, exportingFormat, isExporting: exportingFormat !== null };
}
