"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuSearch, LuLoader, LuX, LuChevronRight } from "react-icons/lu";
import { useTaskStore } from "@/stores/task.store";
import { useTaskSearchStore } from "@/stores/task-search.store";
import { TaskListItem, TaskSearchParams } from "@/services/task.service";
import { useWorkspaceTags } from "@/hooks/useWorkspaceTags";

interface GlobalTaskSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

const DEFAULT_PARAMS: TaskSearchParams = {
  page: 1,
  limit: 20,
  include_closed: true,
  include_archived: false,
  include_subtasks: false,
  sort_order: "desc",
};

type SortOption = { value: string; label: string };
const SORT_OPTIONS: SortOption[] = [
  { value: "", label: "Updated" },
  { value: "due_date", label: "Due date" },
  { value: "created_at", label: "Created" },
  { value: "priority", label: "Priority" },
];

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export default function GlobalTaskSearchModal({
  isOpen,
  onClose,
  anchorRect,
}: GlobalTaskSearchModalProps) {
  const { openTaskDetail } = useTaskStore();
  const { searchWorkspace } = useTaskSearchStore();
  useWorkspaceTags();

  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [params, setParams] = useState<TaskSearchParams>(DEFAULT_PARAMS);
  const [results, setResults] = useState<TaskListItem[]>([]);
  const [meta, setMeta] = useState<{ has_next: boolean; page: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSort, setActiveSort] = useState("");
  const [focusIdx, setFocusIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setParams(DEFAULT_PARAMS);
      setResults([]);
      setMeta(null);
      setFocusIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const nextParams = { ...params, q: query || undefined, page: 1 };
        const response = await searchWorkspace(nextParams);
        setResults(response.items);
        setMeta({ has_next: response.meta.has_next, page: response.meta.page });
        setFocusIdx(0);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [isOpen, query, paramsKey, searchWorkspace]);

  // Outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  // Keyboard nav
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setFocusIdx((i) => Math.min(i + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setFocusIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && results[focusIdx]) {
        void openTaskDetail(results[focusIdx].id);
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, results, focusIdx, openTaskDetail, onClose]);

  const handleSortChange = (val: string) => {
    setActiveSort(val);
    setParams((p) => ({ ...p, sort_by: val || undefined }));
  };

  const loadMore = async () => {
    if (!meta?.has_next || loading) return;
    setLoading(true);
    try {
      const response = await searchWorkspace({ ...params, q: query || undefined, page: (meta.page ?? 1) + 1 });
      setResults((prev) => [...prev, ...response.items]);
      setMeta({ has_next: response.meta.has_next, page: response.meta.page });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isOpen) return null;

  // Position: anchored below the search bar in the header, or centered fallback
  const PANEL_W = 560;
  const panelStyle: React.CSSProperties = anchorRect
    ? {
        position: "fixed",
        top: anchorRect.bottom + 6,
        left: Math.min(
          anchorRect.left + anchorRect.width / 2 - PANEL_W / 2,
          window.innerWidth - PANEL_W - 12
        ),
        width: PANEL_W,
        zIndex: 9999,
      }
    : {
        position: "fixed",
        top: "60px",
        left: "50%",
        transform: "translateX(-50%)",
        width: PANEL_W,
        zIndex: 9999,
      };

  const priorityDot: Record<string, string> = {
    URGENT: "#ef4444",
    HIGH: "#f97316",
    NORMAL: "#3b82f6",
    LOW: "#94a3b8",
    NONE: "#d1d5db",
  };

  return createPortal(
    <div
      ref={panelRef}
      style={panelStyle}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-901"
    >
      {/* Search input */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
        <LuSearch className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks..."
          className="flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 dark:text-white"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        )}
        {loading && <LuLoader className="h-3.5 w-3.5 shrink-0 animate-spin text-gray-400" />}
      </div>

      {/* Sort tabs */}
      <div className="flex items-center gap-0.5 border-b border-gray-100 px-3 py-1.5 dark:border-gray-800">
        <span className="mr-2 text-[11px] text-gray-400">Sort:</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSortChange(opt.value)}
            className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
              activeSort === opt.value
                ? "bg-gray-200 text-gray-700 dark:bg-gray-905 dark:text-brand-400"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="max-h-[min(480px,60vh)] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
        {!loading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <LuSearch className="h-8 w-8 text-gray-200 dark:text-gray-700" />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {query ? "No tasks match your search" : "Type to search tasks"}
            </p>
          </div>
        )}

        {results.map((task, idx) => (
          <button
            key={task.id}
            type="button"
            onClick={() => { void openTaskDetail(task.id); onClose(); }}
            onMouseEnter={() => setFocusIdx(idx)}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              focusIdx === idx
                ? "bg-gray-50 dark:bg-gray-800/60"
                : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
            }`}
          >
            {/* Status dot */}
            <span
              className="mt-px h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: task.status?.color ?? "#94a3b8" }}
            />

            {/* Title + breadcrumb */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-100">
                {task.title}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                <span className="truncate">{task.list?.project?.name}</span>
                <LuChevronRight className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{task.list?.name}</span>
              </p>
            </div>

            {/* Priority dot */}
            {task.priority && task.priority !== "NONE" && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: priorityDot[task.priority] ?? "#d1d5db" }}
                title={task.priority}
              />
            )}

            {/* Task ID */}
            <span className="shrink-0 font-mono text-[10px] text-gray-300 dark:text-gray-600">
              #{task.taskId}
            </span>

            {/* Time */}
            <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
              {timeAgo(task.updatedAt)}
            </span>

            {/* Arrow hint on focus */}
            {focusIdx === idx && (
              <LuChevronRight className="h-3 w-3 shrink-0 text-gray-300 dark:text-gray-600" />
            )}
          </button>
        ))}

        {meta?.has_next && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="w-full py-2.5 text-center text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-800"
          >
            {loading ? "Loading…" : "Load more results"}
          </button>
        )}
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between border-t border-gray-100 px-3 py-1.5 dark:border-gray-800">
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 px-1 py-px font-mono text-[10px] dark:border-gray-700">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 px-1 py-px font-mono text-[10px] dark:border-gray-700">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 px-1 py-px font-mono text-[10px] dark:border-gray-700">esc</kbd>
            close
          </span>
        </div>
        <span className="text-[10px] text-gray-300 dark:text-gray-600">
          {results.length > 0 ? `${results.length} result${results.length !== 1 ? "s" : ""}` : ""}
        </span>
      </div>
    </div>,
    document.body
  );
}
