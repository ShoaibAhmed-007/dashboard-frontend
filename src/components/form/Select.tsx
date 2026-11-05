"use client";

import React, { useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  /** Optional icon/element rendered before the label */
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Render a hint below the trigger */
  hint?: React.ReactNode;
  className?: string;
  /** Height of the trigger button — defaults to "md" */
  size?: "sm" | "md" | "lg";
}

const SIZE_CLS = {
  sm: "h-8 text-xs px-3",
  md: "h-11 text-sm px-4",
  lg: "h-12 text-sm px-4",
} as const;

const Select: React.FC<SelectProps> = ({
  options,
  value,
  defaultValue = "",
  placeholder = "Select an option",
  onChange,
  disabled = false,
  hint,
  className = "",
  size = "md",
}) => {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = isControlled ? value : internalValue;
  const selectedOption = options.find((o) => o.value === current);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (opt: SelectOption) => {
    if (opt.disabled) return;
    if (!isControlled) setInternalValue(opt.value);
    onChange?.(opt.value);
    setOpen(false);
  };

  const triggerBase = [
    "flex w-full items-center justify-between gap-2 rounded-lg border bg-white outline-none transition-colors",
    "dark:bg-gray-900 dark:text-white/90",
    SIZE_CLS[size],
    disabled
      ? "cursor-not-allowed border-gray-200 opacity-60 dark:border-gray-700"
      : "cursor-pointer border-gray-300 hover:border-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:hover:border-gray-600 dark:focus:border-brand-800",
    className,
  ].join(" ");

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={triggerBase}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`flex min-w-0 flex-1 items-center gap-2 truncate ${!selectedOption ? "text-gray-400 dark:text-white/30" : "text-gray-800 dark:text-white/90"}`}>
          {selectedOption?.icon}
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-907"
        >
          {options.map((opt) => {
            const isSelected = opt.value === current;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt)}
                className={[
                  "flex cursor-pointer items-center gap-2 px-4 py-2 text-sm transition-colors",
                  opt.disabled
                    ? "cursor-not-allowed opacity-40"
                    : "hover:bg-gray-100 dark:hover:bg-[#282626]",
                  isSelected
                    ? "font-normal text-brand-500  "
                    : "text-gray-700 dark:text-gray-300",
                ].join(" ")}
              >
                {/* checkmark gutter — always reserves space */}
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {isSelected && (
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
                {opt.icon}
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}

      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
};

export default Select;
