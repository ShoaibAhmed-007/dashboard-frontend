"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MemberOption } from "@/components/projects/AssigneePicker";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LuPlus, LuEllipsis } from "react-icons/lu";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { TaskListItem, TaskPriority, BoardColumn as BoardColumnData, BoardResponse, taskService } from "@/services/task.service";
import { TaskList } from "@/services/task-list.service";
import { queryKeys } from "@/queries/keys";
import { normalizeParams } from "@/stores/task-search.store";
import { useTaskStore } from "@/stores/task.store";
import { useTheme } from "@/context/ThemeContext";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import StatusIcon from "./StatusIcon";
import TaskQuickCreate from "./TaskQuickCreate";
import AssigneePicker from "./AssigneePicker";
import DatePicker from "./DatePicker";
import PriorityPicker from "./PriorityPicker";
import StatusPicker from "./StatusPicker";

const FALLBACK_STATUSES: StatusItem[] = [
  { id: "fallback_todo", projectId: "", name: "TO DO", color: "#94a3b8", group: "NOT_STARTED", position: 1000, isDefault: true, isProtected: true, isClosed: false, createdAt: "", updatedAt: "" },
  { id: "fallback_inprogress", projectId: "", name: "IN PROGRESS", color: "#3b82f6", group: "ACTIVE", position: 2000, isDefault: true, isProtected: false, isClosed: false, createdAt: "", updatedAt: "" },
  { id: "fallback_done", projectId: "", name: "COMPLETE", color: "#2a9764", group: "CLOSED", position: 4000, isDefault: true, isProtected: true, isClosed: true, createdAt: "", updatedAt: "" },
];

const CARD_HEIGHT = 110;

interface DragState {
  task: TaskListItem;
  listId: string;
  fromStatusId: string;
  fromIdx: number;
  startX: number;
  startY: number;
  cardWidth: number;
  cardOffsetX: number; // cursor offset within the card
  cardOffsetY: number;
}

