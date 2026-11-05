"use client";

import { TaskSearchMeta } from "@/services/task.service";

interface TaskPaginationProps {
  meta: TaskSearchMeta | null;
  onPageChange: (page: number) => void;
}

export default function TaskPagination({ meta, onPageChange }: TaskPaginationProps) {
  if (!meta || meta.total_pages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm dark:border-gray-800">
      <p className="text-gray-500 dark:text-gray-400">
        Page {meta.page} of {meta.total_pages} · {meta.total} tasks
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!meta.has_prev}
          onClick={() => onPageChange(meta.page - 1)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!meta.has_next}
          onClick={() => onPageChange(meta.page + 1)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
        >
          Next
        </button>
      </div>
    </div>
  );
}
