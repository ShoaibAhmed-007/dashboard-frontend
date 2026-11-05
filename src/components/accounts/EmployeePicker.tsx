"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuChevronDown, LuPlus, LuX } from "react-icons/lu";
import { useEmployeeOptions } from "@/hooks/useAccounting";
import type { EmployeeSearchResult } from "@/services/accounting.service";
import { useAnchoredDropdown } from "@/components/accounts/useAnchoredDropdown";

/**
 * Employee combobox. Optional by design — not every sale has an employee
 * attached, so `value` can stay `null` indefinitely.
 *
 * Opening it shows every employee straight away rather than an empty "start
 * typing" prompt: `/employees/search` returns the full list when `q` is
 * omitted, and does the matching itself once a term is typed. Filtering is
 * server-side so a multi-word term matches out of order — "john smith" finds
 * "Smith, John".
 *
 * `onCreateRequest`, when provided, surfaces a "Create <term>" row so
 * recording a sale for a first-time employee isn't a trip to a separate page.
 */
export default function EmployeePicker({
  value,
  onChange,
  onCreateRequest,
  label = "Employee",
  placeholder = "Search employees...",
  error,
}: {
  value: EmployeeSearchResult | null;
  onChange: (employee: EmployeeSearchResult | null) => void;
  onCreateRequest?: (name: string) => void;
  label?: string;
  placeholder?: string;
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
  const { employees: options, isLoading } = useEmployeeOptions(term);

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

  const select = (employee: EmployeeSearchResult) => {
    onChange(employee);
    setTerm("");
    setOpen(false);
  };

  const trimmed = term.trim();

  const showCreate =
    onCreateRequest &&
    trimmed.length > 0 &&
    !isLoading &&
    !options.some((r) => r.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
      {label}
      <div ref={containerRef} className="relative mt-1.5">
        {value ? (
          <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-800">
            <span className="flex-1 truncate text-sm text-gray-800 dark:text-gray-100">
              {value.name}
            </span>
            <button
              type="button"
              aria-label="Clear selected employee"
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
            {isLoading && options.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">
                {trimmed.length > 0 ? "Searching..." : "Loading employees..."}
              </p>
            )}
            {!isLoading && options.length === 0 && trimmed.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">
                No employees yet — type a name to create one.
              </p>
            )}
            {options.map((employee) => (
              <button
                key={employee.id}
                type="button"
                onClick={() => select(employee)}
                className="block w-full truncate rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"
              >
                {employee.name}
              </button>
            ))}
            {trimmed.length > 0 && !isLoading && options.length === 0 && !showCreate && (
              <p className="px-3 py-2 text-xs text-gray-400">No employees found.</p>
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
