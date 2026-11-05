"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuChevronDown, LuPlus, LuX } from "react-icons/lu";
import { useClientAll } from "@/hooks/useAccounting";
import type { ClientSearchResult } from "@/services/accounting.service";
import { useAnchoredDropdown } from "@/components/accounts/useAnchoredDropdown";

/**
 * Client combobox. `POST /transactions` requires a resolved `clientId` — the
 * API dropped the old find-or-create-by-name behavior — so this is the only way
 * to attach a sale to a client.
 *
 * Opening it lists every client A–Z; typing narrows that list locally. The
 * backend stopped filtering (`/clients/search` ignores `q` and returns
 * everything), so filtering here is not an optimisation but the only place it
 * happens.
 *
 * `onCreateRequest`, when provided, surfaces a "Create <term>" row so an
 * accountant entering a sale for a first-time client isn't stuck.
 */
export default function ClientPicker({
  value,
  onChange,
  onCreateRequest,
  label = "Client",
  placeholder = "Select or search clients...",
  autoFocus = false,
  error,
}: {
  value: ClientSearchResult | null;
  onChange: (client: ClientSearchResult | null) => void;
  onCreateRequest?: (clientName: string) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  error?: string;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = open && !value;
  // Portaled so the list never adds to the modal's scroll height.
  const panelStyle = useAnchoredDropdown(triggerRef, isOpen);
  const { clients, isLoading } = useClientAll();

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const select = (client: ClientSearchResult) => {
    onChange(client);
    setTerm("");
    setOpen(false);
  };

  const trimmed = term.trim();

  // Substring match, and A–Z regardless of the order the API returned. The
  // backend already sorts, but re-sorting keeps the list correct if it stops.
  const results = useMemo(() => {
    const needle = trimmed.toLowerCase();
    return clients
      .filter((client) =>
        needle ? client.clientName.toLowerCase().includes(needle) : true
      )
      .sort((a, b) =>
        a.clientName.localeCompare(b.clientName, undefined, {
          sensitivity: "base",
        })
      );
  }, [clients, trimmed]);

  const showCreate =
    onCreateRequest &&
    trimmed.length > 0 &&
    !isLoading &&
    !results.some((r) => r.clientName.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
      {label}
      <div ref={containerRef} className="relative mt-1.5">
        {value ? (
          // Once resolved, show the selection as a chip — the id is what matters
          // downstream, so free-typing over it would be misleading.
          <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800">
            <span className="flex-1 truncate text-sm text-gray-800 dark:text-gray-100">
              {value.clientName}
            </span>
            <button
              type="button"
              aria-label="Clear selected client"
              onClick={() => {
                onChange(null);
                setOpen(true);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905"
            >
              <LuX className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div ref={triggerRef} className="relative">
            <input
              autoFocus={autoFocus}
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              aria-label={label}
              className={`h-10 w-full rounded-lg border bg-white px-3 pr-9 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:bg-gray-800 dark:text-gray-100 ${
                error
                  ? "border-red-400"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            />
            <LuChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        )}

        {isOpen && panelStyle && createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className="z-[10050] overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            {isLoading && results.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">
                Loading clients...
              </p>
            )}
            {results.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => select(client)}
                className="block w-full truncate rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"
              >
                {client.clientName}
              </button>
            ))}
            {!isLoading && results.length === 0 && !showCreate && (
              <p className="px-3 py-2 text-xs text-gray-400">
                {trimmed ? "No clients found." : "No clients yet."}
              </p>
            )}
            {showCreate && (
              <button
                type="button"
                onClick={() => {
                  onCreateRequest(trimmed);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-brand-500 hover:bg-brand-500/10"
              >
                <LuPlus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Create &ldquo;{trimmed}&rdquo;</span>
              </button>
            )}
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
