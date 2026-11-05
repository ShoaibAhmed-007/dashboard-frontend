"use client";
import React from "react";
import { Task, TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from "@/types/task";
import { getInitials, isOverdue } from "@/context/TaskContext";

interface Props {
  task: Task;
  onView: (task: Task) => void;
  onDelete: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  isDragging?: boolean;
}

export default function TaskCard({ task, onView, onDelete, draggable, onDragStart, isDragging }: Props) {
  const overdue = isOverdue(task.dueDate, task.status);
  const pc = TASK_PRIORITY_CONFIG[task.priority];
  const sc = TASK_STATUS_CONFIG[task.status];
  const doneSubtasks = task.subtasks.filter((s) => s.completed).length;

  return (
    <div
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => onDragStart(e, task.id) : undefined}
      onClick={() => onView(task)}
      className={`group relative cursor-pointer rounded-xl border bg-white p-3.5 shadow-sm transition-all hover:shadow-md dark:bg-gray-900 ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-40 rotate-1 scale-95" : ""} ${
        overdue ? "border-red-200 dark:border-red-500/30" : "border-gray-200 dark:border-gray-800"
      }`}
    >
      {/* Priority colour bar on left */}
      <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${pc.dot}`} />

      {/* Actions */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onDelete(task.id)}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1 pl-2">
          {task.tags.slice(0, 2).map((tag) => (
            <span key={tag.id} className={`rounded-sm px-1.5 py-0.5 text-[10px] font-normal ${tag.color}`}>{tag.name}</span>
          ))}
          {task.tags.length > 2 && (
            <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-500 dark:bg-gray-800 dark:text-gray-400">+{task.tags.length - 2}</span>
          )}
        </div>
      )}

      {/* Title */}
      <p className={`mb-3 pl-2 text-sm font-normal leading-snug text-gray-700 dark:text-gray-200 line-clamp-2 wrap-break-word ${task.status === "done" ? "line-through text-gray-400 dark:text-gray-600" : ""}`}>
        {task.title.split(/(\s+)/).map((part) => (part.length > 15 && !/^\s+$/.test(part) ? part.slice(0, 15) + "..." : part)).join("")}
      </p>

      {/* Subtask progress */}
      {task.subtasks.length > 0 && (
        <div className="mb-2.5 pl-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-400">{doneSubtasks}/{task.subtasks.length} subtasks</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${(doneSubtasks / task.subtasks.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pl-2">
        {/* Assignee avatars */}
        <div className="flex -space-x-1">
          {task.assignees.slice(0, 3).map((a) => (
            <div
              key={a}
              title={a}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-500 text-[9px] font-normal text-white dark:border-gray-900"
            >
              {getInitials(a)}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Attachment count */}
          {task.attachments.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {task.attachments.length}
            </span>
          )}
          {/* Comment count */}
          {task.comments.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {task.comments.length}
            </span>
          )}
          {/* Due date */}
          <span className={`flex items-center gap-0.5 text-[10px] font-normal ${overdue ? "text-red-500" : "text-gray-400 dark:text-gray-500"}`}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {task.dueDate}
          </span>
        </div>
      </div>

      {/* Status badge bottom */}
      <div className="mt-2 flex items-center justify-between pl-2">
        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-normal ${sc.color} ${sc.bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
          {sc.label}
        </span>
        <span className={`text-[10px] font-normal ${pc.color}`}>{pc.label}</span>
      </div>
    </div>
  );
}
