import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStateStorage } from "@/lib/idbStorage";
import {
  taskService,
  TaskListItem,
  TaskDetail,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateSubtaskPayload,
} from "@/services/task.service";
import { useTaskSearchStore } from "@/stores/task-search.store";
import { toast } from "sonner";
import { getApiErrorCode, parseApiError } from "@/lib/api";

export interface MinimizedTaskDraft {
  taskId: string;
  listId: string;
  title: string;
  taskIdentifier: string;
}

interface TaskState {
  tasksByList: Record<string, TaskListItem[]>;
  subtasksByParent: Record<string, TaskListItem[]>;
  loadingLists: Set<string>;
  loadingSubtasks: Set<string>;
  expandedTasks: Set<string>;
  openTaskId: string | null;
  openTask: TaskDetail | null;
  openTaskLoading: boolean;
  focusCommentId: string | null;
  /** A task row a list/board view should scroll to and flash briefly, then
   *  clear — e.g. after a "view in project" redirect from elsewhere in the
   *  app. Mirrors `focusCommentId`'s set/clear pattern. */
  highlightTaskId: string | null;
  minimizedTasks: MinimizedTaskDraft[];
  setTasksForLists: (tasksByList: Record<string, TaskListItem[]>) => void;

  fetchTasks: (projectId: string, listId: string) => Promise<void>;
  fetchSubtasks: (taskId: string) => Promise<void>;
  toggleExpand: (taskId: string) => void;
  openTaskDetail: (taskId: string) => Promise<void>;
  openTaskDetailAtComment: (taskId: string, commentId: string) => Promise<void>;
  clearFocusComment: () => void;
  setHighlightTaskId: (taskId: string | null) => void;
  clearHighlightTaskId: () => void;
  refreshOpenTask: () => Promise<void>;
  closeTaskDetail: () => void;
  minimizeTask: () => void;
  restoreMinimizedTask: (taskId: string) => void;
  closeMinimizedTask: (taskId: string) => void;
  createTask: (projectId: string, listId: string, payload: CreateTaskPayload) => Promise<TaskDetail>;
  updateTask: (taskId: string, listId: string, payload: UpdateTaskPayload) => Promise<void>;
  updateSubtask: (subtaskId: string, parentId: string, listId: string, payload: UpdateTaskPayload) => Promise<void>;
  deleteTask: (taskId: string, listId: string) => Promise<void>;
  deleteSubtask: (subtaskId: string, parentId: string, listId: string) => Promise<void>;
  completeTask: (taskId: string, listId: string) => Promise<void>;
  uncompleteTask: (taskId: string, listId: string) => Promise<void>;
  reorderTasks: (projectId: string, listId: string, taskIds: string[]) => Promise<void>;
  createSubtask: (taskId: string, listId: string, payload: CreateSubtaskPayload) => Promise<TaskDetail>;
  addAssignee: (taskId: string, listId: string, userIds: string[]) => Promise<void>;
  removeAssignee: (taskId: string, listId: string, userId: string) => Promise<void>;
  addTag: (taskId: string, listId: string, tagId: string, tagInfo?: { name: string; color: string }) => Promise<void>;
  removeTag: (taskId: string, listId: string, tagId: string) => Promise<void>;
  purgeTag: (tagId: string) => void;
  updateTagInStore: (tag: { id: string; name: string; color: string }) => void;
}

/**
 * A task can disappear between being listed and being opened — most often when
 * its project turns PRIVATE, which strips access to every task under it while
 * a cross-project list (My Tasks, search) still holds the row.
 *
 * Previously this was swallowed, leaving the detail panel blank with no
 * explanation. Say what happened instead, so "I clicked and nothing opened"
 * becomes a readable message.
 */
