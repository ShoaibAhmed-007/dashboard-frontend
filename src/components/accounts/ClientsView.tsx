"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuChevronLeft,
  LuChevronRight,
  LuList,
  LuPencil,
  LuPlus,
  LuSearch,
  LuTrash2,
  LuUsers,
  LuX,
} from "react-icons/lu";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { parseApiError } from "@/lib/api";
import { useAccountingAccess } from "@/hooks/useAccountingAccess";
import { useAccountingClients } from "@/hooks/useAccounting";
import type {
  AccountingClient,
  ClientListParams,
} from "@/services/accounting.service";
import { avatarColors, initials } from "@/components/accounts/avatar";
import { formatMoney } from "@/components/accounts/platformMeta";
import CreateClientModal from "@/components/accounts/CreateClientModal";
import ClientTransactionsModal from "@/components/accounts/ClientTransactionsModal";

// Layout constants used to derive how many rows fit in the available space.
// They must stay in sync with the markup below: the row height, the sticky
// column header, the card's title bar + borders, and the pagination row that
// sits inside the sizer beneath the card.
const ROW_HEIGHT = 56;
const TABLE_HEADER_HEIGHT = 40;
const CARD_TITLE_BAR_HEIGHT = 44;
const CARD_BORDER_HEIGHT = 2;
const PAGINATION_ROW_HEIGHT = 44;

/**
 * `PATCH /clients/:clientId` accepts `clientName` only — revenue and currency are
 * create-only server-side — so this is deliberately a rename-only dialog rather
 * than a full edit form with disabled fields.
 */
