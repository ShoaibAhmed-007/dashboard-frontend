"use client";

import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

/**
 * Structural, not imported from any one module's service file — several
 * modules' paginated envelopes (`PaginationMeta` in it-management,
 * `AccountingMeta`, `TaskSearchMeta`, ...) are all this same shape
 * (`{ page, limit, total, total_pages, has_next, has_prev }`), so this
 * accepts any of them without coupling to one.
 */
export type PaginationMetaLike = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

/**
 * Prev/next pager with a range caption ("21–40 of 143"), matching the
 * pattern already hand-rolled in the accounting module's Vendors/Clients
 * list views — extracted here since several screens (three in
 * IT-management alone) need the identical thing at once, rather than
 * duplicating it per module.
 *
 * Renders nothing when there's only one page, so callers can mount it
 * unconditionally right under a list/table/grid.
 */
export default function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMetaLike | null | undefined;
  onPageChange: (page: number) => void;
}) {
  if (!meta || meta.total_pages <= 1) return null;

  const rangeStart = (meta.page - 1) * meta.limit + 1;
  const rangeEnd = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-gray-600 dark:text-gray-400">
      <span>
        {rangeStart.toLocaleString()}&ndash;{rangeEnd.toLocaleString()} of {meta.total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          disabled={!meta.has_prev}
          onClick={() => onPageChange(meta.page - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <LuChevronLeft />
        </button>
        <span className="px-1 text-xs text-gray-400">
          Page {meta.page} of {meta.total_pages}
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={!meta.has_next}
          onClick={() => onPageChange(meta.page + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <LuChevronRight />
        </button>
      </div>
    </div>
  );
}
