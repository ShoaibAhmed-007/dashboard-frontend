"use client";

import { LuX, LuMaximize2 } from "react-icons/lu";
import { useTaskStore, MinimizedTaskDraft } from "@/stores/task.store";

export default function MinimizedTaskBar() {
  const minimizedTasks = useTaskStore((s) => s.minimizedTasks);
  const restoreMinimizedTask = useTaskStore((s) => s.restoreMinimizedTask);
  const closeMinimizedTask = useTaskStore((s) => s.closeMinimizedTask);

  if (minimizedTasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-[352px] z-40 flex flex-col gap-2">
      {minimizedTasks.map((draft: MinimizedTaskDraft) => (
        <div
          key={draft.taskId}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          style={{ width: 220 }}
        >
          <button
            type="button"
            onClick={() => void restoreMinimizedTask(draft.taskId)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            title="Restore task"
          >
            <LuMaximize2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                {draft.title}
              </p>
              <p className="text-[11px] text-gray-400">{draft.taskIdentifier}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => closeMinimizedTask(draft.taskId)}
            className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            title="Dismiss"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
