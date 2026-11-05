"use client";

import { useEffect, useRef, useState } from "react";
import { LuChevronDown, LuFilter, LuSearch, LuX } from "react-icons/lu";

interface TaskScopeHeaderProps {
  title: string;
  searchValue: string;
  filterCount: number;
  onSearchChange: (value: string) => void;
  onOpenFilters: (rect: DOMRect) => void;
  onAddTask: () => void;
}

export default function TaskScopeHeader({
  title,
  searchValue,
  filterCount,
  onSearchChange,
  onOpenFilters,
  onAddTask,
}: TaskScopeHeaderProps) {
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
    }
  }, [searchOpen]);

  const handleCloseSearch = () => {
    setSearchOpen(false);
    onSearchChange("");
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-[12px] font-medium text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Animated search */}
        <div className="flex items-center">
          <div
            className={`flex items-center overflow-hidden rounded-lg  border focus-within:hover:border-gray-900 hover:border-blue-300 dark:hover:border-gray-801 dark:focus-within:hover:border-gray-000 transition-all duration-300 ease-in-out ${
              searchOpen
                ? "w-52 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                : "w-7 border-transparent bg-transparent"
            }`}
          >
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300 ${
                searchOpen ? "pl-2" : ""
              }`}
            >
              <LuSearch className="h-3.5 w-3.5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tasks..."
              className={`flex-1 bg-transparent py-1 pr-1 text-xs text-gray-700 outline-none placeholder:text-gray-400 transition-all duration-300 dark:text-white ${
                searchOpen ? "opacity-100" : "w-0 opacity-0 pointer-events-none"
              }`}
            />
            {searchOpen && (
              <button
                type="button"
                onClick={handleCloseSearch}
                className="flex h-7 w-6 shrink-0 items-center justify-center text-gray-300 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <LuX className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Filter button */}
        <button
          ref={filterBtnRef}
          type="button"
          onClick={() =>
            filterBtnRef.current &&
            onOpenFilters(filterBtnRef.current.getBoundingClientRect())
          }
          className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
            filterCount > 0
              ? "border-brand-300 bg-brand-50 text-brand-600 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:bg-transparent dark:text-gray-400 dark:hover:bg-gray-800"
          }`}
        >
          <LuFilter className="h-3 w-3" />
          {filterCount > 0 ? (
            <>
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
                {filterCount}
              </span>
              <span>Filter{filterCount > 1 ? "s" : ""}</span>
            </>
          ) : (
            "Filter"
          )}
        </button>

        {/* Add Task */}
        <button
          type="button"
          onClick={onAddTask}
          className="inline-flex h-7 items-center gap-1 rounded-lg bg-brand-500 dark:bg-gray-000 dark:text-black px-3 text-xs font-medium text-white transition-colors hover:bg-brand-600 dark:hover:bg-gray-200"
        >
          Add Task
          <LuChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
