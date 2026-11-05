"use client";

/** Which slice of the conversation list is shown. */
export type ChatFilter = "all" | "unread" | "favourites";

const FILTERS: { key: ChatFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "favourites", label: "Favourites" },
];

/**
 * Quick filters above the conversation list. Counts sit inside the pill so an
 * empty category reads as a plain label rather than "Unread 0".
 */
export default function ChatFilterPills({
  active,
  counts,
  onChange,
}: {
  active: ChatFilter;
  counts: Partial<Record<ChatFilter, number>>;
  onChange: (filter: ChatFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
      {FILTERS.map(({ key, label }) => {
        const isActive = active === key;
        const count = counts[key] ?? 0;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(key)}
            className={`h-7 rounded-full px-3 text-xs font-normal transition-colors ${
              isActive
                ? "bg-brand-500 text-white dark:bg-gray-000 dark:text-black"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {label}
            {count > 0 && <span className="ml-1 opacity-80">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
