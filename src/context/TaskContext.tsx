"use client";
import React, { createContext, useCallback, useContext, useState } from "react";
import {
  Task, TaskStatus, TaskFilters,
  Subtask, ChecklistItem, Checklist, TaskComment, TaskAttachment,
} from "@/types/task";

// ─── helpers ────────────────────────────────────────────────────────────────
export function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}
function tod(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}
export function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
export function isOverdue(dueDate: string, status: TaskStatus): boolean {
  return dueDate < tod() && status !== "done";
}
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


// ─── context value ───────────────────────────────────────────────────────────
interface TaskCtx {
  tasks: Task[];
  filters: TaskFilters;
  filteredTasks: Task[];
  getFilteredTasks: (scope?: { projectId?: string; listId?: string | null }) => Task[];
  // CRUD
  addTask: (t: Omit<Task, "id" | "createdAt">) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  // subtasks
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  // checklists
  addChecklist: (taskId: string, name: string) => void;
  addChecklistItem: (taskId: string, checklistId: string, text: string) => void;
  toggleChecklistItem: (taskId: string, checklistId: string, itemId: string) => void;
  deleteChecklistItem: (taskId: string, checklistId: string, itemId: string) => void;
  // comments
  addComment: (taskId: string, author: string, content: string) => void;
  deleteComment: (taskId: string, commentId: string) => void;
  // attachments
  addAttachment: (taskId: string, file: File) => void;
  deleteAttachment: (taskId: string, attachmentId: string) => void;
  // filters
  setFilters: (f: Partial<TaskFilters>) => void;
  resetFilters: () => void;
}

const Ctx = createContext<TaskCtx | null>(null);

const DEFAULT_FILTERS: TaskFilters = { search: "", status: "all", priority: "all", assignee: "" };

