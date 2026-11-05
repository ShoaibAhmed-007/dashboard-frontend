"use client";

import { useEffect, useRef, useState } from "react";
import { LuChevronDown } from "react-icons/lu";

export type SelectOption = { value: string; label: string };

/**
 * Single-select dropdown used across the accounting modals. Consolidates the
 * near-identical `SaleDropdown` / `ModalSelect` / `EditCurrencyDropdown`
 * implementations the mock views each carried their own copy of.
 */
export default function AccountingSelect({
  value,
  options,
  label,
  onChange,
  disabled = false,
  className = "mt-1.5",
}: {
  value: string;
  options: SelectOption[];
  label: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Extra classes on the root wrapper — defaults to the top margin this
   *  component was originally built for (a label with no bottom margin of
   *  its own, as accounting's modals use). Pass "" wherever the label
   *  already supplies that gap via its own margin-bottom, so the two don't
   *  stack — e.g. IT management's LABEL_CLS/labelCls. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-10 w-full items-center rounded-lg border bg-white px-3 text-left text-sm font-normal text-gray-700 outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-800 dark:text-gray-100 ${
          open
            ? "border-brand-500 ring-2 ring-brand-500/10"
            : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
        }`}
      >
        <span className="flex-1 truncate">{selectedLabel}</span>
        <LuChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-40 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors ${
                option.value === value
                  ? "bg-brand-500/10 font-medium text-brand-500"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"
              }`}
            >
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
