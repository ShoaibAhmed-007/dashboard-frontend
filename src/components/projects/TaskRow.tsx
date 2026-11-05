"use client";

import { useEffect, useRef, useState } from "react";
import type { MemberOption } from "@/components/projects/AssigneePicker";
import { createPortal } from "react-dom";
import {
  LuChevronRight,
  LuEllipsis,
  LuGripVertical,
  LuPencil,
  LuPlus,
  LuTrash2,
  LuLoader,
  LuStar,
} from "react-icons/lu";
import { TaskListItem, TaskPriority, CreateSubtaskPayload, TaskAssignee, taskService } from "@/services/task.service";
import { useUiStore } from "@/stores/ui.store";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { useTaskStore } from "@/stores/task.store";
import { parseApiError } from "@/lib/api";
import { todayDueDateIso } from "@/lib/utils";
import { toast } from "sonner";
import StatusIcon from "./StatusIcon";
import PriorityPicker from "./PriorityPicker";
import AssigneePicker from "./AssigneePicker";
import DatePicker from "./DatePicker";
import StatusPicker from "./StatusPicker";
import TagPicker from "./TagPicker";
import { canHaveSubtasks } from "@/lib/taskHierarchy";

const COL = "minmax(0,1fr) 72px 110px 110px 80px 100px 32px";

interface TaskRowProps {
  task: TaskListItem;
  statuses: StatusItem[];
  members: MemberOption[];
  listId: string;
  onView: (taskId: string) => void;
  onUpdateStatus: (statusId: string) => void;
  onUpdatePriority: (priority: TaskPriority) => void;
  onUpdateDates: (startDate: string | null, dueDate: string | null) => void;
  onAddAssignee: (userId: string) => void;
  onRemoveAssignee: (userId: string) => void;
  onDelete: () => void;
  onRefetchMembers?: () => void;
  dragHandleProps?: Record<string, unknown>;
  indent?: number;
  parentId?: string;
}

function SubtaskQuickCreate({
  parentId,
  listId,
  statuses,
  members,
  onClose,
}: {
  parentId: string;
  listId: string;
  statuses: StatusItem[];
  members: MemberOption[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(todayDueDateIso());
  const [priority, setPriority] = useState<TaskPriority>("NONE");
  const { createSubtask } = useTaskStore();

  const handleAddAssignee = (userId: string) => {
    const member = members.find((m) => m.id === userId);
    if (!member || assigneeIds.includes(userId)) return;
    setAssigneeIds((prev) => [...prev, userId]);
    setAssignees((prev) => [
      ...prev,
      { user: { id: member.id, fullName: member.fullName, avatarUrl: null, avatarColor: "#6366f1" }, assignedBy: "" },
    ]);
  };

  const handleRemoveAssignee = (userId: string) => {
    setAssigneeIds((prev) => prev.filter((id) => id !== userId));
    setAssignees((prev) => prev.filter((a) => a.user.id !== userId));
  };

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    const defaultStatus = statuses[0];
    if (!defaultStatus) return;
    setSaving(true);
    try {
      const payload: CreateSubtaskPayload = {
        title: trimmed,
        statusId: defaultStatus.id,
        startDate,
        dueDate,
        priority,
      };
      await createSubtask(parentId, listId, payload);
      setTitle("");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const defaultStatus = statuses[0];

  return (
    <div className="flex items-center gap-2 border-t border-brand-100 bg-brand-50/30 py-1.5 pr-4 dark:border-brand-900/30 dark:bg-brand-950/10" style={{ paddingLeft: "3.5rem" }}>
      {defaultStatus && (
        <div className="flex w-6 shrink-0 items-center justify-center">
          <StatusIcon group={defaultStatus.group} color={defaultStatus.color} size={13} />
        </div>
      )}
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); void handleSave(); }
          if (e.key === "Escape") onClose();
        }}
        placeholder="Task Name or type '/' for commands"
        className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-300 dark:text-gray-200 dark:placeholder:text-gray-600"
      />
      <div className="flex shrink-0 items-center gap-1.5 border-l border-gray-200 pl-3 dark:border-gray-700">
        <div className="rounded-md border border-gray-200 dark:border-gray-700">
          <AssigneePicker assignees={assignees} members={members} onAdd={handleAddAssignee} onRemove={handleRemoveAssignee} iconSize="sm" />
        </div>
        <div className="rounded-md border border-gray-200 dark:border-gray-700">
          <DatePicker startDate={startDate} dueDate={dueDate} onChange={(range) => { setStartDate(range.startDate); setDueDate(range.dueDate); }} iconSize="sm" />
        </div>
        <div className="rounded-md border border-gray-200 dark:border-gray-700">
          <PriorityPicker value={priority} onChange={setPriority} onClear={() => setPriority("NONE")} iconSize="sm" />
        </div>
      </div>
      <button type="button" onClick={onClose} className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!title.trim() || saving}
        className="shrink-0 rounded-lg bg-brand-500 px-2.5 py-1 text-xs text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {saving ? "..." : "Save ↵"}
      </button>
    </div>
  );
}

