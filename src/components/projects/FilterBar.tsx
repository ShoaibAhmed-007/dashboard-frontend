"use client";
import { useTasks, useAssignees } from "@/context/TaskContext";
import { TaskStatus, TaskPriority, TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG, ALL_STATUSES, ALL_PRIORITIES } from "@/types/task";

export default function FilterBar() {
  const { filters, setFilters, resetFilters } = useTasks();
  const assignees = useAssignees();
  const hasFilter = filters.search || filters.status !== "all" || filters.priority !== "all" || filters.assignee;

  const selectCls = "h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-600 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search…"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          className="h-8 w-48 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
      </div>

      {/* Status */}
      <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value as TaskStatus | "all" })} className={selectCls}>
        <option value="all">All Status</option>
        {ALL_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_CONFIG[s].label}</option>)}
      </select>

      {/* Priority */}
      <select value={filters.priority} onChange={(e) => setFilters({ priority: e.target.value as TaskPriority | "all" })} className={selectCls}>
        <option value="all">All Priority</option>
        {ALL_PRIORITIES.map((p) => <option key={p} value={p}>{TASK_PRIORITY_CONFIG[p].label}</option>)}
      </select>

      {/* Assignee */}
      <select value={filters.assignee} onChange={(e) => setFilters({ assignee: e.target.value })} className={selectCls}>
        <option value="">All Assignees</option>
        {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>

      {/* Clear */}
      {hasFilter && (
        <button
          onClick={resetFilters}
          className="flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );
}
