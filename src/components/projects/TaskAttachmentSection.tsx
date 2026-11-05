"use client";
import React, { useRef, useState } from "react";
import { Task } from "@/types/task";
import { useTasks, formatFileSize } from "@/context/TaskContext";

function fileIcon(type: string) {
  if (type.startsWith("image/")) return (
    <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
  if (type.includes("pdf")) return (
    <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
  return (
    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default function TaskAttachmentSection({ task }: { task: Task }) {
  const { addAttachment, deleteAttachment } = useTasks();
  const [open, setOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((f) => addAttachment(task.id, f));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 py-4">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between text-sm font-normal text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          Attachments
          {task.attachments.length > 0 && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {task.attachments.length}
            </span>
          )}
        </span>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* File list */}
          {task.attachments.map((a) => (
            <div key={a.id} className="group flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-2.5 dark:border-gray-800 dark:bg-gray-800/40">
              {a.url && a.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.name} className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-white dark:bg-gray-700 shadow-sm">
                  {fileIcon(a.type)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-normal text-gray-700 dark:text-gray-300">{a.name}</p>
                <p className="text-xs text-gray-400">{formatFileSize(a.size)} · {a.uploadedAt}</p>
              </div>
              <button
                onClick={() => deleteAttachment(task.id, a.id)}
                className="hidden h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-red-500 dark:hover:bg-gray-700 group-hover:flex"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-5 transition-colors ${
              dragging
                ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                : "border-gray-200 hover:border-brand-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60"
            }`}
          >
            <svg className={`mb-1.5 h-7 w-7 ${dragging ? "text-brand-500" : "text-gray-300 dark:text-gray-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
              {dragging ? "Drop to upload" : "Drop files or click to upload"}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">Any file type supported</p>
          </div>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>
      )}
    </div>
  );
}