// ─── provider ────────────────────────────────────────────────────────────────
export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setF] = useState<TaskFilters>(DEFAULT_FILTERS);

  const filteredTasks = tasks.filter((t) => {
    if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status !== "all" && t.status !== filters.status) return false;
    if (filters.priority !== "all" && t.priority !== filters.priority) return false;
    if (filters.assignee && !t.assignees.some((a) => a.toLowerCase().includes(filters.assignee.toLowerCase()))) return false;
    return true;
  });

  const getFilteredTasks = useCallback((scope?: { projectId?: string; listId?: string | null }) => {
    return tasks.filter((t) => {
      if (scope?.projectId && t.projectId !== scope.projectId) return false;
      if (scope?.listId && t.listId !== scope.listId) return false;
      if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.status !== "all" && t.status !== filters.status) return false;
      if (filters.priority !== "all" && t.priority !== filters.priority) return false;
      if (filters.assignee && !t.assignees.some((a) => a.toLowerCase().includes(filters.assignee.toLowerCase()))) return false;
      return true;
    });
  }, [filters.assignee, filters.priority, filters.search, filters.status, tasks]);

  const mut = useCallback((fn: (prev: Task[]) => Task[]) => setTasks(fn), []);

  const addTask = useCallback((t: Omit<Task, "id" | "createdAt">) => {
    mut((p) => [...p, { ...t, id: genId(), createdAt: tod() }]);
  }, [mut]);

  const updateTask = useCallback((id: string, u: Partial<Task>) => {
    mut((p) => p.map((t) => (t.id === id ? { ...t, ...u } : t)));
  }, [mut]);

  const deleteTask = useCallback((id: string) => {
    mut((p) => p.filter((t) => t.id !== id));
  }, [mut]);

  const updateTaskStatus = useCallback((id: string, status: TaskStatus) => {
    mut((p) => p.map((t) => (t.id === id ? { ...t, status } : t)));
  }, [mut]);

  // subtasks
  const addSubtask = useCallback((taskId: string, title: string) => {
    const s: Subtask = { id: genId(), title, completed: false };
    mut((p) => p.map((t) => t.id === taskId ? { ...t, subtasks: [...t.subtasks, s] } : t));
  }, [mut]);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? {
      ...t, subtasks: t.subtasks.map((s) => s.id === subtaskId ? { ...s, completed: !s.completed } : s),
    } : t));
  }, [mut]);

  const deleteSubtask = useCallback((taskId: string, subtaskId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t));
  }, [mut]);

  // checklists
  const addChecklist = useCallback((taskId: string, name: string) => {
    const cl: Checklist = { id: genId(), name, items: [] };
    mut((p) => p.map((t) => t.id === taskId ? { ...t, checklists: [...t.checklists, cl] } : t));
  }, [mut]);

  const addChecklistItem = useCallback((taskId: string, checklistId: string, text: string) => {
    const item: ChecklistItem = { id: genId(), text, completed: false };
    mut((p) => p.map((t) => t.id === taskId ? {
      ...t, checklists: t.checklists.map((cl) => cl.id === checklistId ? { ...cl, items: [...cl.items, item] } : cl),
    } : t));
  }, [mut]);

  const toggleChecklistItem = useCallback((taskId: string, checklistId: string, itemId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? {
      ...t, checklists: t.checklists.map((cl) => cl.id === checklistId ? {
        ...cl, items: cl.items.map((i) => i.id === itemId ? { ...i, completed: !i.completed } : i),
      } : cl),
    } : t));
  }, [mut]);

  const deleteChecklistItem = useCallback((taskId: string, checklistId: string, itemId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? {
      ...t, checklists: t.checklists.map((cl) => cl.id === checklistId ? {
        ...cl, items: cl.items.filter((i) => i.id !== itemId),
      } : cl),
    } : t));
  }, [mut]);

  // comments
  const addComment = useCallback((taskId: string, author: string, content: string) => {
    const c: TaskComment = { id: genId(), author, content, createdAt: tod() };
    mut((p) => p.map((t) => t.id === taskId ? { ...t, comments: [...t.comments, c] } : t));
  }, [mut]);

  const deleteComment = useCallback((taskId: string, commentId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? { ...t, comments: t.comments.filter((c) => c.id !== commentId) } : t));
  }, [mut]);

  // attachments
  const addAttachment = useCallback((taskId: string, file: File) => {
    const a: TaskAttachment = {
      id: genId(), name: file.name, size: file.size,
      type: file.type, uploadedAt: tod(),
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    };
    mut((p) => p.map((t) => t.id === taskId ? { ...t, attachments: [...t.attachments, a] } : t));
  }, [mut]);

  const deleteAttachment = useCallback((taskId: string, attachmentId: string) => {
    mut((p) => p.map((t) => t.id === taskId ? { ...t, attachments: t.attachments.filter((a) => a.id !== attachmentId) } : t));
  }, [mut]);

  const setFilters = useCallback((f: Partial<TaskFilters>) => setF((p) => ({ ...p, ...f })), []);
  const resetFilters = useCallback(() => setF(DEFAULT_FILTERS), []);

  return (
    <Ctx.Provider value={{
      tasks, filters, filteredTasks,
      getFilteredTasks,
      addTask, updateTask, deleteTask, updateTaskStatus,
      addSubtask, toggleSubtask, deleteSubtask,
      addChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem,
      addComment, deleteComment,
      addAttachment, deleteAttachment,
      setFilters, resetFilters,
    }}>
      {children}
    </Ctx.Provider>
  );
}

// ─── hooks ───────────────────────────────────────────────────────────────────
export function useTasks(): TaskCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTasks must be used inside TaskProvider");
  return c;
}

export function useTaskStats() {
  const { tasks } = useTasks();
  const today = tod();
  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    inProgress: tasks.filter((t) => t.status === "in-progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter((t) => t.dueDate < today && t.status !== "done").length,
  };
}

export function useAssignees(): string[] {
  const { tasks } = useTasks();
  return Array.from(new Set(tasks.flatMap((t) => t.assignees))).filter(Boolean);
}