export default function TaskRow({
  task,
  statuses,
  members,
  listId,
  onView,
  onUpdateStatus,
  onUpdatePriority,
  onUpdateDates,
  onAddAssignee,
  onRemoveAssignee,
  onDelete,
  onRefetchMembers,
  dragHandleProps,
  indent = 0,
  parentId,
}: TaskRowProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const taskFavoriteOverrides = useUiStore((s) => s.taskFavoriteOverrides);
  const [isFavorite, setIsFavorite] = useState(
    task.id in taskFavoriteOverrides ? taskFavoriteOverrides[task.id] : (task.isFavorite ?? false)
  );
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const suppressNextClick = useRef(false);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        suppressNextClick.current = true;
        setTimeout(() => { suppressNextClick.current = false; }, 300);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const {
    expandedTasks,
    toggleExpand,
    subtasksByParent,
    loadingSubtasks,
    updateTask,
    updateSubtask,
    deleteSubtask,
    addAssignee,
    removeAssignee,
    addTag,
    removeTag,
  } = useTaskStore();

  const commitTitleEdit = async () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === task.title) { setTitleDraft(task.title); return; }
    try {
      if (parentId) {
        await updateSubtask(task.id, parentId, listId, { title: trimmed });
      } else {
        await updateTask(task.id, listId, { title: trimmed });
      }
    } catch (err) { toast.error(parseApiError(err).message); setTitleDraft(task.title); }
  };

  const isExpanded = expandedTasks.has(task.id);
  const subtasks = subtasksByParent[task.id] ?? [];
  const isLoadingSubtasks = loadingSubtasks.has(task.id);
  const hasChildren = task._count.children > 0;

  useEffect(() => {
    if (task.id in taskFavoriteOverrides) {
      setIsFavorite(taskFavoriteOverrides[task.id]);
    }
  }, [taskFavoriteOverrides, task.id]);

  const handleToggleFavorite = async () => {
    try {
      if (isFavorite) {
        await taskService.unfavorite(task.id);
        setIsFavorite(false);
        useUiStore.getState().setTaskFavoriteOverride(task.id, false);
      } else {
        await taskService.favorite(task.id);
        setIsFavorite(true);
        useUiStore.getState().setTaskFavoriteOverride(task.id, true);
      }
      useUiStore.getState().invalidateFavorites();
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleMenuOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  const indentPx = indent * 24;

  return (
    <>
      <div
        ref={rowRef}
        className="group relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="grid cursor-pointer items-center gap-2 py-1 pr-4 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/40"
          style={{ gridTemplateColumns: COL }}
          onClick={() => { if (!editingTitle && !suppressNextClick.current) onView(task.id); }}
        >
          {/* Name cell */}
          <div className="flex min-w-0 items-center gap-1 pl-2" style={{ paddingLeft: `${8 + indentPx}px` }}>
            {/* Drag handle */}
            {indent < 2 && (
              <span
                className={`cursor-grab shrink-0 text-gray-300 transition-opacity ${hovered ? "opacity-100" : "opacity-0"}`}
                onClick={(e) => e.stopPropagation()}
                {...dragHandleProps}
              >
                <LuGripVertical className="h-3.5 w-3.5" />
              </span>
            )}
            {indent > 0 && <span className="w-3.5 shrink-0" />}

            {/* Expand/collapse toggle */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
                className="shrink-0 text-gray-400 hover:text-gray-600"
              >
                {isLoadingSubtasks ? (
                  <LuLoader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LuChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                )}
              </button>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}

            {/* Status icon */}
            <span className="shrink-0">
              <StatusIcon
                group={task.status.group}
                color={task.status.group === "CLOSED" ? "#2a9764" : task.status.color}
                size={15}
              />
            </span>

            {/* Title */}
            {editingTitle ? (
              <input
                ref={titleInputRef}
                autoFocus
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => void commitTitleEdit()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); titleInputRef.current?.blur(); }
                  if (e.key === "Escape") { setTitleDraft(task.title); setEditingTitle(false); }
                }}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none ring-1 ring-brand-400 rounded px-1 dark:text-gray-200"
              />
            ) : (
              <span
                onClick={(e) => { e.stopPropagation(); setEditingTitle(true); setTitleDraft(task.title); }}
                className={`min-w-0 truncate text-left text-sm hover:text-brand-500 cursor-text ${task.isCompleted ? "line-through text-gray-400" : ""}`}
              >
                {task.title}
              </span>
            )}

            {/* Tags */}
            {task.tags.length > 0 && (
              <div className="flex shrink-0 items-center gap-1">
                {task.tags.slice(0, 2).map((t) => (
                  <span
                    key={t.tag.id}
                    className="rounded px-1 py-0.5 text-[9px]"
                    style={{ backgroundColor: `${t.tag.color}22`, color: t.tag.color }}
                  >
                    {t.tag.name}
                  </span>
                ))}
                {task.tags.length > 2 && (
                  <span className="rounded bg-gray-100 px-1 py-0.5 text-[9px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    +{task.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Hover actions */}
          <div className={`flex shrink-0 items-center gap-1 transition-opacity ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            {canHaveSubtasks(indent) && (
              <button
                type="button"
                title="Add subtask"
                onClick={(e) => { e.stopPropagation(); setAddingSubtask(true); if (!isExpanded) toggleExpand(task.id); }}
                className="flex h-5.5 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:border-brand-400 hover:text-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-000 dark:hover:text-gray-000"
              >
                <LuPlus className="h-3 w-3" />
              </button>
            )}
            <TagPicker
              taskId={task.id}
              listId={listId}
              currentTags={task.tags}
              onAdd={(tagId, tagInfo) => addTag(task.id, listId, tagId, tagInfo)}
              onRemove={(tagId) => removeTag(task.id, listId, tagId)}
              variant="compact"
            />
            <button
              type="button"
              title="Open task"
              onClick={(e) => { e.stopPropagation(); onView(task.id); }}
              className="flex h-5.5 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:border-brand-400 hover:text-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-000 dark:hover:text-gray-000"
            >
              <LuPencil className="h-3 w-3" />
            </button>
          </div>

          {/* Assignee */}
          <div>
            <AssigneePicker assignees={task.assignees} members={members} onAdd={onAddAssignee} onRemove={onRemoveAssignee} onOpen={onRefetchMembers} />
          </div>

          {/* Due date */}
          <div>
            <DatePicker
              startDate={task.startDate}
              dueDate={task.dueDate}
              onChange={(range) => onUpdateDates(range.startDate, range.dueDate)}
            />
          </div>

          {/* Priority */}
          <div>
            <PriorityPicker value={task.priority} onChange={onUpdatePriority} onClear={() => onUpdatePriority("NONE")} />
          </div>

          {/* Status */}
          <div>
            <StatusPicker statuses={statuses} value={task.status.id} onChange={onUpdateStatus} align="right" />
          </div>

          {/* Three dots */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleMenuOpen(e); }}
              className={`rounded p-1 text-gray-400 transition-opacity hover:bg-gray-100 hover:text-gray-700 dark:hover:text-gray-000 dark:hover:bg-gray-800 ${hovered || menuOpen ? "opacity-100" : "opacity-0"}`}
            >
              <LuEllipsis className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Subtask rows */}
      {isExpanded && (
        <>
          {isLoadingSubtasks && subtasks.length === 0 && (
            <div className="py-1 pl-20 text-xs text-gray-400">Loading...</div>
          )}
          {subtasks.map((subtask) => (
            <TaskRow
              key={subtask.id}
              task={subtask}
              statuses={statuses}
              members={members}
              listId={listId}
              onView={onView}
              onUpdateStatus={async (statusId) => {
                try { await updateSubtask(subtask.id, task.id, listId, { statusId }); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              onUpdatePriority={async (priority) => {
                try { await updateSubtask(subtask.id, task.id, listId, { priority }); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              onUpdateDates={async (startDate, dueDate) => {
                try { await updateSubtask(subtask.id, task.id, listId, { startDate, dueDate }); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              onAddAssignee={async (userId) => {
                try { await addAssignee(subtask.id, listId, [userId]); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              onRemoveAssignee={async (userId) => {
                try { await removeAssignee(subtask.id, listId, userId); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              onDelete={async () => {
                try { await deleteSubtask(subtask.id, task.id, listId); }
                catch (err) { toast.error(parseApiError(err).message); }
              }}
              indent={indent + 1}
              parentId={task.id}
            />
          ))}

          {canHaveSubtasks(indent) && addingSubtask && (
            <SubtaskQuickCreate
              parentId={task.id}
              listId={listId}
              statuses={statuses}
              members={members}
              onClose={() => setAddingSubtask(false)}
            />
          )}

        </>
      )}

      {/* Fixed dropdown menu */}
      {menuOpen && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            ref={menuRef}
            className="fixed z-50 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button
              type="button"
              onClick={() => { onView(task.id); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <LuPencil className="h-3.5 w-3.5" />
              Open task
            </button>
            {canHaveSubtasks(indent) && (
              <button
                type="button"
                onClick={() => { setAddingSubtask(true); if (!isExpanded) toggleExpand(task.id); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <LuPlus className="h-3.5 w-3.5" />
                Add subtask
              </button>
            )}
            <button
              type="button"
              onClick={() => { void handleToggleFavorite(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <LuStar className="h-3.5 w-3.5" style={isFavorite ? { fill: "currentColor" } : undefined} />
              {isFavorite ? "Unfavorite" : "Favorite"}
            </button>
            <button
              type="button"
              onClick={() => { onDelete(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <LuTrash2 className="h-3.5 w-3.5" />
              Delete task
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
