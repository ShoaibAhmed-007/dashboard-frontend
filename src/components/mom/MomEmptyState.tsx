"use client";

import { LuCalendarDays, LuPlus, LuSearch } from "react-icons/lu";

/**
 * The empty pane. Two different emptinesses, deliberately worded apart:
 * nothing exists yet (offer to create), versus a filter/search that matched
 * nothing (offer nothing — creating a MOM would not satisfy the query).
 */
export default function MomEmptyState({
  isFiltered,
  onCreate,
}: {
  /** A search or tab is narrowing the list, so "none" is a result, not a void. */
  isFiltered: boolean;
  /** Omitted for a caller without create access — the button is hidden. */
  onCreate?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-brand-50 dark:bg-brand-500/10">
        {isFiltered ? (
          <LuSearch className="h-7 w-7 text-brand-500" />
        ) : (
          <LuCalendarDays className="h-7 w-7 text-brand-500" />
        )}
      </span>

      <p className="mt-5 text-xl font-bold text-gray-900 dark:text-gray-100">
        {isFiltered ? "No matching meetings" : "No meetings found"}
      </p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        {isFiltered
          ? "Try a different search, or switch back to All meetings."
          : "Create your first MOM to capture the conversation and keep follow-ups visible."}
      </p>

      {!isFiltered && onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-6 flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <LuPlus className="h-4 w-4" />
          Create MOM
        </button>
      )}
    </div>
  );
}
