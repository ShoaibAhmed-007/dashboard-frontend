"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuChevronLeft,
  LuChevronRight,
  LuCoins,
  LuDatabase,
  LuPencil,
  LuSearch,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { parseApiError } from "@/lib/api";
import { useAccountingAccess } from "@/hooks/useAccountingAccess";
import { useAccountingTransactions } from "@/hooks/useAccounting";
import {
  CURRENCIES,
  LOCAL_CURRENCY,
  transactionCurrenciesForAccountType,
  type AccountingTransaction,
  type BankAccount,
  type ClientSearchResult,
  type Currency,
  COMMISSION_CURRENCIES,
  type CommissionCurrency,
  type EmployeeSearchResult,
  type TransactionListParams,
} from "@/services/accounting.service";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import { SingleDateField } from "@/components/accounts/accountingFilters";
import ClientPicker from "@/components/accounts/ClientPicker";
import BankAccountPicker from "@/components/accounts/BankAccountPicker";
import EmployeePicker from "@/components/accounts/EmployeePicker";
import EmployeeFormModal from "@/components/accounts/EmployeeFormModal";
import BankAvatar from "@/components/accounts/BankAvatar";
import {
  DateDropdown,
  FilterDropdown,
  type DatePreset,
} from "@/components/accounts/accountingFilters";
import {
  formatIsoDate,
  formatMoney,
  fromDateInputValue,
  toDateInputValue,
} from "@/components/accounts/platformMeta";

// Layout constants used to derive how many rows fit in the available space.
// They must stay in sync with the markup below: the row height, the sticky
// column header, the card's title bar + borders, and the pagination row that
// sits inside the sizer beneath the card.
const ROW_HEIGHT = 56;
const TABLE_HEADER_HEIGHT = 40;
const CARD_TITLE_BAR_HEIGHT = 48;
const CARD_BORDER_HEIGHT = 2;
const PAGINATION_ROW_HEIGHT = 44;

/**
 * Full patch form for a transaction. `PATCH /transactions/:id` accepts every
 * field, so unlike the mock version this edits more than amount + currency.
 */
