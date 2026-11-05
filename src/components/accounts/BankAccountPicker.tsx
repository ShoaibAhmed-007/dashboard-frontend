"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuChevronDown, LuLandmark, LuSearch } from "react-icons/lu";
import { useBankAccounts } from "@/hooks/useAccounting";
import BankAvatar from "@/components/accounts/BankAvatar";
import { useAnchoredDropdown } from "@/components/accounts/useAnchoredDropdown";
import type { BankAccount } from "@/services/accounting.service";

/**
 * Picks the bank account a transaction is recorded against. Required on create.
 *
 * Typing filters the list in place: the whole page is already in memory (see
 * the fetch below), so this is a local substring match rather than another
 * request — unlike `ClientPicker`, which debounce-searches the API.
 *
 * The account no longer dictates the transaction's currency — an INTERNATIONAL
 * account takes any currency (Whop can record an HKD or AED sale). The one
 * remaining rule is that a LOCAL account only accepts PKR, which the calling
 * form enforces on its currency field. The `currencyType` shown per row is the
 * account's own denomination, not a constraint on what it can receive.
 */
export default function BankAccountPicker({
  value,
  onChange,
  label = "Bank Account",
  error,
  disabled = false,
}: {
  value: BankAccount | null;
  onChange: (account: BankAccount | null) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Rendered through a portal, so it can't grow the modal's scroll area.
  const panelStyle = useAnchoredDropdown(triggerRef, open);

  // Bank accounts are few; fetch one page and pick from it rather than
  // debounce-searching like the client picker does.
  const { bankAccounts, isLoading } = useBankAccounts({
    page: 1,
    limit: 100,
    sortBy: "bankName",
    sortOrder: "asc",
  });

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      // The panel lives outside `containerRef` now, so test it separately.
      if (
        !containerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
        setTerm("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* Focus the search box as the list opens, so the bank name can be typed
     straight away without a second click.
   *
   * Depends on `panelStyle`, not just `open`: the panel is portaled and only
   * renders once `useAnchoredDropdown` has measured the trigger, so on the
   * first open the input does not exist yet when `open` flips. Waiting for the
   * measurement is what makes the focus actually land. */
  useEffect(() => {
    if (open && panelStyle) searchRef.current?.focus();
  }, [open, panelStyle]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return bankAccounts;
    return bankAccounts.filter((account) =>
      account.bankName.toLowerCase().includes(needle)
    );
  }, [bankAccounts, term]);

  // Every transaction needs an account, so with none the form can't be
  // completed — say so instead of showing an empty dropdown.
  if (!isLoading && bankAccounts.length === 0) {
    return (
      <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
        {label}
        <div className="mt-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-center dark:border-gray-700">
          <LuLandmark className="mx-auto mb-1 h-5 w-5 text-gray-300" />
          <p className="text-xs font-normal text-gray-500 dark:text-gray-400">
            No bank accounts yet — every sale must post to one.
          </p>
          <Link
            href="/accounts/balances"
            className="mt-1 inline-block text-xs font-medium text-brand-500 hover:text-brand-600"
          >
            Create a bank account &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
      {label}
      <div ref={containerRef} className="relative mt-1.5">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          onClick={() =>
            setOpen((current) => {
              if (current) setTerm("");
              return !current;
            })
          }
          className={`flex h-10 w-full items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-800 ${
            error
              ? "border-red-400"
              : open
                ? "border-brand-500 ring-2 ring-brand-500/10"
                : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
          }`}
        >
          {value ? (
            <>
              <BankAvatar bankName={value.bankName} logoUrl={value.logoUrl} size={24} />
              <span className="flex-1 truncate text-gray-800 dark:text-gray-100">
                {value.bankName}
              </span>
            </>
          ) : (
            <span className="flex-1 truncate text-gray-400">
              {isLoading ? "Loading accounts..." : "Select a bank account"}
            </span>
          )}
          <LuChevronDown
            className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && panelStyle && createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label={label}
            style={panelStyle}
            className="z-[10050] flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            {/* Sticky so the field stays reachable while the list scrolls. */}
            <div className="relative border-b border-gray-100 p-1 dark:border-gray-700">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setOpen(false);
                    setTerm("");
                  }
                  // Enter picks the only remaining match — the common case
                  // after typing a few characters.
                  if (event.key === "Enter" && filtered.length === 1) {
                    event.preventDefault();
                    onChange(filtered[0]);
                    setOpen(false);
                    setTerm("");
                  }
                }}
                placeholder="Search bank accounts..."
                className="h-9 w-full rounded-md bg-transparent pl-8 pr-2 text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs font-normal text-gray-400">
                No bank accounts match &ldquo;{term.trim()}&rdquo;.
              </p>
            )}
            {filtered.map((account) => (
              <button
                key={account.id}
                type="button"
                role="option"
                aria-selected={account.id === value?.id}
                onClick={() => {
                  onChange(account);
                  setOpen(false);
                  setTerm("");
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                  account.id === value?.id
                    ? "bg-brand-500/10"
                    : "hover:bg-gray-100 dark:hover:bg-gray-905"
                }`}
              >
                <BankAvatar bankName={account.bankName} logoUrl={account.logoUrl} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-gray-800 dark:text-gray-100">
                    {account.bankName}
                  </span>
                </span>
              </button>
            ))}
            </div>
          </div>,
          document.body
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs font-normal text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
