"use client";
import React, { useEffect, useRef, useState } from "react";
import { Task, TaskPriority, ALL_PRIORITIES, TASK_PRIORITY_CONFIG, SAMPLE_ASSIGNEES, SAMPLE_TAGS } from "@/types/task";
import { useTasks, getInitials, isOverdue } from "@/context/TaskContext";
import { StatusItem } from "@/services/status.service";
import { TaskList } from "@/services/task-list.service";
import TaskSubtaskSection from "./TaskSubtaskSection";
import TaskChecklistSection from "./TaskChecklistSection";
import TaskAttachmentSection from "./TaskAttachmentSection";
import TaskCommentSection from "./TaskCommentSection";
import { findStatusForTask, legacyStatusFromBackendStatus } from "./status-utils";

interface Props {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  statuses?: StatusItem[];
  lists?: TaskList[];
}

export default function TaskDetailPanel({
  task,
  isOpen,
  onClose,
  onEdit,
  statuses = [],
  lists = [],
}: Props) {
  const { updateTask, updateTaskStatus, deleteTask } = useTasks();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task?.title ?? "");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(task?.description ?? "");
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  // Auto-focus title textarea
  useEffect(() => {
    if (editingTitle && titleRef.current) titleRef.current.focus();
  }, [editingTitle]);

  if (!task) return null;

  const overdue = isOverdue(task.dueDate, task.status);
  const pc = TASK_PRIORITY_CONFIG[task.priority];
  const resolvedStatus = findStatusForTask(task, statuses);
  const currentList = lists.find((list) => list.id === task.listId);

  function saveTitle() {
    const t = titleDraft.trim();
    if (t && t !== task!.title) updateTask(task!.id, { title: t });
    setEditingTitle(false);
  }

  function saveDesc() {
    updateTask(task!.id, { description: descDraft });
    setEditingDesc(false);
  }

  function handleDelete() {
    deleteTask(task!.id);
    onClose();
  }

  function toggleAssignee(name: string) {
    const cur = task!.assignees;
    const next = cur.includes(name) ? cur.filter((a) => a !== name) : [...cur, name];
    updateTask(task!.id, { assignees: next });
  }

  function toggleTag(id: string) {
    const cur = task!.tags;
    const found = SAMPLE_TAGS.find((t) => t.id === id)!;
    const next = cur.some((t) => t.id === id) ? cur.filter((t) => t.id !== id) : [...cur, found];
    updateTask(task!.id, { tags: next });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 dark:bg-gray-900 sm:w-[520px]`}
        style={{ transform: isOpen ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* ── Top bar ─────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" /></svg>
            <span>My Workspace</span>
            <span>›</span>
            <span>Tasks</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(task)} title="Edit" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button onClick={handleDelete} title="Delete" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <button onClick={onClose} title="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Title */}
          {editingTitle ? (
            <textarea
              ref={titleRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTitle(); } if (e.key === "Escape") setEditingTitle(false); }}
              rows={2}
              className="mb-1 w-full resize-none rounded-lg bg-gray-50 px-2 py-1 text-xl font-normal text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-white"
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              className="mb-1 cursor-text text-xl font-normal text-gray-800 hover:text-brand-500 dark:text-white dark:hover:text-brand-400 leading-snug"
            >
              {task.title}
            </h1>
          )}
          <p className="mb-4 text-xs text-gray-400">Created {task.createdAt}</p>

          {/* ── Status & Priority row ───────────────────────────── */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {/* Status dropdown */}
            <div className="relative">
              <button
                onClick={() => { setStatusOpen((p) => !p); setPriorityOpen(false); }}
                className="flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-normal transition-colors hover:opacity-80"
                style={{
                  color: resolvedStatus?.color ?? undefined,
                  backgroundColor: resolvedStatus ? `${resolvedStatus.color}14` : undefined,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: resolvedStatus?.color ?? "#94a3b8" }}
                />
                {resolvedStatus?.name ?? "Status"}
                <svg className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {statusOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-xl border border-gray-100 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  {statuses.map((status) => {
                    return (
                      <button
                        key={status.id}
                        onClick={() => {
                          updateTask(task.id, {
                            statusId: status.id,
                            status: legacyStatusFromBackendStatus(status),
                          });
                          if (status.isClosed) {
                            updateTaskStatus(task.id, "done");
                          }
                          setStatusOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-normal hover:bg-gray-50 dark:hover:bg-gray-800 ${task.statusId === status.id ? "font-normal" : ""}`}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        <span style={{ color: status.color }}>{status.name}</span>
                        {task.statusId === status.id ? <svg className="ml-auto h-3.5 w-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Priority dropdown */}
            <div className="relative">
              <button
                onClick={() => { setPriorityOpen((p) => !p); setStatusOpen(false); }}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-normal transition-colors ${pc.color} ${pc.bg} border-transparent hover:opacity-80`}
              >
                <span className={`h-2 w-2 rounded-full ${pc.dot}`} />
                {pc.label}
                <svg className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {priorityOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 w-36 rounded-xl border border-gray-100 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  {ALL_PRIORITIES.map((p) => {
                    const c = TASK_PRIORITY_CONFIG[p];
                    return (
                      <button key={p} onClick={() => { updateTask(task.id, { priority: p as TaskPriority }); setPriorityOpen(false); }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-normal hover:bg-gray-50 dark:hover:bg-gray-800`}>
                        <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                        <span className={c.color}>{c.label}</span>
                        {task.priority === p && <svg className="ml-auto h-3.5 w-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {overdue && (
              <span className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-normal text-red-600 dark:bg-red-500/10 dark:text-red-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Overdue
              </span>
            )}
          </div>

          {/* ── Metadata grid ───────────────────────────────────── */}
          <div className="mb-4 space-y-2 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
            {/* Assignees */}
            <div className="flex items-start gap-3">
              <span className="w-24 shrink-0 pt-0.5 text-xs text-gray-400 dark:text-gray-500">Assignees</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {task.assignees.map((a) => (
                  <div key={a} className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-normal text-white">{getInitials(a)}</div>
                    <span className="text-xs text-gray-600 dark:text-gray-300">{a.split(" ")[0]}</span>
                  </div>
                ))}
                <div className="relative group">
                  <button className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-brand-500 hover:text-brand-500 dark:border-gray-600">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                  <div className="absolute left-0 top-full z-10 mt-1 hidden w-40 rounded-xl border border-gray-100 bg-white py-1 shadow-lg group-focus-within:block dark:border-gray-700 dark:bg-gray-900">
                    {SAMPLE_ASSIGNEES.map((a) => (
                      <button key={a} onClick={() => toggleAssignee(a)} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-normal text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">{getInitials(a)}</div>
                        <span className="flex-1 text-gray-700 dark:text-gray-300">{a}</span>
                        {task.assignees.includes(a) && <svg className="h-3.5 w-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-gray-400 dark:text-gray-500">List</span>
              <span className="text-xs font-normal text-gray-700 dark:text-gray-300">
                {currentList?.name ?? "Unassigned list"}
              </span>
            </div>

            {/* Due date */}
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-gray-400 dark:text-gray-500">Due date</span>
              <div className="flex items-center gap-1.5">
                <svg className={`h-3.5 w-3.5 ${overdue ? "text-red-500" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input
                  type="date"
                  value={task.dueDate}
                  onChange={(e) => updateTask(task.id, { dueDate: e.target.value })}
                  className={`rounded border-0 bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 ${overdue ? "text-red-500 font-normal" : "text-gray-700 dark:text-gray-300"}`}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-start gap-3">
              <span className="w-24 shrink-0 pt-0.5 text-xs text-gray-400 dark:text-gray-500">Tags</span>
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag) => (
                  <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`rounded-full px-2 py-0.5 text-xs font-normal transition-opacity hover:opacity-70 ${tag.color}`}>
                    {tag.name}
                  </button>
                ))}
                {SAMPLE_TAGS.filter((st) => !task.tags.some((t) => t.id === st.id)).map((st) => (
                  <button key={st.id} onClick={() => toggleTag(st.id)} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">
                    + {st.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Description ─────────────────────────────────────── */}
          <div className="mb-4">
            <p className="mb-1 text-xs font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide">Description</p>
            {editingDesc ? (
              <div>
                <textarea
                  autoFocus
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-brand-400 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-brand-500 dark:bg-gray-800 dark:text-gray-300"
                />
                <div className="mt-1.5 flex gap-2">
                  <button onClick={saveDesc} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-normal text-white hover:bg-brand-600">Save</button>
                  <button onClick={() => { setEditingDesc(false); setDescDraft(task.description); }} className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingDesc(true)}
                className="cursor-text rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:bg-gray-800 min-h-[60px] leading-relaxed"
              >
                {task.description || <span className="text-gray-400 dark:text-gray-600">Click to add a description…</span>}
              </div>
            )}
          </div>

          {/* ── Sections ────────────────────────────────────────── */}
          <TaskSubtaskSection task={task} />
          <TaskChecklistSection task={task} />
          <TaskAttachmentSection task={task} />
          <TaskCommentSection task={task} />
        </div>
      </div>
    </>
  );
}
