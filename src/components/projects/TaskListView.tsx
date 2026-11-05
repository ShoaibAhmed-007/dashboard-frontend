"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MemberOption } from "@/components/projects/AssigneePicker";
import { createPortal } from "react-dom";
import { TaskList } from "@/services/task-list.service";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useTaskStore } from "@/stores/task.store";
import { TaskListItem, TaskPriority } from "@/services/task.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import StatusIcon from "./StatusIcon";
import TaskRow from "./TaskRow";
import TaskQuickCreate from "./TaskQuickCreate";
import {
  LuArchive,
  LuChevronDown,
  LuEllipsis,
  LuPlus,
  LuRotateCcw,
  LuTrash2,
} from "react-icons/lu";

const FALLBACK_STATUSES: StatusItem[] = [
  { id: "fallback_todo", projectId: "", name: "TO DO", color: "#94a3b8", group: "NOT_STARTED", position: 1000, isDefault: true, isProtected: true, isClosed: false, createdAt: "", updatedAt: "" },
  { id: "fallback_inprogress", projectId: "", name: "IN PROGRESS", color: "#3b82f6", group: "ACTIVE", position: 2000, isDefault: true, isProtected: false, isClosed: false, createdAt: "", updatedAt: "" },
  { id: "fallback_review", projectId: "", name: "REVIEW", color: "#f59e0b", group: "DONE", position: 3000, isDefault: true, isProtected: false, isClosed: false, createdAt: "", updatedAt: "" },
  { id: "fallback_done", projectId: "", name: "COMPLETE", color: "#2a9764", group: "CLOSED", position: 4000, isDefault: true, isProtected: true, isClosed: true, createdAt: "", updatedAt: "" },
];

const TASK_ROW_HEIGHT = 40;

export interface TaskListSectionData {
  list: TaskList;
  tasks: TaskListItem[];
}

interface TaskListViewProps {
  mode: "project" | "list";
  projectName: string;
  projectId: string;
  sections: TaskListSectionData[];
  statuses: StatusItem[];
  onAdd: (options?: { statusId?: string; listId?: string }) => void;
  onCreateList?: () => void;
  onRenameList?: (list: TaskList) => void;
  onArchiveList?: (list: TaskList) => void;
  onRestoreList?: (list: TaskList) => void;
  onDeleteList?: (list: TaskList) => void;
  onOpenTaskDetail?: (taskId: string) => void;
  disableAutoFetch?: boolean;
  disableSameStatusReorder?: boolean;
}

const COL = "minmax(0,1fr) 110px 110px 80px 100px 32px";

interface ListDragState {
  task: TaskListItem;
  fromStatusId: string;
  fromIdx: number;
  startY: number;
  offsetY: number;
  rowWidth: number;
}

