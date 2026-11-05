"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEPARTMENT_NAME_MAX_LENGTH,
  canonicalDepartment,
  departmentLabel,
} from "@/types/it-management";

/** How many rows show before the list scrolls; "New department" stays pinned. */
const ROWS_VISIBLE = 5;
const ROW_HEIGHT = 36;

/**
 * Pick an existing department or type a new one.
 *
 * `options` are stored values (e.g. "DESIGN", or a custom "Marketing").
 * Typing a name that matches an existing department — by value or label,
 * ignoring case — selects that one rather than creating a near-duplicate. A
 * genuinely new name becomes the selected value immediately and is saved
 * together with the employee; there is no separate "create department" call.
 */
export default function DepartmentPicker({
  value,
  onChange,
  options,
  placeholder = "Select department",
  invalid = false,
  className = "",
}: {
  /** Stored department value, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  invalid?: boolean;
  /** Classes for the trigger button — the caller's own input styling. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // A just-typed department isn't in `options` until the employee is saved —
  // show it anyway so the selection is visible and re-selectable.
  const visibleOptions = useMemo(
    () => (value && !options.includes(value) ? [...options, value] : options),
    [options, value]
  );

  const close = () => {
    setOpen(false);
    setCreating(false);
    setNewName("");
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const commitNew = () => {
    const name = newName.trim();
    if (name) onChange(canonicalDepartment(name, options));
    close();
  };

  const trimmedNew = newName.trim();
  const matchesExisting =
    trimmedNew !== "" && options.includes(canonicalDepartment(trimmedNew, options));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid}
        onClick={() => setOpen((current) => !current)}
        className={`${className} flex items-center justify-between text-left ${
          invalid ? "border-red-500 ring-1 ring-red-500" : ""
        }`}
      >
        <span className={`truncate ${value ? "" : "text-slate-400 dark:text-gray-500"}`}>
          {value ? departmentLabel(value) : placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`ml-2 h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-gray-800">
          <div role="listbox" className="overflow-y-auto py-1" style={{ maxHeight: ROWS_VISIBLE * ROW_HEIGHT }}>
            {visibleOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === value}
                onClick={() => {
                  onChange(option);
                  close();
                }}
                className={`flex w-full items-center px-3 py-2 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-white/5 ${
                  option === value
                    ? "font-medium text-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-gray-300"
                }`}
              >
                {departmentLabel(option)}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-white/10">
            {creating ? (
              <div className="p-2">
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={newName}
                    maxLength={DEPARTMENT_NAME_MAX_LENGTH}
                    onChange={(event) => setNewName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitNew();
                      }
                      if (event.key === "Escape") {
                        event.stopPropagation();
                        setCreating(false);
                        setNewName("");
                      }
                    }}
                    placeholder="New department name"
                    className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={commitNew}
                    disabled={!trimmedNew}
                    className="shrink-0 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-white dark:text-slate-900"
                  >
                    {matchesExisting ? "Select" : "Add"}
                  </button>
                </div>
                {matchesExisting && (
                  <p className="mt-1 text-[10px] text-slate-400">That department already exists — it will be selected.</p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-indigo-600 transition hover:bg-gray-50 dark:text-indigo-400 dark:hover:bg-white/5"
              >
                <span aria-hidden="true">+</span> New department
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
