"use client";
import React, { useState } from "react";
import { Task } from "@/types/task";
import { useTasks, getInitials } from "@/context/TaskContext";
import { SAMPLE_ASSIGNEES } from "@/types/task";

const CURRENT_USER = SAMPLE_ASSIGNEES[0];

export default function TaskCommentSection({ task }: { task: Task }) {
  const { addComment, deleteComment } = useTasks();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(true);

  function submit() {
    const t = text.trim();
    if (!t) return;
    addComment(task.id, CURRENT_USER, t);
    setText("");
  }

  return (
    <div className="py-4">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between text-sm font-normal text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Activity & Comments
          {task.comments.length > 0 && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {task.comments.length}
            </span>
          )}
        </span>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Comment list */}
          {task.comments.length === 0 && (
            <p className="py-2 text-center text-xs text-gray-400 dark:text-gray-600">No comments yet. Be the first!</p>
          )}
          {task.comments.map((c) => (
            <div key={c.id} className="group flex gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-normal text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                {getInitials(c.author)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-normal text-gray-700 dark:text-gray-300">{c.author}</span>
                    <span className="text-xs text-gray-400">{c.createdAt}</span>
                  </div>
                  <button
                    onClick={() => deleteComment(task.id, c.id)}
                    className="hidden h-5 w-5 items-center justify-center rounded text-gray-400 hover:text-red-500 group-hover:flex"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="mt-0.5 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300 leading-relaxed">
                  {c.content}
                </p>
              </div>
            </div>
          ))}

          {/* Composer */}
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-normal text-white">
              {getInitials(CURRENT_USER)}
            </div>
            <div className="flex-1">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Add a comment… (Enter to send)"
                rows={2}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
              {text.trim() && (
                <div className="mt-1.5 flex justify-end gap-2">
                  <button onClick={() => setText("")} className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                    Cancel
                  </button>
                  <button onClick={submit} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-normal text-white hover:bg-brand-600">
                    Comment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