function handleOpenTaskError(err: unknown) {
  const code = getApiErrorCode(err);
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (code === "PROJECT_NOT_FOUND" || status === 404) {
    toast.error("This task is no longer available to you.");
    return;
  }
  toast.error(parseApiError(err).message || "Couldn't open this task.");
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
  minimizedTasks: [],
  tasksByList: {},
  subtasksByParent: {},
  loadingLists: new Set(),
  loadingSubtasks: new Set(),
  expandedTasks: new Set(),
  openTaskId: null,
  openTask: null,
  openTaskLoading: false,
  focusCommentId: null,
  highlightTaskId: null,
  setTasksForLists: (incoming) => {
    set((s) => {
      const listsChanged = Object.keys(incoming).some((k) => {
        const prev = s.tasksByList[k];
        const next = incoming[k];
        if (!prev) return true;
        if (prev.length !== next.length) return true;
        return prev.some((t, i) => t.id !== next[i]?.id || t.updatedAt !== next[i]?.updatedAt);
      });
      if (!listsChanged) return s;
      return { tasksByList: { ...s.tasksByList, ...incoming } };
    });
  },

  fetchTasks: async (projectId, listId) => {
    set((s) => {
      const next = new Set(s.loadingLists);
      next.add(listId);
      return { loadingLists: next };
    });
    try {
      const tasks = await taskService.list(projectId, listId);
      set((s) => {
        const next = new Set(s.loadingLists);
        next.delete(listId);
        return { tasksByList: { ...s.tasksByList, [listId]: tasks }, loadingLists: next };
      });
    } catch {
      set((s) => {
        const next = new Set(s.loadingLists);
        next.delete(listId);
        return { loadingLists: next };
      });
    }
  },

  fetchSubtasks: async (taskId) => {
    if (get().loadingSubtasks.has(taskId)) return;
    set((s) => {
      const next = new Set(s.loadingSubtasks);
      next.add(taskId);
      return { loadingSubtasks: next };
    });
    try {
      const subtasks = await taskService.getSubtasks(taskId);
      set((s) => {
        const next = new Set(s.loadingSubtasks);
        next.delete(taskId);
        return { subtasksByParent: { ...s.subtasksByParent, [taskId]: subtasks }, loadingSubtasks: next };
      });
    } catch {
      set((s) => {
        const next = new Set(s.loadingSubtasks);
        next.delete(taskId);
        return { loadingSubtasks: next };
      });
    }
  },

  toggleExpand: (taskId) => {
    const { expandedTasks, fetchSubtasks, subtasksByParent } = get();
    const next = new Set(expandedTasks);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
      if (!subtasksByParent[taskId]) {
        void fetchSubtasks(taskId);
      }
    }
    set({ expandedTasks: next });
  },

  openTaskDetail: async (taskId) => {
    set({ openTaskId: taskId, openTaskLoading: true, openTask: null, focusCommentId: null });
    try {
      const task = await taskService.get(taskId);
      set({ openTask: task, openTaskLoading: false });
    } catch (err) {
      handleOpenTaskError(err);
      set({ openTaskId: null, openTaskLoading: false });
    }
  },

  openTaskDetailAtComment: async (taskId, commentId) => {
    set({ openTaskId: taskId, openTaskLoading: true, openTask: null, focusCommentId: commentId });
    try {
      const task = await taskService.get(taskId);
      set({ openTask: task, openTaskLoading: false });
    } catch (err) {
      handleOpenTaskError(err);
      set({ openTaskId: null, openTaskLoading: false });
    }
  },

  clearFocusComment: () => set({ focusCommentId: null }),

  setHighlightTaskId: (taskId) => set({ highlightTaskId: taskId }),
  clearHighlightTaskId: () => set({ highlightTaskId: null }),

  refreshOpenTask: async () => {
    const { openTaskId } = get();
    if (!openTaskId) return;
    try {
      const task = await taskService.get(openTaskId);
      set({ openTask: task });
    } catch {}
  },

  closeTaskDetail: () => {
    set({ openTaskId: null, openTask: null, openTaskLoading: false, focusCommentId: null });
  },

  minimizeTask: () => {
    const { openTask } = get();
    if (!openTask) return;
    const draft: MinimizedTaskDraft = {
      taskId: openTask.id,
      listId: openTask.list.id,
      title: openTask.title,
      taskIdentifier: openTask.taskId,
    };
    set((s) => ({
      openTaskId: null,
      openTask: null,
      openTaskLoading: false,
      focusCommentId: null,
      minimizedTasks: s.minimizedTasks.some((t) => t.taskId === draft.taskId)
        ? s.minimizedTasks
        : [...s.minimizedTasks, draft],
    }));
  },

  restoreMinimizedTask: async (taskId) => {
    const { minimizedTasks, openTaskDetail } = get();
    set({ minimizedTasks: minimizedTasks.filter((t) => t.taskId !== taskId) });
    await openTaskDetail(taskId);
  },

  closeMinimizedTask: (taskId) => {
    set((s) => ({ minimizedTasks: s.minimizedTasks.filter((t) => t.taskId !== taskId) }));
  },

  createTask: async (projectId, listId, payload) => {
    const created = await taskService.create(projectId, listId, payload);
    const listItem: TaskListItem = {
      id: created.id,
      taskId: created.taskId,
      taskNumber: created.taskNumber,
      title: created.title,
      priority: created.priority,
      startDate: created.startDate,
      dueDate: created.dueDate,
      position: created.position,
      depth: created.depth,
      isCompleted: created.isCompleted,
      completedAt: created.completedAt,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      status: created.status,
      assignees: created.assignees,
      tags: created.tags,
      list: created.list,
      _count: { children: 0 },
    };
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: [...(s.tasksByList[listId] ?? []), listItem],
      },
    }));
    await useTaskSearchStore.getState().refreshMatchingCaches({ projectId, listId });
    return created;
  },

  updateTask: async (taskId, listId, payload) => {
    // Optimistic update
    const prev = get().tasksByList[listId]?.find((t) => t.id === taskId);
    const prevOpenTask = get().openTask?.id === taskId ? get().openTask : null;
    // If payload contains statusId, resolve the full status object so the UI updates immediately
    const resolveStatus = (statusId: string) => {
      const all = [
        ...Object.values(get().tasksByList).flat(),
        ...Object.values(get().subtasksByParent).flat(),
      ];
      return all.find((t) => t.status.id === statusId)?.status;
    };
    const optimisticStatus = payload.statusId ? resolveStatus(payload.statusId) : undefined;
    const searchPatch: Partial<TaskListItem> = { ...(payload as Partial<TaskListItem>) };
    if (optimisticStatus) searchPatch.status = optimisticStatus;
    useTaskSearchStore.getState().applyLocalUpdate(taskId, searchPatch);
    set((s) => {
      const applyPatch = (t: TaskListItem) => {
        const patched: TaskListItem = { ...t, ...payload };
        if (optimisticStatus) patched.status = optimisticStatus;
        return patched;
      };
      const updatedTasks = (s.tasksByList[listId] ?? []).map((t) =>
        t.id === taskId ? applyPatch(t) : t
      );
      const newState: Partial<TaskState> = {
        tasksByList: { ...s.tasksByList, [listId]: updatedTasks },
        subtasksByParent: Object.fromEntries(
          Object.entries(s.subtasksByParent).map(([pid, subs]) => [
            pid,
            subs.map((t) => t.id === taskId ? applyPatch(t) : t),
          ])
        ),
      };
      if (s.openTask?.id === taskId) {
        const openPatched: TaskDetail = { ...s.openTask, ...payload };
        if (optimisticStatus) openPatched.status = optimisticStatus;
        return { ...newState, openTask: openPatched } as Partial<TaskState>;
      }
      return newState as Partial<TaskState>;
    });

    try {
      const updated = await taskService.update(taskId, payload);
      set((s) => {
        const serverPatch = {
          title: updated.title,
          priority: updated.priority,
          startDate: updated.startDate,
          dueDate: updated.dueDate,
          status: updated.status,
          assignees: updated.assignees,
          tags: updated.tags,
          isCompleted: updated.isCompleted,
          completedAt: updated.completedAt,
          updatedAt: updated.updatedAt,
        };
        const newState: Partial<TaskState> = {
          tasksByList: {
            ...s.tasksByList,
            [listId]: (s.tasksByList[listId] ?? []).map((t) =>
              t.id === taskId ? { ...t, ...serverPatch } : t
            ),
          },
          subtasksByParent: Object.fromEntries(
            Object.entries(s.subtasksByParent).map(([pid, subs]) => [
              pid,
              subs.map((t) => t.id === taskId ? { ...t, ...serverPatch } : t),
            ])
          ),
        };

        if (payload.listId && payload.listId !== listId) {
          const oldListTasks = (s.tasksByList[listId] ?? []).filter((t) => t.id !== taskId);
          const newListItem: TaskListItem = {
            id: updated.id,
            taskId: updated.taskId,
            taskNumber: updated.taskNumber,
            title: updated.title,
            priority: updated.priority,
            startDate: updated.startDate,
            dueDate: updated.dueDate,
            position: updated.position,
            depth: updated.depth,
            isCompleted: updated.isCompleted,
            completedAt: updated.completedAt,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
            status: updated.status,
            assignees: updated.assignees,
            tags: updated.tags,
            list: updated.list,
            _count: { children: updated.children.length },
          };
          newState.tasksByList = {
            ...s.tasksByList,
            [listId]: oldListTasks,
            [payload.listId]: [...(s.tasksByList[payload.listId] ?? []), newListItem],
          };
        }

        if (s.openTask?.id === taskId) {
          return { ...newState, openTask: updated } as Partial<TaskState>;
        }
        return newState as Partial<TaskState>;
      });
      // Patch search cache with confirmed server data (no full refetch)
      useTaskSearchStore.getState().applyLocalUpdate(taskId, {
        title: updated.title,
        priority: updated.priority,
        startDate: updated.startDate,
        dueDate: updated.dueDate,
        status: updated.status,
        assignees: updated.assignees,
        tags: updated.tags,
        isCompleted: updated.isCompleted,
        completedAt: updated.completedAt,
        updatedAt: updated.updatedAt,
      });
    } catch (err) {
      // Rollback optimistic updates
      if (prev) useTaskSearchStore.getState().applyLocalUpdate(taskId, prev);
      set((s) => ({
        tasksByList: {
          ...s.tasksByList,
          [listId]: (s.tasksByList[listId] ?? []).map((t) => (t.id === taskId && prev ? prev : t)),
        },
        openTask: prevOpenTask && s.openTask?.id === taskId ? prevOpenTask : s.openTask,
      }));
      throw err;
    }
  },

  updateSubtask: async (subtaskId, parentId, listId, payload) => {
    // Optimistic update
    const prev = get().subtasksByParent[parentId]?.find((t) => t.id === subtaskId);
    const prevOpenTask = get().openTask?.id === subtaskId ? get().openTask : null;
    // If payload contains statusId, resolve the full status object so the UI updates immediately
    const resolveStatus = (statusId: string) => {
      const all = [
        ...Object.values(get().tasksByList).flat(),
        ...Object.values(get().subtasksByParent).flat(),
      ];
      return all.find((t) => t.status.id === statusId)?.status;
    };
    const optimisticStatus = payload.statusId ? resolveStatus(payload.statusId) : undefined;
    set((s) => {
      const applyPatch = (t: TaskListItem) => {
        const patched: TaskListItem = { ...t, ...payload };
        if (optimisticStatus) patched.status = optimisticStatus;
        return patched;
      };
      const hadParentKey = parentId in s.subtasksByParent;
      const nextSubsByParent = hadParentKey
        ? {
            ...s.subtasksByParent,
            [parentId]: s.subtasksByParent[parentId].map((t) =>
              t.id === subtaskId ? applyPatch(t) : t
            ),
          }
        : s.subtasksByParent;
      // Subtasks can also live in tasksByList (depth > 0); patch there too
      const nextTasksByList = {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).map((t) =>
          t.id === subtaskId ? applyPatch(t) : t
        ),
      };
      const newState: Partial<TaskState> = {
        subtasksByParent: nextSubsByParent,
        tasksByList: nextTasksByList,
      };
      // Patch openTask.children if the open task is the parent
      if (s.openTask && s.openTask.children?.some((c) => c.id === subtaskId)) {
        const patchedChildren = s.openTask.children.map((c) =>
          c.id === subtaskId
            ? {
                ...c,
                ...payload,
                ...(optimisticStatus ? { status: optimisticStatus } : {}),
              }
            : c
        );
        newState.openTask = { ...s.openTask, children: patchedChildren };
      }
      if (s.openTask?.id === subtaskId) {
        const openPatched: TaskDetail = { ...s.openTask, ...payload };
        if (optimisticStatus) openPatched.status = optimisticStatus;
        newState.openTask = openPatched;
      }
      return newState as Partial<TaskState>;
    });

    try {
      const updated = await taskService.update(subtaskId, payload);
      set((s) => {
        const serverPatch = {
          title: updated.title,
          priority: updated.priority,
          startDate: updated.startDate,
          dueDate: updated.dueDate,
          status: updated.status,
          assignees: updated.assignees,
          tags: updated.tags,
          isCompleted: updated.isCompleted,
          completedAt: updated.completedAt,
          updatedAt: updated.updatedAt,
        };
        const patchChild = (c: TaskDetail["children"][number]) =>
          c.id === subtaskId ? { ...c, ...serverPatch } : c;
        const hadParentKey = parentId in s.subtasksByParent;
        const nextSubsByParent = hadParentKey
          ? {
              ...s.subtasksByParent,
              [parentId]: s.subtasksByParent[parentId].map((t) =>
                t.id === subtaskId ? { ...t, ...serverPatch } : t
              ),
            }
          : s.subtasksByParent;
        const nextTasksByList = {
          ...s.tasksByList,
          [listId]: (s.tasksByList[listId] ?? []).map((t) =>
            t.id === subtaskId
              ? { ...t, ...serverPatch }
              : t.id === parentId && hadParentKey
                ? { ...t, _count: { children: s.subtasksByParent[parentId].length } }
                : t
          ),
        };
        const newState: Partial<TaskState> = {
          subtasksByParent: nextSubsByParent,
          tasksByList: nextTasksByList,
        };
        if (s.openTask?.id === subtaskId) {
          return { ...newState, openTask: updated } as Partial<TaskState>;
        }
        if (s.openTask?.id === parentId && s.openTask.children) {
          return { ...newState, openTask: { ...s.openTask, children: s.openTask.children.map(patchChild) } } as Partial<TaskState>;
        }
        return newState as Partial<TaskState>;
      });
    } catch (err) {
      // Rollback on error
      set((s) => {
        const hadParentKey = parentId in s.subtasksByParent;
        return {
          subtasksByParent: hadParentKey
            ? {
                ...s.subtasksByParent,
                [parentId]: s.subtasksByParent[parentId].map((t) =>
                  t.id === subtaskId && prev ? prev : t
                ),
              }
            : s.subtasksByParent,
          openTask: prevOpenTask && s.openTask?.id === subtaskId ? prevOpenTask : s.openTask,
        };
      });
      throw err;
    }
  },

  deleteTask: async (taskId, listId) => {
    const task = get().tasksByList[listId]?.find((item) => item.id === taskId);
    await taskService.delete(taskId);
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).filter((t) => t.id !== taskId),
      },
      openTask: s.openTask?.id === taskId ? null : s.openTask,
      openTaskId: s.openTaskId === taskId ? null : s.openTaskId,
    }));
    await useTaskSearchStore.getState().refreshMatchingCaches({
      projectId: task?.list.project.id,
      listId,
    });
  },

  deleteSubtask: async (subtaskId, parentId, listId) => {
    const parentTask = get().tasksByList[listId]?.find((item) => item.id === parentId);
    await taskService.delete(subtaskId);
    set((s) => {
      const updatedSubs = (s.subtasksByParent[parentId] ?? []).filter((t) => t.id !== subtaskId);
      const updatedList = (s.tasksByList[listId] ?? []).map((t) =>
        t.id === parentId ? { ...t, _count: { children: updatedSubs.length } } : t
      );
      return {
        subtasksByParent: { ...s.subtasksByParent, [parentId]: updatedSubs },
        tasksByList: { ...s.tasksByList, [listId]: updatedList },
        openTask: s.openTask?.id === subtaskId
          ? null
          : s.openTask?.id === parentId
            ? { ...s.openTask, children: s.openTask.children.filter(c => c.id !== subtaskId) }
            : s.openTask,
        openTaskId: s.openTaskId === subtaskId ? null : s.openTaskId,
      };
    });
    await useTaskSearchStore.getState().refreshMatchingCaches({
      projectId: parentTask?.list.project.id,
      listId,
    });
  },

  completeTask: async (taskId, listId) => {
    const updated = await taskService.complete(taskId);
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).map((t) =>
          t.id === taskId ? { ...t, isCompleted: true, completedAt: updated.completedAt } : t
        ),
      },
      openTask: s.openTask?.id === taskId ? updated : s.openTask,
    }));
    await useTaskSearchStore.getState().refreshMatchingCaches({
      projectId: updated.list.project.id,
      listId: updated.list.id,
    });
  },

  uncompleteTask: async (taskId, listId) => {
    const updated = await taskService.uncomplete(taskId);
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).map((t) =>
          t.id === taskId ? { ...t, isCompleted: false, completedAt: null } : t
        ),
      },
      openTask: s.openTask?.id === taskId ? updated : s.openTask,
    }));
    await useTaskSearchStore.getState().refreshMatchingCaches({
      projectId: updated.list.project.id,
      listId: updated.list.id,
    });
  },

  reorderTasks: async (projectId, listId, taskIds) => {
    await taskService.reorder(projectId, listId, taskIds);
    useTaskSearchStore.getState().applyLocalReorder({ projectId, listId, orderedIds: taskIds });
  },

  createSubtask: async (taskId, listId, payload) => {
    const subtask = await taskService.createSubtask(taskId, payload);
    const subtaskItem: TaskListItem = {
      id: subtask.id,
      taskId: subtask.taskId,
      taskNumber: subtask.taskNumber,
      title: subtask.title,
      priority: subtask.priority,
      startDate: subtask.startDate,
      dueDate: subtask.dueDate,
      position: subtask.position,
      depth: subtask.depth,
      isCompleted: subtask.isCompleted,
      completedAt: subtask.completedAt,
      createdAt: subtask.createdAt,
      updatedAt: subtask.updatedAt,
      status: subtask.status,
      assignees: subtask.assignees,
      tags: subtask.tags,
      list: subtask.list,
      _count: { children: 0 },
    };
    set((s) => {
      // Add subtask to subtasksByParent
      const existingSubs = s.subtasksByParent[taskId] ?? [];
      const updatedSubs = [...existingSubs, subtaskItem];
      // Increment parent _count in tasksByList
      const updatedList = (s.tasksByList[listId] ?? []).map((t) =>
        t.id === taskId ? { ...t, _count: { children: updatedSubs.length } } : t
      );
      // Auto-expand parent
      const nextExpanded = new Set(s.expandedTasks);
      nextExpanded.add(taskId);
      // Refresh openTask if it's the parent
      const openTask = s.openTask?.id === taskId
        ? { ...s.openTask, children: [...(s.openTask.children ?? []), subtaskItem] }
        : s.openTask?.children?.some((c) => c.id === taskId)
          // The new subtask sits one level below a row in the open task's panel:
          // bump that row's count so it gets an expander.
          ? {
              ...s.openTask,
              children: s.openTask.children.map((c) =>
                c.id === taskId ? { ...c, _count: { children: updatedSubs.length } } : c
              ),
            }
          : s.openTask;
      return {
        subtasksByParent: { ...s.subtasksByParent, [taskId]: updatedSubs },
        tasksByList: { ...s.tasksByList, [listId]: updatedList },
        expandedTasks: nextExpanded,
        openTask,
      };
    });
    await useTaskSearchStore.getState().refreshMatchingCaches({
      projectId: subtask.list.project.id,
      listId: subtask.list.id,
    });
    return subtask;
  },

  addAssignee: async (taskId, listId, userIds) => {
    const updated = await taskService.addAssignee(taskId, userIds);
    set((s) => {
      const patchedOpenTask = s.openTask?.id === taskId
        ? updated
        : s.openTask?.children?.some(c => c.id === taskId)
          ? { ...s.openTask, children: s.openTask.children.map(c => c.id === taskId ? { ...c, assignees: updated.assignees } : c) }
          : s.openTask;
      return {
        tasksByList: {
          ...s.tasksByList,
          [listId]: (s.tasksByList[listId] ?? []).map((t) =>
            t.id === taskId ? { ...t, assignees: updated.assignees } : t
          ),
        },
        subtasksByParent: Object.fromEntries(
          Object.entries(s.subtasksByParent).map(([pid, subs]) => [
            pid,
            subs.map((t) => t.id === taskId ? { ...t, assignees: updated.assignees } : t),
          ])
        ),
        openTask: patchedOpenTask,
      };
    });
    useTaskSearchStore.getState().applyLocalUpdate(taskId, { assignees: updated.assignees });
  },

  removeAssignee: async (taskId, listId, userId) => {
    const optimisticRemove = (assignees: TaskListItem["assignees"]) =>
      assignees.filter((a) => a.user.id !== userId);
    // Optimistic update across all stores
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).map((t) =>
          t.id === taskId ? { ...t, assignees: optimisticRemove(t.assignees) } : t
        ),
      },
      subtasksByParent: Object.fromEntries(
        Object.entries(s.subtasksByParent).map(([pid, subs]) => [
          pid,
          subs.map((t) => t.id === taskId ? { ...t, assignees: optimisticRemove(t.assignees) } : t),
        ])
      ),
      openTask: s.openTask?.id === taskId
        ? { ...s.openTask, assignees: optimisticRemove(s.openTask.assignees) }
        : s.openTask?.children?.some(c => c.id === taskId)
          ? { ...s.openTask, children: s.openTask.children.map(c => c.id === taskId ? { ...c, assignees: optimisticRemove(c.assignees) } : c) }
          : s.openTask,
    }));
    const patchedAssignees = get().tasksByList[listId]?.find(t => t.id === taskId)?.assignees
      ?? Object.values(get().subtasksByParent).flat().find(t => t.id === taskId)?.assignees
      ?? [];
    useTaskSearchStore.getState().applyLocalUpdate(taskId, { assignees: patchedAssignees });
    try {
      const updated = await taskService.removeAssignee(taskId, userId);
      set((s) => ({
        tasksByList: {
          ...s.tasksByList,
          [listId]: (s.tasksByList[listId] ?? []).map((t) =>
            t.id === taskId ? { ...t, assignees: updated.assignees } : t
          ),
        },
        subtasksByParent: Object.fromEntries(
          Object.entries(s.subtasksByParent).map(([pid, subs]) => [
            pid,
            subs.map((t) => t.id === taskId ? { ...t, assignees: updated.assignees } : t),
          ])
        ),
        openTask: s.openTask?.id === taskId
          ? updated
          : s.openTask?.children?.some(c => c.id === taskId)
            ? { ...s.openTask, children: s.openTask.children.map(c => c.id === taskId ? { ...c, assignees: updated.assignees } : c) }
            : s.openTask,
      }));
      useTaskSearchStore.getState().applyLocalUpdate(taskId, { assignees: updated.assignees });
    } catch (err) { throw err; }
  },

  addTag: async (taskId, listId, tagId, tagInfo) => {
    // Optimistic update if we have tag info
    if (tagInfo) {
      const optimisticTag = { tag: { id: tagId, name: tagInfo.name, color: tagInfo.color } };
      const addOptimistic = (tags: TaskListItem["tags"] | undefined) =>
        (tags ?? []).some(t => t.tag.id === tagId) ? (tags ?? []) : [...(tags ?? []), optimisticTag];
      set((s) => {
        const patchOpenTask = s.openTask?.id === taskId
          ? { ...s.openTask, tags: addOptimistic(s.openTask.tags) }
          : s.openTask && s.openTask.children?.some(c => c.id === taskId)
            ? { ...s.openTask, children: s.openTask.children.map(c => c.id === taskId ? { ...c, tags: addOptimistic(c.tags) } : c) }
            : s.openTask;
        return {
          tasksByList: {
            ...s.tasksByList,
            [listId]: (s.tasksByList[listId] ?? []).map((t) =>
              t.id === taskId ? { ...t, tags: addOptimistic(t.tags) } : t
            ),
          },
          subtasksByParent: Object.fromEntries(
            Object.entries(s.subtasksByParent).map(([pid, subs]) => [
              pid,
              subs.map((t) => t.id === taskId ? { ...t, tags: addOptimistic(t.tags) } : t),
            ])
          ),
          openTask: patchOpenTask,
        };
      });
      const optimisticTags = get().tasksByList[listId]?.find(t => t.id === taskId)?.tags
        ?? Object.values(get().subtasksByParent).flat().find(t => t.id === taskId)?.tags
        ?? [];
      useTaskSearchStore.getState().applyLocalUpdate(taskId, { tags: optimisticTags });
    }
    const updated = await taskService.addTag(taskId, tagId);
    set((s) => {
      const patchOpenTask = s.openTask?.id === taskId
        ? updated
        : s.openTask && s.openTask.children?.some(c => c.id === taskId)
          ? { ...s.openTask, children: s.openTask.children.map(c => c.id === taskId ? { ...c, tags: updated.tags } : c) }
          : s.openTask;
      return {
        tasksByList: {
          ...s.tasksByList,
          [listId]: (s.tasksByList[listId] ?? []).map((t) =>
            t.id === taskId ? { ...t, tags: updated.tags } : t
          ),
        },
        subtasksByParent: Object.fromEntries(
          Object.entries(s.subtasksByParent).map(([pid, subs]) => [
            pid,
            subs.map((t) => t.id === taskId ? { ...t, tags: updated.tags } : t),
          ])
        ),
        openTask: patchOpenTask,
      };
    });
    useTaskSearchStore.getState().applyLocalUpdate(taskId, { tags: updated.tags });
  },

  removeTag: async (taskId, listId, tagId) => {
    const optimisticFilter = (tags: TaskListItem["tags"]) =>
      tags.filter((tg) => tg.tag.id !== tagId);
    // Optimistic update across all stores
    set((s) => ({
      tasksByList: {
        ...s.tasksByList,
        [listId]: (s.tasksByList[listId] ?? []).map((t) =>
          t.id === taskId ? { ...t, tags: optimisticFilter(t.tags) } : t
        ),
      },
      subtasksByParent: Object.fromEntries(
        Object.entries(s.subtasksByParent).map(([pid, subs]) => [
          pid,
          subs.map((t) => t.id === taskId ? { ...t, tags: optimisticFilter(t.tags) } : t),
        ])
      ),
      openTask: s.openTask?.id === taskId
        ? { ...s.openTask, tags: optimisticFilter(s.openTask.tags) }
        : s.openTask && s.openTask.children?.some(c => c.id === taskId)
          ? { ...s.openTask, children: s.openTask.children.map(c => c.id === taskId ? { ...c, tags: optimisticFilter(c.tags) } : c) }
          : s.openTask,
    }));
    const patchedTags = get().tasksByList[listId]?.find(t => t.id === taskId)?.tags
      ?? Object.values(get().subtasksByParent).flat().find(t => t.id === taskId)?.tags
      ?? [];
    useTaskSearchStore.getState().applyLocalUpdate(taskId, { tags: patchedTags });
    try {
      const updated = await taskService.removeTag(taskId, tagId);
      set((s) => ({
        tasksByList: {
          ...s.tasksByList,
          [listId]: (s.tasksByList[listId] ?? []).map((t) =>
            t.id === taskId ? { ...t, tags: updated.tags } : t
          ),
        },
        subtasksByParent: Object.fromEntries(
          Object.entries(s.subtasksByParent).map(([pid, subs]) => [
            pid,
            subs.map((t) => t.id === taskId ? { ...t, tags: updated.tags } : t),
          ])
        ),
        openTask: s.openTask?.id === taskId
          ? updated
          : s.openTask && s.openTask.children?.some(c => c.id === taskId)
            ? { ...s.openTask, children: s.openTask.children.map(c => c.id === taskId ? { ...c, tags: updated.tags } : c) }
            : s.openTask,
      }));
      useTaskSearchStore.getState().applyLocalUpdate(taskId, { tags: updated.tags });
    } catch (err) { throw err; }
  },

  purgeTag: (tagId) => {
    set((s) => ({
      tasksByList: Object.fromEntries(
        Object.entries(s.tasksByList).map(([listId, tasks]) => [
          listId,
          tasks.map((t) => ({ ...t, tags: t.tags.filter((tag) => tag.tag.id !== tagId) })),
        ])
      ),
      subtasksByParent: Object.fromEntries(
        Object.entries(s.subtasksByParent).map(([parentId, tasks]) => [
          parentId,
          tasks.map((t) => ({ ...t, tags: t.tags.filter((tag) => tag.tag.id !== tagId) })),
        ])
      ),
      openTask: s.openTask
        ? { ...s.openTask, tags: s.openTask.tags.filter((tag) => tag.tag.id !== tagId) }
        : null,
    }));
  },

  updateTagInStore: (tag) => {
    set((s) => ({
      tasksByList: Object.fromEntries(
        Object.entries(s.tasksByList).map(([listId, tasks]) => [
          listId,
          tasks.map((t) => ({
            ...t,
            tags: t.tags.map((tt) => tt.tag.id === tag.id ? { ...tt, tag: { ...tt.tag, ...tag } } : tt),
          })),
        ])
      ),
      subtasksByParent: Object.fromEntries(
        Object.entries(s.subtasksByParent).map(([parentId, tasks]) => [
          parentId,
          tasks.map((t) => ({
            ...t,
            tags: t.tags.map((tt) => tt.tag.id === tag.id ? { ...tt, tag: { ...tt.tag, ...tag } } : tt),
          })),
        ])
      ),
      openTask: s.openTask
        ? {
            ...s.openTask,
            tags: s.openTask.tags.map((tt) =>
              tt.tag.id === tag.id ? { ...tt, tag: { ...tt.tag, ...tag } } : tt
            ),
          }
        : null,
    }));
  },
    }),
    {
      name: "task-store-cache",
      version: 1,
      storage: createJSONStorage(() => idbStateStorage),
      // Persist only the resolved task lists. Everything else is session-only:
      // the Set fields don't survive JSON, and open/minimized/expanded state is
      // transient UI that shouldn't be restored across a reload.
      partialize: (state) => ({
        tasksByList: state.tasksByList,
        subtasksByParent: state.subtasksByParent,
      }),
    }
  )
);