function RenameClientModal({
  client,
  onClose,
  onSave,
}: {
  client: AccountingClient;
  onClose: () => void;
  onSave: (clientId: string, clientName: string) => Promise<void>;
}) {
  const [clientName, setClientName] = useState(client.clientName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = clientName.trim();
    if (!name) {
      setError("Enter a client name.");
      return;
    }
    setSaving(true);
    try {
      await onSave(client.id, name);
    } catch (err) {
      setError(parseApiError(err).message || "Couldn't rename the client.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-client-title"
    >
      <button
        type="button"
        aria-label="Close rename client"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-[360px] rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950"
      >
        <h2
          id="rename-client-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          Rename Client
        </h2>
        <label className="mt-5 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Client Name
          <input
            autoFocus
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>
        <p className="mt-2 text-[11px] leading-4 text-gray-400">
          Existing transactions keep the client name they were recorded with.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {error}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
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
      </form>
    </div>,
    document.body
  );
}

export default function ClientsView() {
  const { canWrite } = useAccountingAccess();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<AccountingClient | null>(null);
  const [deleting, setDeleting] = useState<AccountingClient | null>(null);
  const [viewingTransactions, setViewingTransactions] =
    useState<AccountingClient | null>(null);
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

    const updatePageSize = () => {
      // Space left for rows = the sizer minus everything in it that isn't a row.
      const availableHeight =
        sizer.clientHeight -
        CARD_TITLE_BAR_HEIGHT -
        CARD_BORDER_HEIGHT -
        PAGINATION_ROW_HEIGHT -
        TABLE_HEADER_HEIGHT;
      const nextSize = Math.max(1, Math.floor(availableHeight / ROW_HEIGHT));
      setPageSize((current) => (current === nextSize ? current : nextSize));
    };

    const observer = new ResizeObserver(updatePageSize);
    observer.observe(sizer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize]);

  const params = useMemo<ClientListParams>(
    () => ({
      q: debouncedSearch.trim() || undefined,
      page,
      limit: pageSize,
      sortBy: "clientName",
      sortOrder: "asc",
    }),
    [debouncedSearch, page, pageSize]
  );

  const { clients, meta, isLoading, error, renameClient, deleteClient } =
    useAccountingClients(params);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const total = meta?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  // The Actions column renders for both roles: a CEO gets the read-only
  // "view transactions" button, and only an accountant gets rename/delete
  // beside it.
  const columnCount = 4;

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteClient(deleting.id);
      toast.success(`${deleting.clientName} deleted`);
      setDeleting(null);
    } catch (err) {
      const { message, code } = parseApiError(err);
      // The API blocks deletion with 409 while any transaction still references
      // the client (Transaction.client is onDelete: Restrict).
      toast.error(
        code === "CONFLICT"
          ? `${deleting.clientName} has ${deleting._count.transactions} transaction(s) and can't be deleted.`
          : message || "Couldn't delete the client."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#fafaff] px-4 py-3 dark:bg-gray-907 sm:px-6">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-end gap-2">
        <div className="relative w-full sm:w-[262px]">
          <LuUsers
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-700 dark:text-gray-300"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter client..."
            aria-label="Filter clients"
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-9 text-sm text-gray-800 shadow-sm outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-901 dark:text-gray-100"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear client filter"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905 dark:hover:text-gray-200"
            >
              <LuX className="h-4 w-4" />
            </button>
          )}
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#6547f7_0%,#7c2cf3_100%)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <LuPlus className="h-4 w-4" />
            Add Client
          </button>
        )}
      </div>

      {/* Sizer: claims the leftover vertical space so the ResizeObserver can
          measure it, but renders nothing itself. The card inside sizes to its
          rows and only scrolls once it hits the sizer's height. */}
      <div ref={tableSizerRef} className="flex min-h-0 flex-1 flex-col">
      <section className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-901">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-gray-200 px-5 dark:border-gray-800">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Clients</h1>
          <span className="text-xs text-gray-400">{total.toLocaleString()} clients</span>
        </div>

        <div className="min-h-0 overflow-auto">
          <table className="w-full min-w-[820px] table-fixed text-left">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--color-gray-200)] dark:bg-gray-901 dark:shadow-[0_1px_0_0_var(--color-gray-800)]">
              <tr className="h-10 text-xs text-gray-400">
                <th className="w-[46%] px-5 font-normal">Client</th>
                <th className="w-[28%] px-5 text-right font-normal">Total Amount (USD)</th>
                <th className="w-[12%] px-5 text-right font-normal">Payments</th>
                <th className="w-[14%] px-5 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const { background, color } = avatarColors(client.clientName);
                const hasTransactions = client._count.transactions > 0;
                return (
                  <tr
                    key={client.id}
                    style={{ height: ROW_HEIGHT }}
                    className="text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-905/70"
                  >
                    <td className="px-5">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                          style={{ backgroundColor: background, color }}
                        >
                          {initials(client.clientName)}
                        </span>
                        <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                          {client.clientName}
                        </span>
                      </div>
                    </td>
                    {/* `totalRevenueUsd`, not the legacy hand-typed
                        `totalRevenue` — that one is frozen at 0 for every
                        client created since the backend stopped accepting it.
                        Every currency converted at live FX and summed. */}
                    <td className="px-5 text-right font-medium whitespace-nowrap">
                      {formatMoney("USD", client.totalRevenueUsd)}
                    </td>
                    <td className="px-5 text-right">{client._count.transactions}</td>
                    <td className="px-5">
                      <div className="flex justify-end gap-1">
                        {/* Read-only — both roles get this one. */}
                        <button
                          type="button"
                          title={
                            hasTransactions
                              ? `View ${client._count.transactions} transactions`
                              : `${client.clientName} has no transactions yet`
                          }
                          aria-label={`View transactions for ${client.clientName}`}
                          disabled={!hasTransactions}
                          onClick={() => setViewingTransactions(client)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-brand-500/10 hover:text-brand-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        >
                          <LuList className="h-[19px] w-[19px]" />
                        </button>
                        {canWrite && (
                          <>
                            <button
                              type="button"
                              title={
                                hasTransactions
                                  ? "Clients with transactions can't be deleted"
                                  : `Delete ${client.clientName}`
                              }
                              aria-label={`Delete ${client.clientName}`}
                              disabled={hasTransactions}
                              onClick={() => setDeleting(client)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:hover:bg-red-500/10"
                            >
                              <LuTrash2 className="h-[19px] w-[19px]" />
                            </button>
                            <button
                              type="button"
                              title={`Rename ${client.clientName}`}
                              aria-label={`Rename ${client.clientName}`}
                              onClick={() => setRenaming(client)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-brand-500/10 hover:text-brand-500"
                            >
                              <LuPencil className="h-[19px] w-[19px]" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {isLoading && clients.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="p-5">
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
              {!isLoading && clients.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="h-64 px-6 text-center">
                    <LuSearch className="mx-auto mb-3 h-9 w-9 text-gray-300" />
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      No clients found
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      {debouncedSearch.trim()
                        ? "Try a different client name."
                        : "Add your first client to start recording sales."}
                    </p>
                    {debouncedSearch.trim() && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="mt-4 text-sm font-medium text-brand-500 hover:text-brand-600"
                      >
                        Clear filter
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Inside the sizer and directly after the card, so it tracks the card's
          bottom edge instead of being pinned to the bottom of the page. */}
      <div className="flex shrink-0 items-center justify-between gap-3 pt-2 text-sm text-gray-600 dark:text-gray-400">
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

      {/* Read-only, so deliberately not gated on `canWrite` — the backend
          serves GET /clients to a CEO too, and this only renders what the
          list row already carries. */}
      <ClientTransactionsModal
        client={viewingTransactions}
        onClose={() => setViewingTransactions(null)}
      />
      {canWrite && (
        <CreateClientModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      )}
      {renaming && canWrite && (
        <RenameClientModal
          client={renaming}
          onClose={() => setRenaming(null)}
          onSave={async (clientId, clientName) => {
            await renameClient(clientId, { clientName });
            toast.success("Client renamed");
            setRenaming(null);
          }}
        />
      )}
      <ConfirmActionModal
        isOpen={canWrite && Boolean(deleting)}
        title="Delete client?"
        description={
          deleting ? `${deleting.clientName} will be permanently deleted.` : ""
        }
        confirmLabel="Delete client"
        isLoading={isDeleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