// ── Ghost card that follows the cursor ──────────────────────────────────────
function GhostCard({
  task,
  x,
  y,
  width,
}: {
  task: TaskListItem;
  x: number;
  y: number;
  width: number;
}) {
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: y,
        left: x,
        width,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: 0.75,
        transform: "rotate(1.5deg) scale(1.02)",
      }}
      className="rounded-xl border border-brand-400 bg-white p-3 shadow-2xl dark:bg-gray-900 select-none"
    >
      <div className="mb-2.5 flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          <StatusIcon
            group={task.status.group}
            color={task.status.group === "CLOSED" ? "#2a9764" : task.status.color}
            size={15}
          />
        </span>
        <span className={`flex-1 min-w-0 text-left text-sm font-normal leading-5 line-clamp-2 wrap-break-word ${task.isCompleted ? "text-gray-400 line-through" : "text-gray-800 dark:text-white"}`}>
          {task.title.split(/(\s+)/).map((part) => (part.length > 15 && !/^\s+$/.test(part) ? part.slice(0, 15) + "..." : part)).join("")}
        </span>
      </div>
      {task.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((t) => (
            <span
              key={t.tag.id}
              className="rounded px-1.5 py-0.5 text-[9px]"
              style={{ backgroundColor: `${t.tag.color}22`, color: t.tag.color }}
            >
              {t.tag.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-1">
        {task.assignees.slice(0, 3).map((a) => (
          <span
            key={a.user.id}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-medium text-white"
            style={{ backgroundColor: "#6366f1" }}
          >
            {a.user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </span>
        ))}
      </div>
    </div>,
    document.body
  );
}

function CardContent({
  task,
  statuses,
  members,
  listId,
  ghost,
  onRefetchMembers,
}: {
  task: TaskListItem;
  statuses: StatusItem[];
  members: MemberOption[];
  listId: string;
  ghost?: boolean;
  onRefetchMembers?: () => void;
}) {
  const { updateTask, addAssignee, removeAssignee } = useTaskStore();

  const handleUpdateStatus = async (statusId: string) => {
    try { await updateTask(task.id, listId, { statusId }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };
  const handleUpdatePriority = async (priority: TaskPriority) => {
    try { await updateTask(task.id, listId, { priority }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };
  const handleUpdateDates = async (startDate: string | null, dueDate: string | null) => {
    try { await updateTask(task.id, listId, { startDate, dueDate }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };
  const handleAddAssignee = async (userId: string) => {
    try { await addAssignee(task.id, listId, [userId]); }
    catch (err) { toast.error(parseApiError(err).message); }
  };
  const handleRemoveAssignee = async (userId: string) => {
    try { await removeAssignee(task.id, listId, userId); }
    catch (err) { toast.error(parseApiError(err).message); }
  };

  return (
    <>
      <div className="mb-2.5 flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          <StatusIcon
            group={task.status.group}
            color={task.status.group === "CLOSED" ? "#2a9764" : task.status.color}
            size={15}
          />
        </span>
        <span className={`flex-1 min-w-0 text-left text-sm font-normal leading-5 line-clamp-2 wrap-break-word ${task.isCompleted ? "text-gray-400 line-through" : "text-gray-800 dark:text-white"}`}>
          {task.title.split(/(\s+)/).map((part) => (part.length > 15 && !/^\s+$/.test(part) ? part.slice(0, 15) + "..." : part)).join("")}
        </span>
      </div>
      {task.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((t) => (
            <span
              key={t.tag.id}
              className="rounded px-1.5 py-0.5 text-[9px]"
              style={{ backgroundColor: `${t.tag.color}22`, color: t.tag.color }}
            >
              {t.tag.name}
            </span>
          ))}
        </div>
      )}
      {!ghost && (
        <div className="flex items-center gap-1.5 flex-wrap" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <AssigneePicker assignees={task.assignees} members={members} onAdd={handleAddAssignee} onRemove={handleRemoveAssignee} onOpen={onRefetchMembers} iconSize="sm" />
          <DatePicker startDate={task.startDate} dueDate={task.dueDate} onChange={(r) => handleUpdateDates(r.startDate, r.dueDate)} iconSize="sm" />
          <PriorityPicker value={task.priority} onChange={handleUpdatePriority} onClear={() => handleUpdatePriority("NONE")} iconSize="sm" />
          <div className="ml-auto">
            <StatusPicker statuses={statuses} value={task.status.id} onChange={handleUpdateStatus} align="right" />
          </div>
        </div>
      )}
    </>
  );
}

function BoardCard({
  task,
  statuses,
  members,
  listId,
  isDragging,
  suppressClickRef,
  onOpenDetail,
  onDragStart,
  onRefetchMembers,
}: {
  task: TaskListItem;
  statuses: StatusItem[];
  members: MemberOption[];
  listId: string;
  isDragging: boolean;
  suppressClickRef: React.RefObject<boolean>;
  onOpenDetail: (taskId: string) => void;
  onDragStart: (e: React.PointerEvent, task: TaskListItem, listId: string, cardEl: HTMLDivElement) => void;
  onRefetchMembers?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={cardRef}
      onPointerDown={(e) => {
        // Don't start a drag if a modal/overlay is open above us
        if (document.querySelector("[data-modal]")) return;
        if (cardRef.current) onDragStart(e, task, listId, cardRef.current);
      }}
      onClick={(e) => {
        if (isDragging || suppressClickRef.current) return;
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("input") || target.closest("a")) return;
        onOpenDetail(task.id);
      }}
      style={{ opacity: isDragging ? 0 : 1 }}
      className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 select-none transition-opacity cursor-pointer"
    >
      <CardContent task={task} statuses={statuses} members={members} listId={listId} onRefetchMembers={onRefetchMembers} />
    </div>
  );
}

function BoardColumn({
  status,
  statuses,
  list,
  projectId,
  members,
  dragState,
  dragOverStatusId,
  dropIdx,
  suppressClickRef,
  onOpenDetail,
  onDragStart,
  onRefetchMembers,
  disableAutoFetch,
  overrideTasks,
  defaultListId,
  initialLoading,
}: {
  status: StatusItem;
  statuses: StatusItem[];
  list: TaskList;
  projectId: string;
  members: MemberOption[];
  dragState: DragState | null;
  dragOverStatusId: string | null;
  dropIdx: number | null;
  suppressClickRef: React.RefObject<boolean>;
  onOpenDetail: (taskId: string) => void;
  onDragStart: (e: React.PointerEvent, task: TaskListItem, listId: string, cardEl: HTMLDivElement) => void;
  onRefetchMembers?: () => void;
  disableAutoFetch?: boolean;
  overrideTasks?: TaskListItem[];
  defaultListId?: string;
  initialLoading?: boolean;
}) {
  const { tasksByList, loadingLists, fetchTasks, createTask } = useTaskStore();
  const { theme } = useTheme();
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  useEffect(() => {
    if (overrideTasks) return;
    if (!disableAutoFetch && !tasksByList[list.id] && !loadingLists.has(list.id)) {
      void fetchTasks(projectId, list.id);
    }
  }, [overrideTasks, disableAutoFetch, list.id, projectId, fetchTasks, tasksByList, loadingLists]);

  const tasks = useMemo(() => {
    if (overrideTasks) return overrideTasks;
    const all = tasksByList[list.id] ?? [];
    return all.filter((t) => t.status.id === status.id && t.depth === 0);
  }, [overrideTasks, tasksByList, list.id, status.id]);

  const handleQuickCreate = async (payload: {
    title: string;
    assigneeIds: string[];
    startDate: string | null;
    dueDate: string | null;
    priority: TaskPriority;
  }) => {
    try {
      await createTask(projectId, defaultListId ?? list.id, {
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

  const isOver = dragState !== null && dragOverStatusId === status.id;
  const isDraggingFromHere = dragState?.fromStatusId === status.id;
  const isCrossColumnTarget = isOver && !isDraggingFromHere;

  const getCardShift = (task: TaskListItem, idx: number): number => {
    if (!isDraggingFromHere || !dragState) return 0;
    if (task.id === dragState.task.id) return 0;
    const from = dragState.fromIdx;
    const to = dropIdx ?? from;
    const draggedHeight = CARD_HEIGHT + 8;
    if (from < to && idx > from && idx <= to) return -draggedHeight;
    if (from > to && idx < from && idx >= to) return draggedHeight;
    return 0;
  };

  return (
    <div
      data-status-id={status.id}
      style={
        !isCrossColumnTarget
          ? ({
              "--col-color": status.color,
              backgroundColor: theme === "dark"
                ? `color-mix(in srgb, ${status.color} 12%, #111827)`
                : `color-mix(in srgb, ${status.color} 8%, white)`,
              borderColor: theme === "dark"
                ? `color-mix(in srgb, ${status.color} 30%, #374151)`
                : `color-mix(in srgb, ${status.color} 25%, #e4e7ec)`,
            } as React.CSSProperties)
          : undefined
      }
      className={`w-[275px] shrink-0 rounded-xl border p-2.5 transition-colors ${
        isCrossColumnTarget
          ? "border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20"
          : ""
      }`}
    >
      {/* Column header */}
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-normal tracking-wide uppercase text-white"
          style={{ backgroundColor: status.color }}
        >
          <StatusIcon group={status.group} color="#fff" size={17} />
          {status.name}
        </span>
        <span className="text-xs font-normal text-gray-400">{tasks.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className="rounded p-0.5 text-gray-300 hover:text-gray-600 dark:hover:text-gray-300">
            <LuEllipsis className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setQuickCreateOpen(true)}
            className="rounded p-0.5 text-gray-300 hover:text-brand-500"
          >
            <LuPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Task cards */}
      <div className="space-y-2" style={{ userSelect: dragState ? "none" : undefined }}>
        {(loadingLists.has(list.id) || initialLoading) && tasks.length === 0 && (
          <p className="px-2 py-3 text-xs text-gray-400">Loading...</p>
        )}
        {tasks.map((task, idx) => {
          const isDraggingThis = dragState?.task.id === task.id;
          return (
            <div
              key={task.id}
              style={{
                transform: `translateY(${getCardShift(task, idx)}px)`,
                transition: "transform 180ms ease",
                opacity: isDraggingThis ? 0 : 1,
              }}
            >
              <BoardCard
                task={task}
                statuses={statuses}
                members={members}
                listId={list.id}
                isDragging={isDraggingThis}
                suppressClickRef={suppressClickRef}
                onOpenDetail={onOpenDetail}
                onDragStart={onDragStart}
                onRefetchMembers={onRefetchMembers}
              />
            </div>
          );
        })}
        {/* Space that opens in target column when dragging in from another status */}
        <div
          style={{
            height: isCrossColumnTarget ? CARD_HEIGHT : 0,
            transition: "height 180ms ease",
            overflow: "hidden",
          }}
        />
      </div>

      {/* Quick create */}
      {quickCreateOpen ? (
        <div className="mt-2">
          <TaskQuickCreate
            status={status}
            members={members}
            onSave={handleQuickCreate}
            onCancel={() => setQuickCreateOpen(false)}
            variant="board"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setQuickCreateOpen(true)}
          style={{ color: status.color }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = `color-mix(in srgb, ${status.color} 15%, white)`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
          }}
          className="mt-2 inline-flex w-full items-center gap-1.5 rounded-[5px] px-2 py-1.5 text-[14px] font-bold transition-colors"
        >
          <LuPlus className="h-4 w-4" strokeWidth={3} />
          Add Task
        </button>
      )}
    </div>
  );
}

interface TaskBoardProps {
  projectId: string;
  lists: TaskList[];
  statuses: StatusItem[];
  members: MemberOption[];
  onOpenTaskDetail: (taskId: string) => void;
  onRefetchMembers?: () => void;
  disableAutoFetch?: boolean;
  disableSameStatusReorder?: boolean;
  taskSearchParams?: import("@/services/task.service").TaskSearchParams;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  boardInitialLoading?: boolean;
}

export default function TaskBoard({
  projectId,
  lists,
  statuses,
  members,
  onOpenTaskDetail,
  onRefetchMembers,
  disableAutoFetch = false,
  disableSameStatusReorder = false,
  taskSearchParams,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
  boardInitialLoading = false,
}: TaskBoardProps) {
  const resolvedStatuses = statuses.length > 0 ? statuses : FALLBACK_STATUSES;
  const isProjectBoard = lists.length > 1;

  // ── Project board state (multi-list) ──────────────────────────────────────
  // The board lives in the React Query cache (keyed per project + filters) so it
  // is deduped/served across navigation and eligible for cross-refresh
  // persistence, rather than refetching on every mount.
  const queryClient = useQueryClient();
  const boardParams = useMemo(() => normalizeParams(taskSearchParams), [taskSearchParams]);
  const boardKey = useMemo(() => queryKeys.taskBoard(projectId, boardParams), [projectId, boardParams]);

  const boardQuery = useQuery({
    queryKey: boardKey,
    queryFn: () => taskService.getBoard(projectId, boardParams),
    enabled: isProjectBoard,
    // Fresh for 60s so quick tab switches serve straight from cache (no refetch);
    // after that a remount/refresh shows the cached/persisted board instantly and
    // revalidates in the background (refetchOnMount defaults to true).
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const boardColumns = useMemo<BoardColumnData[]>(() => boardQuery.data?.columns ?? [], [boardQuery.data]);
  const boardLoading = boardQuery.isLoading;

  // Mirror of the cached columns for synchronous reads inside pointer handlers.
  const boardColumnsRef = useRef<BoardColumnData[]>([]);
  useEffect(() => { boardColumnsRef.current = boardColumns; }, [boardColumns]);

  // Write-through optimistic update: patch the cached board columns in place.
  const setBoardColumns = useCallback(
    (updater: BoardColumnData[] | ((prev: BoardColumnData[]) => BoardColumnData[])) => {
      queryClient.setQueryData<BoardResponse>(boardKey, (prev) => {
        if (!prev) return prev;
        const nextColumns = typeof updater === "function"
          ? (updater as (p: BoardColumnData[]) => BoardColumnData[])(prev.columns)
          : updater;
        boardColumnsRef.current = nextColumns;
        return { ...prev, columns: nextColumns };
      });
    },
    [queryClient, boardKey]
  );

  const refetchBoard = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: boardKey });
  }, [queryClient, boardKey]);

  // ── Single-list board state ────────────────────────────────────────────────
  const { tasksByList, updateTask, reorderTasks, fetchTasks } = useTaskStore();

  const dragRef = useRef<DragState | null>(null);
  const pendingRef = useRef<{ state: DragState } | null>(null);
  const suppressClickRef = useRef(false);
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);
  const [dragOverStatusId, setDragOverStatusId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [cursorX, setCursorX] = useState(0);
  const [cursorY, setCursorY] = useState(0);

  const DRAG_THRESHOLD = 5;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (pendingRef.current && !dragRef.current) {
        const { state } = pendingRef.current;
        const dx = Math.abs(e.clientX - state.startX);
        const dy = Math.abs(e.clientY - state.startY);
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          e.preventDefault();
          dragRef.current = state;
          let styleEl = document.getElementById("__drag_cursor__") as HTMLStyleElement | null;
          if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "__drag_cursor__"; document.head.appendChild(styleEl); }
          styleEl.textContent = "*{cursor:grabbing!important}";
          setActiveDrag(state);
          setDragOverStatusId(state.fromStatusId);
          setDropIdx(state.fromIdx);
          setCursorX(state.startX - state.cardOffsetX);
          setCursorY(state.startY - state.cardOffsetY);
          pendingRef.current = null;
        }
        return;
      }

      if (!dragRef.current) return;
      const drag = dragRef.current;
      setCursorX(e.clientX - drag.cardOffsetX);
      setCursorY(e.clientY - drag.cardOffsetY);

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const colEl = el?.closest("[data-status-id]");
      const hoveredStatusId = colEl?.getAttribute("data-status-id") ?? null;
      if (hoveredStatusId) {
        setDragOverStatusId((prev) => {
          if (prev !== hoveredStatusId) {
            if (hoveredStatusId !== drag.fromStatusId) setDropIdx(null);
            return hoveredStatusId;
          }
          return prev;
        });
      }

      setDropIdx((currentDrop) => {
        const activeStatusId = hoveredStatusId ?? dragOverStatusIdRef.current;
        if (activeStatusId === drag.fromStatusId) {
          const dy = e.clientY - drag.startY;
          let columnTasks: TaskListItem[];
          if (isProjectBoard) {
            const col = boardColumnsRef.current.find((c) => c.status.id === drag.fromStatusId);
            columnTasks = col?.tasks ?? [];
          } else {
            columnTasks = (useTaskStore.getState().tasksByList[drag.listId] ?? []).filter(
              (t) => t.status.id === drag.fromStatusId && t.depth === 0
            );
          }
          const slot = Math.round(drag.fromIdx + dy / CARD_HEIGHT);
          return Math.max(0, Math.min(columnTasks.length - 1, slot));
        }
        return currentDrop;
      });
    };

    const onUp = () => {
      if (pendingRef.current) {
        pendingRef.current = null;
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;

      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 80);

      const targetStatusId = dragOverStatusIdRef.current ?? drag.fromStatusId;
      const from = drag.fromIdx;
      const to = dropIdxRef.current ?? from;

      dragRef.current = null;
      const styleEl = document.getElementById("__drag_cursor__");
      if (styleEl) styleEl.textContent = "";
      setActiveDrag(null);
      setDragOverStatusId(null);
      setDropIdx(null);

      const isSameStatus = targetStatusId === drag.fromStatusId;
      if (isSameStatus && from === to) return;

      // ── Project board: use board reorder API ──────────────────────────────
      if (isProjectBoard) {
        const cols = boardColumnsRef.current;
        const targetCol = cols.find((c) => c.status.id === targetStatusId);
        if (!targetCol) return;

        // Build optimistic column order
        const sourceCol = cols.find((c) => c.status.id === drag.fromStatusId);
        const destTasks = [...(targetCol.tasks)];

        if (isSameStatus) {
          const [moved] = destTasks.splice(from, 1);
          destTasks.splice(to, 0, moved);
        } else {
          const draggedTask = sourceCol?.tasks[from] ?? drag.task;
          destTasks.splice(to ?? destTasks.length, 0, draggedTask);
        }

        // Optimistic update
        setBoardColumns((prev) => prev.map((col) => {
          if (col.status.id === targetStatusId) return { ...col, tasks: destTasks };
          if (!isSameStatus && col.status.id === drag.fromStatusId) {
            return { ...col, tasks: col.tasks.filter((t) => t.id !== drag.task.id) };
          }
          return col;
        }));

        taskService.boardReorder(projectId, {
          mode: "manual",
          taskId: drag.task.id,
          toStatusId: targetStatusId,
          orderedTaskIds: destTasks.map((t) => t.id),
        }).then((data) => {
          queryClient.setQueryData<BoardResponse>(boardKey, data);
          boardColumnsRef.current = data.columns;
        }).catch((err) => {
          toast.error(parseApiError(err).message);
          refetchBoard();
        });
        return;
      }

      // ── Single-list board: existing behavior ──────────────────────────────
      if (!isSameStatus) {
        updateTask(drag.task.id, drag.listId, { statusId: targetStatusId }).catch((err) => {
          toast.error(parseApiError(err).message);
          if (!disableAutoFetch) void fetchTasks(projectId, drag.listId);
        });
      } else {
        if (disableSameStatusReorder) return;
        const allListTasks = useTaskStore.getState().tasksByList[drag.listId] ?? [];
        const columnTasks = allListTasks.filter((t) => t.status.id === drag.fromStatusId && t.depth === 0);
        const reordered = [...columnTasks];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);

        const others = allListTasks.filter((t) => !(t.status.id === drag.fromStatusId && t.depth === 0));
        useTaskStore.setState((s) => ({
          tasksByList: { ...s.tasksByList, [drag.listId]: [...others, ...reordered] },
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
        const finalInsert = insertAt < 0 ? withGap.length : insertAt;
        withGap.splice(finalInsert, 0, ...reordered);
        reorderTasks(projectId, drag.listId, withGap.map((t) => t.id)).catch((err) => {
          toast.error(parseApiError(err).message);
          if (!disableAutoFetch) void fetchTasks(projectId, drag.listId);
        });
      }
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isProjectBoard, disableAutoFetch, disableSameStatusReorder, projectId, updateTask, reorderTasks, fetchTasks, refetchBoard, setBoardColumns, queryClient, boardKey]);

  const dragOverStatusIdRef = useRef<string | null>(null);
  const dropIdxRef = useRef<number | null>(null);
  useEffect(() => { dragOverStatusIdRef.current = dragOverStatusId; }, [dragOverStatusId]);
  useEffect(() => { dropIdxRef.current = dropIdx; }, [dropIdx]);

  const handleDragStart = useCallback((
    e: React.PointerEvent,
    task: TaskListItem,
    listId: string,
    cardEl: HTMLDivElement
  ) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) return;

    const rect = cardEl.getBoundingClientRect();
    let fromIdx: number;
    if (isProjectBoard) {
      const col = boardColumnsRef.current.find((c) => c.status.id === task.status.id);
      fromIdx = col?.tasks.findIndex((t) => t.id === task.id) ?? 0;
    } else {
      fromIdx = (tasksByList[listId] ?? [])
        .filter((t) => t.status.id === task.status.id && t.depth === 0)
        .findIndex((t) => t.id === task.id);
    }

    pendingRef.current = {
      state: {
        task,
        listId,
        fromStatusId: task.status.id,
        fromIdx,
        startX: e.clientX,
        startY: e.clientY,
        cardWidth: rect.width,
        cardOffsetX: e.clientX - rect.left,
        cardOffsetY: e.clientY - rect.top,
      },
    };
  }, [isProjectBoard, tasksByList]);

  // ── Infinite scroll: prefetch the next page of a single-list board well
  // before the sentinel is actually on-screen, so scrolling never stalls. ──
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isProjectBoard) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !hasNextPage || isFetchingNextPage) return;
        fetchNextPage?.();
      },
      { rootMargin: "0px 0px 600px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isProjectBoard, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const defaultListId = lists[0]?.id ?? "";

  if (isProjectBoard) {
    const activeCols = boardColumns.length > 0
      ? boardColumns
      : resolvedStatuses.map((s) => ({ status: s, tasks: [], total: 0 }));

    return (
      <div
        className="overflow-x-scroll pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        style={{ userSelect: activeDrag ? "none" : undefined }}
      >
        {boardLoading && boardColumns.length === 0 && (
          <p className="px-4 py-8 text-sm text-gray-400">Loading board...</p>
        )}
        <div className="flex min-w-[860px] gap-3 items-start">
          {activeCols.map((col) => (
            <BoardColumn
              key={col.status.id}
              status={col.status as StatusItem}
              statuses={resolvedStatuses}
              list={lists[0]}
              projectId={projectId}
              members={members}
              dragState={activeDrag}
              dragOverStatusId={dragOverStatusId}
              dropIdx={dropIdx}
              suppressClickRef={suppressClickRef}
              onOpenDetail={onOpenTaskDetail}
              onDragStart={handleDragStart}
              onRefetchMembers={onRefetchMembers}
              disableAutoFetch
              overrideTasks={col.tasks}
              defaultListId={defaultListId}
            />
          ))}
        </div>
        {activeDrag && (
          <GhostCard task={activeDrag.task} x={cursorX} y={cursorY} width={activeDrag.cardWidth} />
        )}
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      style={{ userSelect: activeDrag ? "none" : undefined }}
    >
      <div className="flex min-w-[860px] gap-3 items-start">
        {lists.map((list) =>
          resolvedStatuses.map((status) => (
            <BoardColumn
              key={`${list.id}-${status.id}`}
              status={status}
              statuses={resolvedStatuses}
              list={list}
              projectId={projectId}
              members={members}
              dragState={activeDrag}
              dragOverStatusId={dragOverStatusId}
              dropIdx={dropIdx}
              suppressClickRef={suppressClickRef}
              onOpenDetail={onOpenTaskDetail}
              onDragStart={handleDragStart}
              onRefetchMembers={onRefetchMembers}
              disableAutoFetch={disableAutoFetch}
              initialLoading={boardInitialLoading}
            />
          ))
        )}

        <div className="w-40 shrink-0 pt-1 text-gray-400">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-base font-normal hover:text-gray-600 dark:hover:text-gray-300"
          >
            <LuPlus className="h-4 w-4" />
            Add group
          </button>
        </div>
      </div>

      {/* Sentinel for infinite-scroll prefetch — observed well before it's on-screen */}
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden />

      {/* Floating ghost card */}
      {activeDrag && (
        <GhostCard
          task={activeDrag.task}
          x={cursorX}
          y={cursorY}
          width={activeDrag.cardWidth}
        />
      )}
    </div>
  );
}