function StatusGroup({
  list,
  projectId,
  status,
  statuses,
  members,
  onOpenTaskDetail,
  onRefetchMembers,
  dragState,
  dropTargetStatusId,
  dropIdx,
  onDragStart,
  onGroupEnter,
  disableAutoFetch,
}: {
  list: TaskList;
  projectId: string;
  status: StatusItem;
  statuses: StatusItem[];
  members: MemberOption[];
  onOpenTaskDetail: (taskId: string) => void;
  onRefetchMembers?: () => void;
  dragState: ListDragState | null;
  dropTargetStatusId: string | null;
  dropIdx: number | null;
  onDragStart: (e: React.PointerEvent, task: TaskListItem, idx: number, rowEl: HTMLDivElement) => void;
  onGroupEnter: (statusId: string) => void;
  disableAutoFetch?: boolean;
}) {
  const {
    tasksByList,
    loadingLists,
    fetchTasks,
    updateTask,
    deleteTask,
    addAssignee,
    removeAssignee,
    createTask,
    highlightTaskId,
    clearHighlightTaskId,
  } = useTaskStore();
  const [collapsed, setCollapsed] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  useEffect(() => {
    if (!disableAutoFetch && !tasksByList[list.id] && !loadingLists.has(list.id)) {
      void fetchTasks(projectId, list.id);
    }
  }, [disableAutoFetch, list.id, projectId, fetchTasks, tasksByList, loadingLists]);

  const tasks = useMemo(
    () => (tasksByList[list.id] ?? []).filter((t) => t.status.id === status.id && t.depth === 0),
    [tasksByList, list.id, status.id]
  );

  /* A row a redirect (e.g. "view in project" from Minutes of Meeting) is
     pointing at can't be scrolled to or glow while its own status group
     sits collapsed — nothing rendered to find yet. Derived directly during
     render rather than synced into `collapsed` via its own effect (an extra
     render generation for no benefit): a group renders expanded on any pass
     where it holds the highlight target, regardless of what `collapsed`
     itself currently is. */
  const containsHighlightTarget = useMemo(
    () => !!highlightTaskId && tasks.some((t) => t.id === highlightTaskId),
    [highlightTaskId, tasks]
  );
  const effectivelyCollapsed = collapsed && !containsHighlightTarget;

  /* Scroll-to and glow — DOM manipulation directly, the same pattern
     `TaskComments.tsx` already uses for `comment-highlight`/`focusCommentId`,
     not React state: this effect only runs once `containsHighlightTarget`
     turns true, which only happens after the row has already rendered (it's
     computed from `tasks`, the same data the row itself renders from), so
     the element the selector below looks for is guaranteed to exist. */
  useEffect(() => {
    if (!containsHighlightTarget || effectivelyCollapsed) return;

    const el = document.querySelector<HTMLElement>(
      `[data-task-row-id="${highlightTaskId}"]`
    );
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("task-row-highlight");

    /* Clearing the store id is what makes `containsHighlightTarget` (and
       therefore this whole effect's guard) go false on the very next
       render — which runs this effect's OWN cleanup before that next render
       commits. If that happened synchronously, in the same tick as adding
       the class, the cleanup below could cancel `clearClassTimeout` almost
       immediately, well before the glow had actually played out, which is
       what "vanishes instantly" was: not the class being removed early, but
       the class's own removal being pre-empted so fast that the still-fresh
       DOM node effectively restarted with no visible transition once React
       reconciled it moments later. Deferring the store clear to its own
       timeout breaks that same-tick coupling. */
    const clearStoreId = setTimeout(() => clearHighlightTaskId(), 50);
    const clearClass = setTimeout(
      () => el.classList.remove("task-row-highlight"),
      3200
    );
    return () => {
      clearTimeout(clearStoreId);
      clearTimeout(clearClass);
    };
  }, [containsHighlightTarget, effectivelyCollapsed, highlightTaskId, clearHighlightTaskId]);

  const isDraggingFromHere = dragState?.fromStatusId === status.id;
  const isDropTarget = dropTargetStatusId === status.id;
  const isCrossTarget = isDropTarget && dragState !== null && !isDraggingFromHere;

  const handleQuickCreate = async (payload: {
    title: string;
    assigneeIds: string[];
    startDate: string | null;
    dueDate: string | null;
    priority: TaskPriority;
  }) => {
    try {
      await createTask(projectId, list.id, {
        title: payload.title,
        statusId: status.id,
        assigneeIds: payload.assigneeIds.length ? payload.assigneeIds : undefined,
        startDate: payload.startDate ?? undefined,
        dueDate: payload.dueDate ?? undefined,
        priority: payload.priority !== "NONE" ? payload.priority : undefined,
      });
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
    setQuickCreateOpen(false);
  };

  const handleUpdateStatus = async (task: TaskListItem, statusId: string) => {
    try { await updateTask(task.id, list.id, { statusId }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };
  const handleUpdatePriority = async (task: TaskListItem, priority: TaskPriority) => {
    try { await updateTask(task.id, list.id, { priority }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };
  const handleUpdateDates = async (task: TaskListItem, startDate: string | null, dueDate: string | null) => {
    try { await updateTask(task.id, list.id, { startDate, dueDate }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };
  const handleAddAssignee = async (task: TaskListItem, userId: string) => {
    try { await addAssignee(task.id, list.id, [userId]); }
    catch (err) { toast.error(parseApiError(err).message); }
  };
  const handleRemoveAssignee = async (task: TaskListItem, userId: string) => {
    try { await removeAssignee(task.id, list.id, userId); }
    catch (err) { toast.error(parseApiError(err).message); }
  };
  const handleDelete = async (task: TaskListItem) => {
    try { await deleteTask(task.id, list.id); toast.success("Task deleted"); }
    catch (err) { toast.error(parseApiError(err).message); }
  };

  return (
    <div
      className={`border-b border-gray-100 last:border-b-0 dark:border-gray-700 transition-colors ${isCrossTarget ? "bg-brand-50 dark:bg-brand-900/10" : ""}`}
      onPointerEnter={() => { if (dragState) onGroupEnter(status.id); }}
    >
      {/* Status group header */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-left"
        >
          <LuChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-gray-400  transition-transform ${effectivelyCollapsed ? "-rotate-90" : ""}`}
          />
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-medium tracking-wider uppercase text-white"
            style={{ backgroundColor: status.color }}
          >
            <StatusIcon group={status.group} color="#fff" size={16} />
            {status.name}
          </span>
          <span className="text-xs text-gray-400">{tasks.length}</span>
        </button>
        <div className="flex items-center gap-1 ml-auto">
          <button type="button" className="rounded p-0.5 text-gray-300 hover:text-gray-600 dark:hover:text-gray-000">
            <LuEllipsis className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setQuickCreateOpen(true)}
            className="rounded p-0.5 text-gray-300 hover:text-brand-500 dark:hover:text-gray-000"
            title="Add task"
          >
            <LuPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!effectivelyCollapsed && (
        <div>
          {tasks.length > 0 && (
            <div
              className="grid items-center gap-2 border-b border-gray-100 px-4 py-1.5 text-[11px] text-gray-400 dark:border-gray-800"
              style={{ gridTemplateColumns: COL }}
            >
              <span className="pl-3">Name</span>
              <span>Assignee</span>
              <span>Due date</span>
              <span>Priority</span>
              <span>Status</span>
              <span />
            </div>
          )}

          {/* Task rows with animated shifts */}
          <div>
            {tasks.map((task, idx) => {
              const isDraggingThis = dragState?.task.id === task.id && isDraggingFromHere;
              const from = isDraggingFromHere ? (dragState?.fromIdx ?? idx) : idx;
              const to = isDraggingFromHere ? (dropIdx ?? from) : from;
              let shift = 0;
              if (isDraggingFromHere && dragState && !isDraggingThis) {
                if (from < to && idx > from && idx <= to) shift = -TASK_ROW_HEIGHT;
                if (from > to && idx < from && idx >= to) shift = TASK_ROW_HEIGHT;
              }
              let rowEl: HTMLDivElement | null = null;
              return (
                <div
                  key={task.id}
                  ref={(el) => { rowEl = el; }}
                  data-task-row-id={task.id}
                  style={{
                    transform: `translateY(${shift}px)`,
                    transition: "transform 180ms ease",
                    opacity: isDraggingThis ? 0 : 1,
                  }}
                >
                  <TaskRow
                    task={task}
                    statuses={statuses}
                    members={members}
                    listId={list.id}
                    onView={onOpenTaskDetail}
                    onUpdateStatus={(statusId) => handleUpdateStatus(task, statusId)}
                    onUpdatePriority={(priority) => handleUpdatePriority(task, priority)}
                    onUpdateDates={(start, due) => handleUpdateDates(task, start, due)}
                    onAddAssignee={(userId) => handleAddAssignee(task, userId)}
                    onRemoveAssignee={(userId) => handleRemoveAssignee(task, userId)}
                    onDelete={() => handleDelete(task)}
                    onRefetchMembers={onRefetchMembers}
                    dragHandleProps={{
                      onPointerDown: (e: React.PointerEvent) => {
                        if (rowEl) onDragStart(e, task, idx, rowEl);
                      },
                      style: { touchAction: "none", cursor: "grab" },
                    }}
                  />
                </div>
              );
            })}

            {/* Space that opens in target group when dragging in from another status */}
            <div
              style={{
                height: isCrossTarget ? TASK_ROW_HEIGHT : 0,
                transition: "height 180ms ease",
                overflow: "hidden",
              }}
            />
          </div>

          {loadingLists.has(list.id) && tasks.length === 0 && (
            <div className="px-8 py-3 text-xs text-gray-400">Loading...</div>
          )}

          {quickCreateOpen ? (
            <TaskQuickCreate
              status={status}
              members={members}
              onSave={handleQuickCreate}
              onCancel={() => setQuickCreateOpen(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setQuickCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 text-sm text-gray-400 transition-colors hover:text-brand-500 dark:hover:text-gray-000"
            >
              <span className="flex w-8 shrink-0 items-center justify-center">
                <LuPlus className="h-3.5 w-3.5" />
              </span>
              Add Task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ListSection({
  list,
  projectId,
  statuses,
  members,
  onOpenTaskDetail,
  onRefetchMembers,
  showListHeader,
  disableAutoFetch,
  disableSameStatusReorder,
}: {
  list: TaskList;
  projectId: string;
  statuses: StatusItem[];
  members: MemberOption[];
  onOpenTaskDetail: (taskId: string) => void;
  onRefetchMembers?: () => void;
  showListHeader: boolean;
  disableAutoFetch?: boolean;
  disableSameStatusReorder?: boolean;
}) {
  const { updateTask, reorderTasks, fetchTasks } = useTaskStore();

  const dragRef = useRef<ListDragState | null>(null);
  const suppressClickRef = useRef(false);
  const dropTargetStatusIdRef = useRef<string | null>(null);
  const dropIdxRef = useRef<number | null>(null);
  const [activeDrag, setActiveDrag] = useState<ListDragState | null>(null);
  const [dropTargetStatusId, setDropTargetStatusId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number; width: number } | null>(null);

  useEffect(() => { dropTargetStatusIdRef.current = dropTargetStatusId; }, [dropTargetStatusId]);
  useEffect(() => { dropIdxRef.current = dropIdx; }, [dropIdx]);

  const handleDragStart = useCallback((
    e: React.PointerEvent,
    task: TaskListItem,
    idx: number,
    rowEl: HTMLDivElement,
  ) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) return;
    e.preventDefault();
    const rect = rowEl.getBoundingClientRect();
    const state: ListDragState = {
      task,
      fromStatusId: task.status.id,
      fromIdx: idx,
      startY: e.clientY,
      offsetY: e.clientY - rect.top,
      rowWidth: rect.width,
    };
    dragRef.current = state;
    suppressClickRef.current = true;
    dropTargetStatusIdRef.current = task.status.id;
    dropIdxRef.current = idx;
    let styleEl = document.getElementById("__drag_cursor__") as HTMLStyleElement | null;
    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "__drag_cursor__"; document.head.appendChild(styleEl); }
    styleEl.textContent = "*{cursor:grabbing!important}";
    setActiveDrag(state);
    setDropTargetStatusId(task.status.id);
    setDropIdx(idx);
    setGhostPos({ x: rect.left, y: rect.top, width: rect.width });
  }, []);

  useEffect(() => {
    if (!activeDrag) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { fromIdx, startY, offsetY } = drag;
      const currentTarget = dropTargetStatusIdRef.current ?? drag.fromStatusId;
      if (currentTarget === drag.fromStatusId) {
        const tasksInGroup = (useTaskStore.getState().tasksByList[list.id] ?? []).filter(
          (t) => t.status.id === drag.fromStatusId && t.depth === 0
        );
        const dy = e.clientY - startY;
        const slot = Math.round(fromIdx + dy / TASK_ROW_HEIGHT);
        const next = Math.max(0, Math.min(Math.max(0, tasksInGroup.length - 1), slot));
        if (next !== dropIdxRef.current) {
          dropIdxRef.current = next;
          setDropIdx(next);
        }
      }
      setGhostPos((p) => p ? { ...p, y: e.clientY - offsetY } : p);
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      const targetStatusId = dropTargetStatusIdRef.current ?? drag.fromStatusId;
      const from = drag.fromIdx;
      const to = dropIdxRef.current ?? from;

      dragRef.current = null;
      const styleEl = document.getElementById("__drag_cursor__");
      if (styleEl) styleEl.textContent = "";
      setTimeout(() => { suppressClickRef.current = false; }, 80);
      setActiveDrag(null);
      setDropTargetStatusId(null);
      setDropIdx(null);
      setGhostPos(null);
      dropTargetStatusIdRef.current = null;
      dropIdxRef.current = null;

      const allListTasks = useTaskStore.getState().tasksByList[list.id] ?? [];
      const isSameStatus = targetStatusId === drag.fromStatusId;

      if (!isSameStatus) {
        updateTask(drag.task.id, list.id, { statusId: targetStatusId }).catch((err) => {
          toast.error(parseApiError(err).message);
          if (!disableAutoFetch) void fetchTasks(projectId, list.id);
        });
        return;
      }

      if (disableSameStatusReorder) return;
      if (from === to) return;

      const groupTasks = allListTasks.filter((t) => t.status.id === drag.fromStatusId && t.depth === 0);
      const reordered = [...groupTasks];
      const [moved] = reordered.splice(from, 1);
      if (!moved) return;
      reordered.splice(to, 0, moved);

      const others = allListTasks.filter((t) => !(t.status.id === drag.fromStatusId && t.depth === 0));
      useTaskStore.setState((s) => ({
        tasksByList: { ...s.tasksByList, [list.id]: [...others, ...reordered] },
      }));

      const allRoot = allListTasks.filter((t) => t.depth === 0);
      const reorderedIds = new Set(reordered.map((t) => t.id));
      const withGap = allRoot.filter((t) => !reorderedIds.has(t.id));
      const firstOfGroup = allRoot.find((t) => t.status.id === drag.fromStatusId);
      const insertAt = firstOfGroup ? withGap.findIndex((t) => {
        const origIdx = allRoot.findIndex((r) => r.id === t.id);
        const groupStart = allRoot.findIndex((r) => r.id === firstOfGroup.id);
        return origIdx > groupStart;
      }) : -1;
      withGap.splice(insertAt < 0 ? withGap.length : insertAt, 0, ...reordered);

      reorderTasks(projectId, list.id, withGap.map((t) => t.id)).catch((err) => {
        toast.error(parseApiError(err).message);
        if (!disableAutoFetch) void fetchTasks(projectId, list.id);
      });
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [activeDrag, disableAutoFetch, disableSameStatusReorder, list.id, projectId, updateTask, reorderTasks, fetchTasks]);

  const handleGroupEnter = useCallback((statusId: string) => {
    dropTargetStatusIdRef.current = statusId;
    setDropTargetStatusId(statusId);
    if (dragRef.current && statusId !== dragRef.current.fromStatusId) {
      dropIdxRef.current = null;
      setDropIdx(null);
    }
  }, []);

  const groups = statuses.map((status) => (
    <StatusGroup
      key={`${list.id}-${status.id}`}
      list={list}
      projectId={projectId}
      status={status}
      statuses={statuses}
      members={members}
      onOpenTaskDetail={(taskId) => { if (!suppressClickRef.current) onOpenTaskDetail(taskId); }}
      onRefetchMembers={onRefetchMembers}
      dragState={activeDrag}
      dropTargetStatusId={dropTargetStatusId}
      dropIdx={dropIdx}
      onDragStart={handleDragStart}
      onGroupEnter={handleGroupEnter}
      disableAutoFetch={disableAutoFetch}
    />
  ));

  const content = (
    <div style={{ userSelect: activeDrag ? "none" : undefined }}>
      {groups}
      {ghostPos && activeDrag && createPortal(
        <div
          style={{
            position: "fixed",
            top: ghostPos.y,
            left: ghostPos.x,
            width: ghostPos.width,
            zIndex: 9999,
            pointerEvents: "none",
            opacity: 0.85,
            transform: "rotate(0.5deg) scale(1.01)",
          }}
          className="rounded-md border border-brand-400 bg-white shadow-xl dark:bg-gray-900"
        >
          <TaskRow
            task={activeDrag.task}
            statuses={statuses}
            members={members}
            listId={list.id}
            onView={() => {}}
            onUpdateStatus={() => {}}
            onUpdatePriority={() => {}}
            onUpdateDates={() => {}}
            onAddAssignee={() => {}}
            onRemoveAssignee={() => {}}
            onDelete={() => {}}
          />
        </div>,
        document.body
      )}
    </div>
  );

  if (!showListHeader) return content;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <span className="text-sm font-medium text-gray-800 dark:text-white">{list.name}</span>
      </div>
      {content}
    </div>
  );
}

export default function TaskListView({
  mode,
  projectName,
  projectId,
  sections,
  statuses,
  onCreateList,
  onRenameList,
  onArchiveList,
  onRestoreList,
  onDeleteList,
  onOpenTaskDetail,
  disableAutoFetch = false,
  disableSameStatusReorder = false,
}: TaskListViewProps) {
  const { members, refetch: refetchMembers } = useProjectMembers(projectId);
  const resolvedStatuses = statuses.length > 0 ? statuses : FALLBACK_STATUSES;

  return (
    <div className="space-y-4 pb-4">
      {sections.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-400">No active lists yet.</p>
          {mode === "project" && (
            <button
              type="button"
              onClick={onCreateList}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-normal text-white transition-colors hover:bg-brand-600"
            >
              <LuPlus className="h-4 w-4" />
              Create your first list
            </button>
          )}
        </div>
      )}

      {sections.map((section) => (
        <div key={section.list.id}>
          {section.list.isArchived && (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <LuArchive className="h-4 w-4 shrink-0" />
              <span className="flex-1">This List is archived.</span>
              <button
                type="button"
                onClick={() => onRestoreList?.(section.list)}
                className="font-medium underline hover:no-underline"
              >
                Unarchive
              </button>
            </div>
          )}
          <ListSection
            list={section.list}
            projectId={projectId}
            statuses={resolvedStatuses}
            members={members}
            onOpenTaskDetail={(taskId) => onOpenTaskDetail?.(taskId)}
            onRefetchMembers={refetchMembers}
            showListHeader={mode === "project" && sections.length > 1}
            disableAutoFetch={disableAutoFetch}
            disableSameStatusReorder={disableSameStatusReorder}
          />
        </div>
      ))}

      {mode === "project" && (
        <button
          type="button"
          onClick={onCreateList}
          className="inline-flex items-center gap-1.5 px-1 text-sm font-normal text-gray-500 transition-colors hover:text-brand-500"
        >
          <LuPlus className="h-4 w-4" />
          Create List
        </button>
      )}
    </div>
  );
}