function EditTransactionModal({
  transaction,
  onClose,
  onSave,
}: {
  transaction: AccountingTransaction;
  onClose: () => void;
  onSave: (
    id: string,
    payload: {
      clientId?: string;
      clientName?: string;
      saleAmount?: number;
      currency?: Currency;
      bankAccountId?: string;
      saleDate?: string;
      description?: string;
      employeeId?: string | null;
      commissionAmount?: number | null;
      commissionCurrency?: CommissionCurrency;
    }
  ) => Promise<void>;
}) {
  const [client, setClient] = useState<ClientSearchResult | null>(null);
  const [amount, setAmount] = useState(String(transaction.saleAmount));
  const [saleDate, setSaleDate] = useState(() =>
    toDateInputValue(transaction.saleDate)
  );
  const [currency, setCurrency] = useState<Currency>(transaction.currency);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  /**
   * A LOCAL account only accepts PKR. Only a *newly picked* account tells us
   * its type — a transaction's own nested `bankAccount` carries just
   * `{ id, bankName, logoUrl }`, no `accountType` — so when the account isn't
   * being changed this stays permissive and the server enforces the rule.
   * Erring open avoids blocking a legitimate edit on missing information.
   */
  const isLocalAccount = bankAccount?.accountType === "LOCAL";
  const [description, setDescription] = useState(transaction.description ?? "");
  /* Seeded from what the transaction already carries. `employeeId` and
     `commissionAmount` are a both-or-neither pair per request, so they are
     only ever sent together — including when clearing, which is
     `employeeId: null` + `commissionAmount: 0`. */
  const [employee, setEmployee] = useState<EmployeeSearchResult | null>(
    transaction.employee
      ? { id: transaction.employee.id, name: transaction.employee.name }
      : null
  );
  const [commission, setCommission] = useState(
    String(transaction.commissionAmount ?? 0)
  );
  const [commissionError, setCommissionError] = useState("");
  /* Denominates the amount above. Write-only — the server converts to PKR and
     never returns it, so an edit always re-states the currency. */
  const [commissionCurrency, setCommissionCurrency] = useState<CommissionCurrency>("PKR");
  /** "Create <term>" from the employee picker, same as the sale modal. */
  const [createEmployeeName, setCreateEmployeeName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Let the nested create-employee modal take Escape first.
      if (event.key === "Escape" && createEmployeeName === null) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, createEmployeeName]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextAmount = Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      setError("Enter an amount of zero or more.");
      return;
    }
    const nextCommission = Number(commission);
    if (employee && (!Number.isFinite(nextCommission) || nextCommission < 0)) {
      setCommissionError("Enter a commission of zero or more.");
      return;
    }

    setSaving(true);
    try {
      await onSave(transaction.id, {
        // Reassigning the client does NOT refresh the denormalized clientName
        // server-side, so send both whenever the client changes.
        ...(client && client.id !== transaction.clientId
          ? { clientId: client.id, clientName: client.clientName }
          : {}),
        saleAmount: nextAmount,
        // Currency is the user's own choice, independent of the account —
        // only a LOCAL account constrains it (to PKR), which the field below
        // enforces by offering nothing else.
        currency,
        ...(bankAccount ? { bankAccountId: bankAccount.id } : {}),
        saleDate: fromDateInputValue(saleDate),
        description: description.trim(),
        // Always sent as a pair. Clearing the employee sends an explicit null
        // alongside a zero amount, which is how the API clears the link.
        ...(employee
          ? {
              employeeId: employee.id,
              commissionAmount: nextCommission,
              commissionCurrency,
            }
          : transaction.employeeId
            ? { employeeId: null, commissionAmount: 0 }
            : {}),
      });
    } catch (err) {
      setError(parseApiError(err).message || "Couldn't update the transaction.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-transaction-title"
    >
      <button
        type="button"
        aria-label="Close edit transaction"
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      {/* Capped at the viewport with the field area as the only scrolling
          region, so the header and Save button stay reachable however many
          fields the form grows to. */}
      <form
        onSubmit={submit}
        className="relative z-10 flex max-h-[calc(100vh-4rem)] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950"
      >
        <div className="shrink-0 border-b border-gray-100 p-6 pb-4 dark:border-gray-800">
          <h2
            id="edit-transaction-title"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            Edit Transaction
          </h2>
          <p className="mt-1 text-xs text-gray-400">Ref {transaction.refId}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
        <div className="mt-0">
          <ClientPicker
            label="Reassign Client (optional)"
            placeholder={transaction.clientName}
            value={client}
            onChange={setClient}
          />
        </div>

        <div className="mt-3">
          <BankAccountPicker
            label="Move to Bank Account (optional)"
            value={bankAccount}
            onChange={(next) => {
              setBankAccount(next);
              // Only a LOCAL account forces the currency; an INTERNATIONAL one
              // leaves the user's existing choice alone.
              if (next?.accountType === "LOCAL") setCurrency(LOCAL_CURRENCY);
            }}
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Currently {transaction.bankAccount?.bankName ?? "—"}. Moving it
            re-categorises the sale; account balances are unaffected.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              // Seeded from the existing sale, so usually non-zero — but a
              // zero-amount sale would otherwise force a delete before typing.
              onFocus={() => {
                if (Number(amount) === 0) setAmount("");
              }}
              onBlur={() => {
                if (amount.trim() === "") setAmount("0");
              }}
              placeholder="0"
              className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Currency
            <AccountingSelect
              label="Currency"
              value={currency}
              // PKR-only against a LOCAL account (a hard 400 otherwise), any
              // currency against an INTERNATIONAL one.
              options={(isLocalAccount
                ? transactionCurrenciesForAccountType("LOCAL")
                : CURRENCIES
              ).map((code) => ({ value: code, label: code }))}
              onChange={(next) => setCurrency(next as Currency)}
              disabled={isLocalAccount}
            />
            {isLocalAccount && (
              <span className="mt-1 block text-[11px] font-normal text-gray-400">
                Local account — PKR only
              </span>
            )}
          </div>
        </div>

        {/* Same picker as Add Sale — the native date input this replaced had a
            different affordance in the two modals for the same field. */}
        <div className="mt-3 text-xs font-medium text-gray-600 dark:text-gray-300">
          Sale Date
          <SingleDateField value={saleDate} onChange={setSaleDate} />
        </div>

        <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1.5 h-16 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>

        <div className="mt-3">
          <EmployeePicker
            onCreateRequest={setCreateEmployeeName}
            value={employee}
            onChange={(next) => {
              setEmployee(next);
              if (!next) {
                setCommission("0");
                setCommissionError("");
              }
            }}
          />
        </div>
        {employee && (
          <>
          {/* Amount and its currency sit on one row — the figure is meaningless
              without the unit, so splitting them across two rows read as two
              unrelated fields. */}
          <div className="mt-3 grid grid-cols-[1fr_7rem] items-end gap-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
              Commission
              <input
                type="number"
                min="0"
                step="0.01"
                value={commission}
                onChange={(event) => {
                  setCommission(event.target.value);
                  setCommissionError("");
                }}
                // Clear a leading "0" on focus so it doesn't become "0500".
                onFocus={() => {
                  if (Number(commission) === 0) setCommission("");
                }}
                onBlur={() => {
                  if (commission.trim() === "") setCommission("0");
                }}
                placeholder="0"
                className={`mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:bg-gray-800 dark:text-gray-100 ${
                  commissionError ? "border-red-400" : "border-gray-200 dark:border-gray-700"
                }`}
              />
            </label>
            {/* Converted to PKR on save; states what the figure beside it is in. */}
            <AccountingSelect
              label="Currency"
              value={commissionCurrency}
              options={COMMISSION_CURRENCIES.map((code) => ({ value: code, label: code }))}
              onChange={(next) => setCommissionCurrency(next as CommissionCurrency)}
            />
          </div>
          {commissionError && (
            <p role="alert" className="mt-1 text-xs font-normal text-red-500">
              {commissionError}
            </p>
          )}
          {/* Sync is fully reversible server-side: `commissionAdjustments()`
              nets the change into a delta, reverses the old employee's amount
              when reassigned, and unwinds it entirely on delete. No manual
              correction needed, so this is informational rather than a
              warning. */}
          <p className="mt-1 text-[11px] font-normal text-gray-400">
            The employee&apos;s pending commission updates by the difference.
            Reassigning or clearing it moves the amount too.
          </p>
          </>
        )}


        </div>

        <div className="shrink-0 border-t border-gray-100 p-6 pt-4 dark:border-gray-800">
          {error && (
            <p role="alert" className="mb-3 text-sm text-red-500">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-lg bg-[linear-gradient(90deg,#6547f7_0%,#5431ed_100%)] text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
    <EmployeeFormModal
      isOpen={createEmployeeName !== null}
      initialName={createEmployeeName ?? ""}
      onClose={() => setCreateEmployeeName(null)}
      onSaved={(created) => {
        setEmployee({ id: created.id, name: created.name });
        setCreateEmployeeName(null);
      }}
    />
    </>,
    document.body
  );
}

export default function TransactionsView() {
  const { canWrite } = useAccountingAccess();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<AccountingTransaction | null>(null);
  const [deleting, setDeleting] = useState<AccountingTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const tableSizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Measures the space the table *could* occupy to derive the page size (and so
  // the max-height cap). The card itself shrinks to fit however many rows the
  // current page actually has — this only sets the ceiling.
  useEffect(() => {
    const sizer = tableSizerRef.current;
    if (!sizer) return;

    const updateAutomaticPageSize = () => {
      // Space left for rows = the sizer minus everything in it that isn't a row.
      const available =
        sizer.clientHeight -
        CARD_TITLE_BAR_HEIGHT -
        CARD_BORDER_HEIGHT -
        PAGINATION_ROW_HEIGHT -
        TABLE_HEADER_HEIGHT;
      const nextSize = Math.max(1, Math.floor(available / ROW_HEIGHT));
      setPageSize((current) => (current === nextSize ? current : nextSize));
    };

    const observer = new ResizeObserver(updateAutomaticPageSize);
    observer.observe(sizer);
    return () => observer.disconnect();
  }, []);

  // A relative preset resolves to concrete dates; the API expands a bare
  // YYYY-MM-DD to UTC day boundaries on `saleDate`.
  const dateRange = useMemo(() => {
    if (datePreset === "custom") {
      // Both ends or neither: a lone date is a 422, and a start tapped
      // without an end is a half-built range, not a filter.
      return dateFrom && dateTo
        ? { from: dateFrom, to: dateTo }
        : { from: undefined, to: undefined };
    }
    if (datePreset === "7" || datePreset === "30") {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - (Number(datePreset) - 1));
      return { from: start.toISOString().slice(0, 10), to: undefined };
    }
    return { from: undefined, to: undefined };
  }, [datePreset, dateFrom, dateTo]);

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, currencies, pageSize, dateRange]);

  const params = useMemo<TransactionListParams>(
    () => ({
      q: debouncedSearch.trim() || undefined,
      page,
      limit: pageSize,
      currency: currencies.length ? currencies : undefined,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      // Order by when the sale happened, not when the row was inserted — a
      // backdated entry belongs in its historical position.
      sortBy: "saleDate",
      sortOrder: "desc",
    }),
    [debouncedSearch, page, pageSize, currencies, dateRange]
  );

  const {
    transactions,
    meta,
    isLoading,
    error,
    updateTransaction,
    deleteTransaction,
  } = useAccountingTransactions(params);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const activeFilterCount =
    currencies.length +
    (debouncedSearch.trim() ? 1 : 0) +
    (datePreset === "all" ? 0 : 1);

  const clearFilters = () => {
    setSearch("");
    setCurrencies([]);
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const total = meta?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(deleting.id);
      toast.success("Transaction deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't delete the transaction.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#fafaff] px-4 py-3 dark:bg-gray-907 sm:px-6">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-end gap-2">
        <div className="relative w-full sm:w-[240px]">
          <LuSearch
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search client or ref ID..."
            aria-label="Search transactions"
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-800 shadow-sm outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-901 dark:text-gray-100"
          />
        </div>
        <DateDropdown
          preset={datePreset}
          from={dateFrom}
          to={dateTo}
          onChange={(preset, from = "", to = "") => {
            setDatePreset(preset);
            setDateFrom(from);
            setDateTo(to);
          }}
        />
        <FilterDropdown
          label="Currency"
          icon={<LuCoins />}
          values={CURRENCIES}
          selected={currencies}
          onChange={setCurrencies}
        />
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex h-10 items-center gap-1 rounded-xl px-3 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-905 dark:hover:text-gray-100"
          >
            <LuX className="h-4 w-4" /> Clear all
          </button>
        )}
      </div>

      {/* Sizer: claims the leftover vertical space so the ResizeObserver can
          measure it, but renders nothing itself. The card inside sizes to its
          rows and only scrolls once it hits the sizer's height. */}
      <div ref={tableSizerRef} className="flex min-h-0 flex-1 flex-col">
      <section className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-901">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-5 dark:border-gray-800">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            All Transactions
          </h1>
          <span className="text-xs text-gray-400">
            Showing {transactions.length} of {total.toLocaleString()} records
          </span>
        </div>
        <div className="min-h-0 overflow-auto">
          <table className="w-full min-w-[1100px] table-fixed text-left">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--color-gray-200)] dark:bg-gray-901 dark:shadow-[0_1px_0_0_var(--color-gray-800)]">
              <tr className="h-10 text-xs font-normal text-gray-400">
                <th className="w-[12%] px-5 font-normal">Sale Date</th>
                <th className="w-[18%] px-5 font-normal">Client</th>
                <th className="w-[17%] px-5 font-normal">Bank Account</th>
                <th className="w-[12%] px-5 font-normal">Ref ID</th>
                <th className="w-[13%] px-5 text-right font-normal">Amount</th>
                <th className="w-[14%] px-5 font-normal">Employee</th>
                <th className="w-[14%] px-5 text-right font-normal">Commission</th>
                {canWrite && <th className="w-[10%] px-5 text-right font-normal">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  style={{ height: ROW_HEIGHT }}
                  className="text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-905/70"
                >
                  <td
                    className="px-5 text-xs whitespace-nowrap"
                    title={`Entered ${formatIsoDate(transaction.createdAt)}`}
                  >
                    {formatIsoDate(transaction.saleDate)}
                  </td>
                  <td className="truncate px-5">{transaction.clientName}</td>
                  <td className="px-5">
                    <div className="flex items-center gap-3">
                      <BankAvatar
                        bankName={transaction.bankAccount?.bankName ?? "?"}
                        logoUrl={transaction.bankAccount?.logoUrl}
                      />
                      <span className="truncate">
                        {transaction.bankAccount?.bankName ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="truncate px-5 text-xs text-gray-500 dark:text-gray-400">
                    {transaction.refId}
                  </td>
                  <td className="px-5 text-right font-medium whitespace-nowrap">
                    {formatMoney(transaction.currency, transaction.saleAmount)}
                  </td>
                  <td className="truncate px-5 text-xs text-gray-500 dark:text-gray-400">
                    {transaction.employee?.name ?? "—"}
                  </td>
                  {/* Commission is PKR regardless of the sale's own currency. */}
                  <td className="px-5 text-right whitespace-nowrap">
                    {transaction.employee
                      ? formatMoney(LOCAL_CURRENCY, transaction.commissionAmount ?? 0)
                      : "—"}
                  </td>
                  {canWrite && (
                    <td className="px-5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title={`Delete ${transaction.refId}`}
                          aria-label={`Delete transaction ${transaction.refId}`}
                          onClick={() => setDeleting(transaction)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                        >
                          <LuTrash2 className="h-[19px] w-[19px]" />
                        </button>
                        <button
                          type="button"
                          title={`Edit ${transaction.refId}`}
                          aria-label={`Edit transaction ${transaction.refId}`}
                          onClick={() => setEditing(transaction)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-brand-500/10 hover:text-brand-500"
                        >
                          <LuPencil className="h-[19px] w-[19px]" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 8 : 7} className="p-5">
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-9 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 8 : 7} className="h-64 px-6 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <LuDatabase className="mb-3 h-9 w-9 text-gray-300" />
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        No transactions found
                      </p>
                      <p className="mt-1 text-sm text-gray-400">
                        {activeFilterCount > 0
                          ? "Try changing or clearing your filters."
                          : "Recorded sales will appear here."}
                      </p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-4 text-sm font-medium text-brand-500 hover:text-brand-600"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Inside the sizer and directly after the card, so it tracks the card's
          bottom edge instead of being pinned to the bottom of the page. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pt-3 text-sm text-gray-600 dark:text-gray-400">
        <span>
          {rangeStart.toLocaleString()}&ndash;{rangeEnd.toLocaleString()} of{" "}
          {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous page"
            disabled={!meta?.has_prev}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"
          >
            <LuChevronLeft />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={!meta?.has_next}
            onClick={() => setPage((current) => current + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-901 dark:hover:bg-gray-905"
          >
            <LuChevronRight />
          </button>
        </div>
      </div>
      </div>

      {editing && canWrite && (
        <EditTransactionModal
          transaction={editing}
          onClose={() => setEditing(null)}
          onSave={async (id, payload) => {
            await updateTransaction(id, payload);
            toast.success("Transaction updated");
            setEditing(null);
          }}
        />
      )}
      <ConfirmActionModal
        isOpen={canWrite && Boolean(deleting)}
        title="Delete transaction?"
        /* Deleting also reverses any commission it carried, off-screen on the
           employee record — worth stating before the fact. */
        description={
          deleting
            ? `${deleting.refId} for ${deleting.clientName} will be permanently deleted.` +
              (deleting.employee && (deleting.commissionAmount ?? 0) > 0
                ? ` ${deleting.employee.name}'s pending commission will be reduced accordingly.`
                : "")
            : ""
        }
        confirmLabel="Delete transaction"
        isLoading={isDeleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
