"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LuSearch, LuUsers, LuReceipt, LuX } from "react-icons/lu";
import { useDashboardSearch } from "@/hooks/useAccounting";
import { avatarColors, initials } from "@/components/accounts/avatar";
import { formatIsoDate, formatMoney } from "@/components/accounts/platformMeta";

const PANEL_W = 560;

/**
 * Global accounting search, shown in place of the ClickUp task search whenever
 * the user is on an /accounts route. Backed by
 * `GET /accounting-dashboard/search`, which returns up to 5 clients and
 * 5 transactions — selecting a result deep-links to the relevant page.
 */
export default function AccountingSearchModal({
  isOpen,
  onClose,
  anchorRect,
}: {
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { clients, transactions, isLoading, error } = useDashboardSearch(query);

  // Every dismissal path routes through here so the query never survives into
  // the next opening. Defined as a callback (not an effect) to keep the reset
  // off the render path.
  const close = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  // Focus once the portal has painted — the caret has nowhere to land before that.
  useEffect(() => {
    if (!isOpen) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, close]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  // Never portals during SSR: the parent only renders this on the client and it
  // bails before createPortal whenever closed.
  if (!isOpen) return null;

  // Anchored under the header search bar, matching GlobalTaskSearchModal.
  const panelStyle: React.CSSProperties = anchorRect
    ? {
        position: "fixed",
        top: anchorRect.bottom + 6,
        left: Math.min(
          anchorRect.left + anchorRect.width / 2 - PANEL_W / 2,
          window.innerWidth - PANEL_W - 12
        ),
        width: PANEL_W,
        zIndex: 9999,
      }
    : {
        position: "fixed",
        top: "60px",
        left: "50%",
        transform: "translateX(-50%)",
        width: PANEL_W,
        zIndex: 9999,
      };

  const trimmed = query.trim();
  const hasResults = clients.length > 0 || transactions.length > 0;

  const go = (path: string) => {
    router.push(path);
    close();
  };

  return createPortal(
    <div
      ref={panelRef}
      style={panelStyle}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-901"
    >
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
        <LuSearch className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search client, transaction, reference..."
          className="flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 dark:text-white"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {trimmed.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            Search across clients, transactions and reference IDs.
          </p>
        )}

        {trimmed.length > 0 && isLoading && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
              />
            ))}
          </div>
        )}

        {trimmed.length > 0 && !isLoading && error && (
          <p className="px-4 py-8 text-center text-sm text-red-500">{error}</p>
        )}

        {trimmed.length > 0 && !isLoading && !error && !hasResults && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            No matches for &ldquo;{trimmed}&rdquo;.
          </p>
        )}

        {clients.length > 0 && (
          <section>
            <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <LuUsers className="h-3 w-3" /> Clients
            </p>
            {clients.map((client) => {
              const { background, color } = avatarColors(client.clientName);
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => go("/accounts/clients")}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-905"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{ backgroundColor: background, color }}
                  >
                    {initials(client.clientName)}
                  </span>
                  {/* No revenue figure here: this endpoint returns only the
                      legacy `totalRevenue`, which is frozen at 0 for every
                      client created since the backend stopped accepting it.
                      Showing a permanent "USD 0" would be worse than showing
                      nothing — the real figure lives on the Clients screen. */}
                  <span className="flex-1 truncate text-sm text-gray-800 dark:text-gray-100">
                    {client.clientName}
                  </span>
                </button>
              );
            })}
          </section>
        )}

        {transactions.length > 0 && (
          <section className="border-t border-gray-100 dark:border-gray-800">
            <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <LuReceipt className="h-3 w-3" /> Transactions
            </p>
            {transactions.map((transaction) => (
              <button
                key={transaction.id}
                type="button"
                onClick={() => go("/accounts/transactions")}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-905"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-800 dark:text-gray-100">
                    {transaction.clientName}
                  </p>
                  <p className="truncate text-[11px] text-gray-400">
                    {transaction.refId}
                    {transaction.description ? ` · ${transaction.description}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {formatMoney(transaction.currency, transaction.saleAmount)}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {formatIsoDate(transaction.saleDate)}
                  </p>
                </div>
              </button>
            ))}
          </section>
        )}

        {hasResults && (
          <p className="border-t border-gray-100 px-3 py-2 text-[11px] text-gray-400 dark:border-gray-800">
            Showing up to 5 of each. Use the Clients or Transactions page for the
            full list.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
