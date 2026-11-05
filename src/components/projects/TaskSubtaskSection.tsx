"use client";
import React, { useState } from "react";
import { Task } from "@/types/task";
import { useTasks } from "@/context/TaskContext";

export default function TaskSubtaskSection({ task }: { task: Task }) {
  const { addSubtask, toggleSubtask, deleteSubtask } = useTasks();
  const [open, setOpen] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const done = task.subtasks.filter((s) => s.completed).length;

  function submit() {
    const t = newTitle.trim();
    if (t) { addSubtask(task.id, t); setNewTitle(""); }
    setAdding(false);
  }

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 py-4">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between text-sm font-normal text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Subtasks
          {task.subtasks.length > 0 && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {done}/{task.subtasks.length}
            </span>
          )}
        </span>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-1">
          {task.subtasks.length > 0 && (
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${task.subtasks.length ? (done / task.subtasks.length) * 100 : 0}%` }}
              />
            </div>
          )}

          {task.subtasks.map((s) => (
            <div key={s.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60">
              <button
                onClick={() => toggleSubtask(task.id, s.id)}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  s.completed
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-gray-300 dark:border-gray-600 hover:border-brand-500"
                }`}
              >
                {s.completed && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className={`flex-1 text-sm ${s.completed ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                {s.title}
              </span>
              <button
                onClick={() => deleteSubtask(task.id, s.id)}
                className="hidden h-5 w-5 items-center justify-center rounded text-gray-400 hover:text-red-500 group-hover:flex"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {adding ? (
            <div className="flex items-center gap-2 px-2">
              <div className="h-4 w-4 shrink-0 rounded border border-gray-300 dark:border-gray-600" />
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setNewTitle(""); } }}
                onBlur={submit}
                placeholder="Subtask name…"
                className="flex-1 rounded bg-transparent py-1 text-sm text-gray-700 placeholder-gray-400 outline-none dark:text-gray-300"
              />
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-50 hover:text-brand-500 dark:hover:bg-gray-800/60"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add subtask
            </button>
          )}
        </div>
      )}
    </div>
  );
}
