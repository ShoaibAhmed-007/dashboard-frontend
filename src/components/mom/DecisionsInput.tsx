"use client";

import { useState } from "react";
import { LuCheck, LuX } from "react-icons/lu";

export type Decision = { id: string; text: string };

/**
 * The "Decisions made" list: a set of recorded outcomes, each removable.
 *
 * The tick is a state marker, not a control — a decision is a decision once
 * written down, so there is nothing to toggle. Rendering it as a disabled
 * checkbox would imply an action that does not exist.
 */
export default function DecisionsInput({
  value,
  onChange,
  placeholder = "Homepage design approved + Enter",
}: {
  value: Decision[];
  onChange: (next: Decision[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([
      ...value,
      { id: `decision-${Date.now()}-${value.length}`, text },
    ]);
    setDraft("");
  };

  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-905">
      {value.map((decision) => (
        <div
          key={decision.id}
          className="flex items-center gap-3 rounded-lg px-2 py-2"
        >
          <span
            aria-hidden="true"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-emerald-500 text-emerald-500"
          >
            <LuCheck className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <span className="min-w-0 flex-1 break-words text-sm text-gray-800 dark:text-gray-100">
            {decision.text}
          </span>
          <button
            type="button"
            aria-label={`Remove decision: ${decision.text}`}
            onClick={() => onChange(value.filter((d) => d.id !== decision.id))}
            className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-red-500"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        // Same reasoning as the participants field: don't lose a typed line.
        onBlur={commit}
        placeholder={placeholder}
        aria-label="Add a decision"
        className={`h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 ${
          value.length > 0 ? "mt-2" : ""
        }`}
      />
    </div>
  );
}
