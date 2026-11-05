"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuPencil,
  LuPlus,
  LuSearch,
  LuStore,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { parseApiError } from "@/lib/api";
import { useAccountingAccess } from "@/hooks/useAccountingAccess";
import { useAccountingVendors } from "@/hooks/useAccounting";
import type {
  AccountingVendor,
  VendorListParams,
} from "@/services/accounting.service";
import { avatarColors, initials } from "@/components/accounts/avatar";
import { formatIsoDate, formatMoney } from "@/components/accounts/platformMeta";
import VendorFormModal from "@/components/accounts/VendorFormModal";

// Same layout constants as EmployeesView — must stay in sync with the markup
// below: row height, sticky header, card chrome and the pagination row all
// factor into how many rows fit.
const ROW_HEIGHT = 56;
const TABLE_HEADER_HEIGHT = 40;
const CARD_TITLE_BAR_HEIGHT = 44;
const CARD_BORDER_HEIGHT = 2;
const PAGINATION_ROW_HEIGHT = 44;

export default function VendorsView() {
  const { canWrite } = useAccountingAccess();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountingVendor | null>(null);
  const [deleting, setDeleting] = useState<AccountingVendor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const tableSizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const sizer = tableSizerRef.current;
    if (!sizer) return;

    const updatePageSize = () => {
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

  const params = useMemo<VendorListParams>(
    () => ({
      q: debouncedSearch.trim() || undefined,
      page,
      limit: pageSize,
      // `pendingPayment` is not a sortable field on the API, so the list is
      // always name-ordered; sorting by amount would have to happen here.
      sortBy: "name",
      sortOrder: "asc",
    }),
    [debouncedSearch, page, pageSize]
  );

  const {
    vendors,
    meta,
    isLoading,
    error,
    deleteVendor,
    totalPendingPayment,
  } = useAccountingVendors(params);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const total = meta?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const columnCount = 4;

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await deleteVendor(deleting.id);
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message || "Couldn't delete the vendor.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#fafaff] px-4 py-3 dark:bg-gray-907 sm:px-6">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-end gap-2">
        {/* Server-summed over every row matching the current filter, so it
            narrows with the search rather than always showing the workspace
            total — the caption says which of the two is on screen. Hidden
            entirely when the API doesn't send it, since a 0 would read as a
            real figure. */}
        {totalPendingPayment !== undefined && (
          <div className="mr-auto rounded-xl bg-[#000000] px-4 py-2 text-white">
            <p className="text-xs text-gray-300">
              {debouncedSearch ? "Pending (filtered)" : "Total Pending Payment"}
            </p>
            <p className="text-lg font-semibold leading-tight">
              {formatMoney("PKR", totalPendingPayment)}
            </p>
          </div>
        )}
        <div className="relative w-full sm:w-[262px]">
          <LuStore
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-700 dark:text-gray-300"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter vendor..."
            aria-label="Filter vendors"
            className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-9 text-sm text-gray-800 shadow-sm outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-901 dark:text-gray-100"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear vendor filter"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905 dark:hover:text-gray-200"
            >
              <LuX className="h-4 w-4" />
            </button>
          )}
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#6547f7_0%,#7c2cf3_100%)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <LuPlus className="h-4 w-4" />
            Add Vendor
          </button>
        )}
      </div>

      <div ref={tableSizerRef} className="flex min-h-0 flex-1 flex-col">
      <section className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-901">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-gray-200 px-5 dark:border-gray-800">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Vendors</h1>
          <span className="text-xs text-gray-400">{total.toLocaleString()} vendors</span>
        </div>

        <div className="min-h-0 overflow-auto">
          <table className="w-full min-w-[680px] table-fixed text-left">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--color-gray-200)] dark:bg-gray-901 dark:shadow-[0_1px_0_0_var(--color-gray-800)]">
              <tr className="h-10 text-xs text-gray-400">
                <th className="w-[40%] px-5 font-normal">Vendor</th>
                <th className="w-[28%] px-5 text-right font-normal">
                  Pending Payment (PKR)
                </th>
                <th className="w-[20%] px-5 font-normal">Due Date</th>
                <th className="w-[12%] px-5 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => {
                const { background, color } = avatarColors(vendor.name);
                return (
                  <tr
                    key={vendor.id}
                    style={{ height: ROW_HEIGHT }}
                    className="text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-905/70"
                  >
                    <td className="px-5">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                          style={{ backgroundColor: background, color }}
                        >
                          {initials(vendor.name)}
                        </span>
                        <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                          {vendor.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 text-right font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">
                      {formatMoney("PKR", vendor.pendingPayment)}
                    </td>
                    {/* Display only — the server attaches no overdue meaning to
                        this date, so it is not styled as a warning. */}
                    <td className="px-5 whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {vendor.dueDate ? (
                        formatIsoDate(vendor.dueDate)
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5">
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <>
                            {/* A vendor has no linked records, so deletion is
                                unconditional — this confirm is the only
                                safeguard. */}
                            <button
                              type="button"
                              title={`Delete ${vendor.name}`}
                              aria-label={`Delete ${vendor.name}`}
                              onClick={() => setDeleting(vendor)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                            >
                              <LuTrash2 className="h-[19px] w-[19px]" />
                            </button>
                            <button
                              type="button"
                              title={`Edit ${vendor.name}`}
                              aria-label={`Edit ${vendor.name}`}
                              onClick={() => setEditing(vendor)}
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
              {isLoading && vendors.length === 0 && (
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
              {!isLoading && vendors.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="h-64 px-6 text-center">
                    <LuSearch className="mx-auto mb-3 h-9 w-9 text-gray-300" />
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      No vendors found
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      {debouncedSearch.trim()
                        ? "Try a different vendor name."
                        : "Add your first vendor to start tracking what you owe."}
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

      {canWrite && (
        <VendorFormModal
          isOpen={formOpen || editing !== null}
          vendor={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
      <ConfirmActionModal
        isOpen={canWrite && Boolean(deleting)}
        title="Delete vendor?"
        description={deleting ? `${deleting.name} will be permanently deleted.` : ""}
        confirmLabel="Delete vendor"
        isLoading={isDeleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
