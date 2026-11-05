"use client";

import { useEffect, useRef } from "react";
import { LuChevronDown, LuChevronUp, LuSearch, LuX } from "react-icons/lu";

/**
 * In-conversation search, living inside the thread header.
 *
 * Expands leftward out of the search icon's own position rather than dropping
 * a second bar below the header — the field grows from where it was summoned,
 * so the control and its input read as the same thing.
 *
 * Purely presentational: matching and scrolling stay in the thread, which is
 * the only thing that knows the loaded messages and holds their DOM nodes.
 */
export default function HeaderMessageSearch({
  isOpen,
  query,
  onQueryChange,
  matchCount,
  activeIndex,
  onPrev,
  onNext,
  onClose,
}: {
  isOpen: boolean;
  query: string;
  onQueryChange: (next: string) => void;
  matchCount: number;
  /** Zero-based; -1 when there is nothing to be on. */
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  /* Focused on open rather than with `autoFocus`, because the element is
     never unmounted — it collapses to zero width, and an unmounted-remount
     would lose the query on every toggle. */
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (matchCount === 0) return;
      if (event.shiftKey) onPrev();
      else onNext();
    }
  };

  const hasQuery = query.trim().length > 0;

  return (
    /* Width, not display: a collapsed element can animate, a hidden one
       cannot. `overflow-hidden` clips the contents mid-slide. */
    <div
      aria-hidden={!isOpen}
      className={`flex items-center overflow-hidden transition-[width,opacity] duration-200 ease-out ${
        isOpen ? "w-[min(340px,60%)] opacity-100" : "w-0 opacity-0"
      }`}
    >
      <div className="flex h-8 w-full items-center gap-1 rounded-lg border border-gray-200 bg-white pl-2.5 pr-1 dark:border-gray-700 dark:bg-gray-800">
        <LuSearch className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search in conversation"
          aria-label="Search in conversation"
          // Not reachable by keyboard while collapsed.
          tabIndex={isOpen ? 0 : -1}
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
        />

        {hasQuery && (
          <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-gray-400">
            {matchCount === 0 ? "0/0" : `${activeIndex + 1}/${matchCount}`}
          </span>
        )}

        <button
          type="button"
          aria-label="Previous match"
          title="Previous (Shift+Enter)"
          onClick={onPrev}
          disabled={matchCount === 0}
          tabIndex={isOpen ? 0 : -1}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <LuChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Next match"
          title="Next (Enter)"
          onClick={onNext}
          disabled={matchCount === 0}
          tabIndex={isOpen ? 0 : -1}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <LuChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Close search"
          onClick={onClose}
          tabIndex={isOpen ? 0 : -1}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <LuX className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
