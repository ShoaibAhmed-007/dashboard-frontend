"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberOption } from "@/components/projects/AssigneePicker";
import { createPortal } from "react-dom";
import { GrFlagFill } from "react-icons/gr";
import {
  LuX,
  LuMinus,
  LuChevronLeft,
  LuChevronRight,
  LuPlus,
  LuArrowUpRight,
  LuStar,
  LuEllipsis,
  LuTag,
  LuCalendarDays,
  LuUserRound,
  LuTimer,
  LuTrash2,
  LuPencil,
  LuSearch,
  LuBell,
  LuFilter,
  LuLink,
  LuCopy,
} from "react-icons/lu";
import { activityService, ActivityItem } from "@/services/activity.service";
import { MdOutlineDonutSmall } from "react-icons/md";
import { RiAiGenerate } from "react-icons/ri";
import { FaArrowTurnUp } from "react-icons/fa6";
import { taskService, TaskDetail, TaskPriority, TaskAssignee, UpdateTaskPayload } from "@/services/task.service";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { useTaskStore } from "@/stores/task.store";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import StatusIcon from "./StatusIcon";
import StatusPicker from "./StatusPicker";
import PriorityPicker from "./PriorityPicker";
import AssigneePicker from "./AssigneePicker";
import DatePicker from "./DatePicker";
import TrackTimePanel from "./TrackTimePanel";
import TaskAttachments from "./TaskAttachments";
import TagPicker from "./TagPicker";
import RichTextEditor from "./RichTextEditor";
import TaskComments from "./TaskComments";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import { canHaveSubtasks } from "@/lib/taskHierarchy";
import { canEditTaskContent } from "@/lib/taskPermissions";
import { useWorkspaceManageAccess } from "@/hooks/useWorkspaceManageAccess";
import { todayDueDateIso } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

interface TaskDetailModalProps {
  task: TaskDetail;
  statuses: StatusItem[];
  listId: string;
  onClose: () => void;
  onMinimize?: () => void;
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const AVATAR_COLORS = [
  "#18181b", "#7c3aed", "#eab308", "#0f172a", "#6d28d9",
  "#ca8a04", "#1e1b4b", "#fbbf24", "#3b0764", "#292524",
];
function avatarBg(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) hash = (hash * 33) ^ id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const SUBTASK_COL = "minmax(0,1fr) 8px 50px 50px 70px 70px 20px";

function SubtaskRow({
  subtask,
  parentId,
  listId,
  statuses,
  members,
  onOpen,
  fetchMembers,
  depth = 0,
}: {
  subtask: TaskDetail["children"][number];
  parentId: string;
  listId: string;
  statuses: StatusItem[];
  members: MemberOption[];
  onOpen: (id: string) => void;
  fetchMembers?: () => void;
  /** 0 for a direct child of the open task; each nested level indents further. */
  depth?: number;
}) {
  const { updateSubtask, deleteSubtask, addAssignee, removeAssignee, fetchSubtasks } = useTaskStore();
  /* A direct child lives in the open task's `children`; a nested one only in
     `subtasksByParent[its parent]`, so look in both. */
  const storeChild = useTaskStore(
    s => s.openTask?.children?.find(c => c.id === subtask.id) ?? s.subtasksByParent[parentId]?.find(c => c.id === subtask.id)
  );
  const nestedSubtasks = useTaskStore(s => s.subtasksByParent[subtask.id]);
  const loadingNested = useTaskStore(s => s.loadingSubtasks.has(subtask.id));
  const [nestedOpen, setNestedOpen] = useState(false);
  const nestedCount = nestedSubtasks?.length ?? storeChild?._count?.children ?? subtask._count?.children ?? 0;
  const hasNested = nestedCount > 0;
  const toggleNested = () => {
    if (!nestedOpen && !nestedSubtasks) void fetchSubtasks(subtask.id);
    setNestedOpen((open) => !open);
  };
  const storeTags = storeChild?.tags;
  const [optimisticTags, setOptimisticTags] = useState<typeof subtask.tags | null>(null);
  const displayTags = optimisticTags ?? storeTags ?? subtask.tags ?? [];
  const liveAssignees = storeChild?.assignees ?? subtask.assignees;
  const liveStartDate = storeChild?.startDate ?? subtask.startDate;
  const liveDueDate = storeChild?.dueDate ?? subtask.dueDate;
  const livePriority = storeChild?.priority ?? subtask.priority;
  const liveStatus = storeChild?.status ?? subtask.status;

  const handleAddTag = async (tagId: string, tagInfo?: { name: string; color: string }) => {
    const base = storeTags ?? subtask.tags ?? [];
    if (tagInfo) setOptimisticTags(base.some(t => t.tag.id === tagId) ? base : [...base, { tag: { id: tagId, name: tagInfo.name, color: tagInfo.color } }]);
    try {
      const updated = await taskService.addTag(subtask.id, tagId);
      setOptimisticTags(updated.tags);
    } catch (err) {
      setOptimisticTags(null);
      throw err;
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    const base = storeTags ?? subtask.tags ?? [];
    setOptimisticTags(base.filter(t => t.tag.id !== tagId));
    try {
      const updated = await taskService.removeTag(subtask.id, tagId);
      setOptimisticTags(updated.tags);
    } catch (err) {
      setOptimisticTags(null);
      throw err;
    }
  };
  const [hovered, setHovered] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subtask.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  const commit = async () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === subtask.title) { setTitleDraft(subtask.title); return; }
    try { await updateSubtask(subtask.id, parentId, listId, { title: trimmed } as UpdateTaskPayload); }
    catch (err) { toast.error(parseApiError(err).message); setTitleDraft(subtask.title); }
  };

  const handleMenuOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  return (
    <div>
      <div
        ref={rowRef}
        className="group relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="grid cursor-pointer items-center gap-2 py-1 pr-4 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/40"
          style={{ gridTemplateColumns: SUBTASK_COL }}
          onClick={() => { if (!editingTitle && !suppressNextClick.current) onOpen(subtask.id); }}
        >
          {/* Name cell */}
          <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: 8 + depth * 20 }}>
            {hasNested ? (
              <button
                type="button"
                aria-label={nestedOpen ? "Hide subtasks" : `Show ${nestedCount} subtask${nestedCount === 1 ? "" : "s"}`}
                aria-expanded={nestedOpen}
                onClick={(e) => { e.stopPropagation(); toggleNested(); }}
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <LuChevronRight className={`h-3.5 w-3.5 transition-transform ${nestedOpen ? "rotate-90" : ""}`} />
              </button>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span className="shrink-0">
              <StatusIcon group={liveStatus.group} color={liveStatus.group === "CLOSED" ? "#2a9764" : liveStatus.color} size={15} />
            </span>
            {editingTitle ? (
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => void commit()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); inputRef.current?.blur(); }
                  if (e.key === "Escape") { setTitleDraft(subtask.title); setEditingTitle(false); }
                }}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm text-gray-700 outline-none ring-1 ring-brand-400 dark:text-gray-200"
              />
            ) : (
              <span
                onClick={(e) => { e.stopPropagation(); setEditingTitle(true); setTitleDraft(subtask.title); }}
                className={`min-w-0 truncate cursor-text hover:text-brand-500 dark:hover:text-gray-000 ${subtask.isCompleted ? "line-through text-gray-400" : ""}`}
              >
                {subtask.title}
              </span>
            )}
            {/* Tags: first tag + +N badge */}
            {displayTags.length > 0 && (
              <div className="flex shrink-0 items-center gap-1">
                <span className="rounded px-1 py-0.5 text-[9px]" style={{ backgroundColor: `${displayTags[0].tag.color}22`, color: displayTags[0].tag.color }}>
                  {displayTags[0].tag.name}
                </span>
                {displayTags.length > 1 && (
                  <span className="rounded bg-gray-100 px-1 py-0.5 text-[9px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    +{displayTags.length - 1}
                  </span>
                )}
              </div>
            )}
            {/* Tag picker + hover open button */}
            <div className={`ml-1 flex shrink-0 items-center gap-1 transition-opacity ${hovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <TagPicker
                taskId={subtask.id}
                listId={listId}
                currentTags={displayTags}
                onAdd={handleAddTag}
                onRemove={handleRemoveTag}
                variant="compact"
                disableFlip
              />
              <button
                type="button"
                title="Open task"
                onClick={(e) => { e.stopPropagation(); onOpen(subtask.id); }}
                className="flex h-5 w-7 shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-400 shadow-sm hover:border-brand-400 hover:text-brand-500 dark:border-gray-000 dark:hover:text-gray-000 dark:bg-gray-900"
              >
                <LuPencil className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Spacer */}
          <div />

          {/* Assignee */}
          <div>
            <AssigneePicker
              assignees={liveAssignees}
              members={members}
              onAdd={async (userId) => { try { await addAssignee(subtask.id, listId, [userId]); } catch (err) { toast.error(parseApiError(err).message); } }}
              onRemove={async (userId) => { try { await removeAssignee(subtask.id, listId, userId); } catch (err) { toast.error(parseApiError(err).message); } }}
              onOpen={fetchMembers}
            />
          </div>

          {/* Due date */}
          <div>
            <DatePicker
              startDate={liveStartDate}
              dueDate={liveDueDate}
              onChange={async (range) => { try { await updateSubtask(subtask.id, parentId, listId, { startDate: range.startDate, dueDate: range.dueDate }); } catch (err) { toast.error(parseApiError(err).message); } }}
            />
          </div>

          {/* Priority */}
          <div>
            <PriorityPicker
              value={livePriority}
              onChange={async (priority) => { try { await updateSubtask(subtask.id, parentId, listId, { priority }); } catch (err) { toast.error(parseApiError(err).message); } }}
              onClear={async () => { try { await updateSubtask(subtask.id, parentId, listId, { priority: "NONE" }); } catch (err) { toast.error(parseApiError(err).message); } }}
            />
          </div>

          {/* Status */}
          <div>
            <StatusPicker
              statuses={statuses}
              value={liveStatus.id}
              onChange={async (statusId) => { try { await updateSubtask(subtask.id, parentId, listId, { statusId }); } catch (err) { toast.error(parseApiError(err).message); } }}
              align="right"
            />
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

        {menuOpen && menuPos && createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
            <div
              ref={menuRef}
              className="fixed z-[70] w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button
                type="button"
                onClick={async () => {
                  setMenuOpen(false);
                  try { await deleteSubtask(subtask.id, parentId, listId); }
                  catch (err) { toast.error(parseApiError(err).message); }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <LuTrash2 className="h-3.5 w-3.5" />
                Delete subtask
              </button>
            </div>
          </>,
          document.body
        )}
      </div>

      {nestedOpen && (
        <div>
          {loadingNested && !nestedSubtasks && (
            <div className="py-1 text-xs text-gray-400" style={{ paddingLeft: 8 + (depth + 1) * 20 + 22 }}>Loading…</div>
          )}
          {(nestedSubtasks ?? []).map((child) => (
            <SubtaskRow
              key={child.id}
              subtask={child}
              parentId={subtask.id}
              listId={listId}
              statuses={statuses}
              members={members}
              onOpen={onOpen}
              fetchMembers={fetchMembers}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubtaskQuickAdd({
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
  const { createSubtask } = useTaskStore();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(todayDueDateIso());
  const [priority, setPriority] = useState<TaskPriority>("NONE");

  const handleAddAssignee = (userId: string) => {
    const member = members.find((m) => m.id === userId);
    if (!member || assigneeIds.includes(userId)) return;
    setAssigneeIds((prev) => [...prev, userId]);
    setAssignees((prev) => [...prev, { user: { id: member.id, fullName: member.fullName, avatarUrl: null, avatarColor: "#6366f1" }, assignedBy: "" }]);
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
      await createSubtask(parentId, listId, { title: trimmed, statusId: defaultStatus.id, startDate, dueDate, priority });
      setTitle("");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const defaultStatus = statuses[0];

  return (
    <div className="flex items-center gap-2 border-t border-gray-800 bg-brand-50/30 py-1.5 pr-4 dark:border-brand-900/30 dark:bg-gray-907" style={{ paddingLeft: "0.5rem" }}>
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
      <button type="button" onClick={() => void handleSave()} disabled={!title.trim() || saving} className="shrink-0 rounded-lg bg-brand-500 px-2.5 py-1 text-xs text-white hover:bg-brand-600 dark:bg-gray-800 dark:hover:bg-gray-000 dark:hover:text-black disabled:opacity-50">
        {saving ? "..." : "Save ↵"}
      </button>
    </div>
  );
}


function ActivityFeed({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const page = await activityService.getTaskActivity(taskId, { cursor, limit: 25 });
      setItems((prev) => cursor ? [...prev, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch {
      // silently fail — activity is non-critical
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    setItems([]);
    setNextCursor(undefined);
    void load();
  }, [load]);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && nextCursor && !loading) void load(nextCursor);
      },
      { root: containerRef.current, threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loading, load]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
      <div className="space-y-4">
        {[...items].reverse().map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
        {loading && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-gray-400">Loading...</span>
          </div>
        )}
        {!loading && items.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">No activity yet.</p>
        )}
        <div ref={bottomRef} className="h-px" />
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const bg = avatarBg(item.actor.id);
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
        style={{ backgroundColor: bg }}
      >
        {getInitials(item.actor.fullName)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
          {item.category === "description"
            ? `${item.actor.fullName} updated description`
            : item.displayText}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-400">{formatDate(item.createdAt)}</p>
      </div>
    </div>
  );
}

export default function TaskDetailModal({ task, statuses, listId, onClose, onMinimize }: TaskDetailModalProps) {
  /* Also feeds TaskComments' @-mentions, so scoping here scopes both. */
  const { members, refetch: fetchMembers } = useProjectMembers(task.list.project.id);
  const { updateTask, addAssignee, removeAssignee, addTag, removeTag, openTaskDetail, refreshOpenTask, deleteTask } = useTaskStore();
  const liveChildren = useTaskStore(s => s.openTask?.id === task.id ? s.openTask.children : task.children);
  const currentUser = useAuthStore(s => s.user);
  const { role: workspaceRole } = useWorkspaceManageAccess();
  // Title and description: the creator and workspace owner/manager only (the
  // API enforces the same). Status, dates, assignees etc. stay open to all.
  const canEditContent = canEditTaskContent(task, currentUser?.id, workspaceRole);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [rightTab, setRightTab] = useState<"comments" | "activity">("comments");
  const [parentTask, setParentTask] = useState<{ id: string; title: string; taskId: string } | null>(null);
  const [attachmentRefreshKey, setAttachmentRefreshKey] = useState(0);
  const taskFavoriteOverrides = useUiStore((s) => s.taskFavoriteOverrides);
  const [isFavorite, setIsFavorite] = useState(
    task.id in taskFavoriteOverrides ? taskFavoriteOverrides[task.id] : (task.isFavorite ?? false)
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const ellipsisBtnRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (task.id in taskFavoriteOverrides) {
      setIsFavorite(taskFavoriteOverrides[task.id]);
    }
  }, [taskFavoriteOverrides, task.id]);

  useEffect(() => {
    let cancelled = false;
    const fetch = task.parentId
      ? taskService.get(task.parentId)
          .then((p) => { if (!cancelled) setParentTask({ id: p.id, title: p.title, taskId: p.taskId }); })
          .catch(() => { if (!cancelled) setParentTask(null); })
      : Promise.resolve().then(() => { if (!cancelled) setParentTask(null); });
    void fetch;
    return () => { cancelled = true; };
  }, [task.parentId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          ellipsisBtnRef.current && !ellipsisBtnRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/projects?projectId=${task.list.project.id}&taskId=${task.id}`;
    void navigator.clipboard.writeText(url);
    toast.success("Link copied");
    setMenuOpen(false);
  };

  const handleCopyId = () => {
    void navigator.clipboard.writeText(task.taskId);
    toast.success("Task ID copied");
    setMenuOpen(false);
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    try {
      await deleteTask(task.id, listId);
      onClose();
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

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

  const saveTitle = useCallback((val: string) => {
    if (titleSaveTimeout.current) clearTimeout(titleSaveTimeout.current);
    titleSaveTimeout.current = setTimeout(async () => {
      const trimmed = val.trim();
      if (!trimmed || trimmed === task.title) return;
      try { await updateTask(task.id, listId, { title: trimmed }); }
      catch (err) { toast.error(parseApiError(err).message); }
    }, 800);
  }, [task.id, task.title, listId, updateTask]);

  const saveDescription = useCallback(async (val: string) => {
    try { await updateTask(task.id, listId, { description: val || null }); }
    catch (err) { toast.error(parseApiError(err).message); }
  }, [task.id, listId, updateTask]);

  const handleStatusChange = async (statusId: string) => {
    try { await updateTask(task.id, listId, { statusId }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };

  const handlePriorityChange = async (priority: TaskPriority) => {
    try { await updateTask(task.id, listId, { priority }); }
    catch (err) { toast.error(parseApiError(err).message); }
  };

  const handleDatesChange = async (startDate: string | null, dueDate: string | null) => {
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

  const listName = task.list.name;
  const projectName = task.list.project.name;

  return (
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center" style={{ padding: "15px" }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900" style={{ maxHeight: "calc(100vh - 20px)" }}>

        {/* ── Top bar ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-901">
          {/* Left: nav + breadcrumb */}
          <div className="flex items-center gap-2">
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <LuChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <LuChevronRight className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <span>{projectName}</span>
              <span className="text-gray-300">/</span>
              <span>{listName}</span>
              {parentTask && (
                <>
                  <span className="text-gray-300">/</span>
                  <button
                    type="button"
                    onClick={() => void openTaskDetail(parentTask.id)}
                    className="max-w-[160px] truncate hover:text-brand-500 hover:underline"
                    title={parentTask.title}
                  >
                    {parentTask.title}
                  </button>
                </>
              )}
            </div>
            <button type="button" className="rounded border border-gray-200 p-0.5 text-gray-400 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800">
              <LuPlus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Created {formatDate(task.createdAt)}</span>
            <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
            <button type="button" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">
              <RiAiGenerate className="mr-1 inline h-3.5 w-3.5" />
              Ask AI
            </button>
            <button type="button" className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800">
              Share
            </button>
            <div className="relative">
              <button
                ref={ellipsisBtnRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
              >
                <LuEllipsis className="h-3.5 w-3.5" />
              </button>

              {menuOpen && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
                >
                  {/* Copy actions */}
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <LuLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      Copy link
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <LuCopy className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      Copy ID
                      <span className="ml-auto font-mono text-xs text-gray-400">{task.taskId}</span>
                    </button>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800" />

                  {/* Favorite */}
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => { void handleToggleFavorite(); setMenuOpen(false); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <LuStar className="h-3.5 w-3.5 shrink-0 text-gray-400" style={isFavorite ? { fill: "currentColor" } : undefined} />
                      {isFavorite ? "Unfavorite" : "Favorite"}
                    </button>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800" />

                  {/* Delete */}
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <LuTrash2 className="h-3.5 w-3.5 shrink-0" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleToggleFavorite()}
              title={isFavorite ? "Unfavorite" : "Favorite"}
              className={`rounded-lg border p-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${isFavorite ? "border-amber-300 text-amber-400 dark:border-amber-600" : "border-gray-200 text-gray-400 dark:border-gray-800"}`}
            >
              <LuStar className="h-3.5 w-3.5" style={isFavorite ? { fill: "currentColor" } : undefined} />
            </button>
            <button type="button" className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800">
              <LuArrowUpRight className="h-3.5 w-3.5" />
            </button>
            {onMinimize && (
              <button
                type="button"
                onClick={onMinimize}
                title="Minimize"
                className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
              >
                <LuMinus className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
            >
              <LuX className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">

          {/* ── Left: main content ── */}
          <div className="flex flex-1 flex-col overflow-y-auto dark:bg-gray-901 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
            <div className="mx-auto w-full max-w-4xl px-8 py-6">

              {/* Parent task pill */}
              {parentTask && (
                <button
                  type="button"
                  onClick={() => void openTaskDetail(parentTask.id)}
                  className="mb-3 inline-flex items-center gap-1.5 border-gray-200 px-2 py-0.5 text-sm font-semibold text-gray-500 hover:border-brand-400 hover:text-brand-500 dark:border-gray-700 dark:text-gray-400 dark:hover:border-brand-500 dark:hover:text-brand-400"
                  title={`Open parent: ${parentTask.title}`}
                >
                  <FaArrowTurnUp className="h-3 w-3 shrink-0 -scale-x-100" />
                  <span className="max-w-[200px] truncate">{parentTask.title}</span>
                </button>
              )}

              {/* Task type + ID */}
              <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
                <span className="rounded border border-gray-200 px-2 py-0.5 text-gray-500 dark:border-gray-700">Task ▾</span>
                <span className="font-mono">{task.taskId}</span>
                <button type="button" className="ml-1 rounded border border-gray-200 px-2 py-0.5 text-[11px] hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                  <RiAiGenerate className="mr-0.5 inline h-3 w-3" />
                  Ask AI
                </button>
              </div>

              {/* Title */}
              <h1
                ref={titleRef}
                contentEditable={canEditContent}
                suppressContentEditableWarning
                title={canEditContent ? undefined : "Only the creator or a workspace owner/manager can edit the title"}
                onInput={(e) => {
                  const val = e.currentTarget.textContent ?? "";
                  setTitle(val);
                  saveTitle(val);
                }}
                className="mb-4 text-2xl font-bold text-gray-900 outline-none dark:text-white"
                style={{ wordBreak: "break-word" }}
              >
                {task.title}
              </h1>

              {/* Ask Brain banner */}
              <button
                type="button"
                className="mb-6 flex w-full items-center gap-3 rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50 to-pink-50 px-4 py-3 text-left hover:from-rose-100 hover:to-pink-100 dark:border-rose-900/30 dark:from-rose-950/20 dark:to-pink-950/20"
              >
                <RiAiGenerate className="h-4 w-4 shrink-0 text-rose-400" />
                <span className="text-sm text-rose-400">Ask Brain to write a description, generate subtasks or find similar tasks</span>
              </button>

              {/* Fields — row layout */}
              <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-0 divide-y-0">
                {/* Status */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <MdOutlineDonutSmall className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Status
                  </div>
                  <StatusPicker statuses={statuses} value={task.status.id} onChange={handleStatusChange} />
                </div>

                {/* Assignees */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <LuUserRound className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Assignees
                  </div>
                  <AssigneePicker assignees={task.assignees} members={members} onAdd={handleAddAssignee} onRemove={handleRemoveAssignee} showLabel onOpen={fetchMembers} />
                </div>

                {/* Dates */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <LuCalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Dates
                  </div>
                  <DatePicker startDate={task.startDate} dueDate={task.dueDate} onChange={(range) => handleDatesChange(range.startDate, range.dueDate)} showLabel />
                </div>

                {/* Priority */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <GrFlagFill className="h-3 w-3 shrink-0 text-gray-400" />
                    Priority
                  </div>
                  <PriorityPicker value={task.priority} onChange={handlePriorityChange} onClear={() => handlePriorityChange("NONE")} showLabel />
                </div>

                {/* Tags */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <LuTag className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Tags
                  </div>
                  <TagPicker
                    taskId={task.id}
                    listId={listId}
                    currentTags={task.tags}
                    onAdd={(tagId, tagInfo) => addTag(task.id, listId, tagId, tagInfo)}
                    onRemove={(tagId) => removeTag(task.id, listId, tagId)}
                    variant="expanded"
                  />
                </div>

                {/* Track Time */}
                <div className="flex items-center border-b border-gray-100 py-2 dark:border-gray-800">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-500">
                    <LuTimer className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    Track Time
                  </div>
                  <TrackTimePanel
                    taskId={task.id}
                    totalTimeLogged={task.totalTimeLogged}
                    userName={currentUser?.fullName ?? "Me"}
                    userId={currentUser?.id ?? task.creator.id}
                    onUpdate={() => void refreshOpenTask()}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <RichTextEditor
                  value={description}
                  onChange={(html) => { setDescription(html); saveDescription(html); }}
                  editable={canEditContent}
                  placeholder={canEditContent ? "Add description..." : "No description"}
                  taskId={task.id}
                  userId={currentUser?.id ?? task.creator.id}
                  onAttachmentAdded={() => setAttachmentRefreshKey((k) => k + 1)}
                />
              </div>

              {/* Subtasks — a subtask can't have its own, so the section is hidden
                  for one (unless it still holds legacy nested ones, which stay
                  visible until they're flattened). */}
              {(canHaveSubtasks(task.depth) || liveChildren.length > 0) && (
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-800 dark:text-white">Subtasks</h3>
                  {canHaveSubtasks(task.depth) && (
                    <button
                      type="button"
                      onClick={() => setAddingSubtask(true)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-500 dark:hover:text-gray-000"
                    >
                      <LuPlus className="h-3.5 w-3.5" />
                      Add subtask
                    </button>
                  )}
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  {liveChildren.map((child) => (
                    <SubtaskRow
                      key={child.id}
                      subtask={child}
                      parentId={task.id}
                      listId={listId}
                      statuses={statuses}
                      members={members}
                      onOpen={(id) => { void openTaskDetail(id); }}
                      fetchMembers={fetchMembers}
                    />
                  ))}
                  {canHaveSubtasks(task.depth) && addingSubtask && (
                    <SubtaskQuickAdd
                      parentId={task.id}
                      listId={listId}
                      statuses={statuses}
                      members={members}
                      onClose={() => setAddingSubtask(false)}
                    />
                  )}
                  {liveChildren.length === 0 && !addingSubtask && (
                    <div className="px-3 py-4 text-center text-sm text-gray-400">No subtasks yet</div>
                  )}
                </div>
              </div>
              )}

              {/* Attachments */}
              <TaskAttachments taskId={task.id} userId={currentUser?.id ?? task.creator.id} refreshKey={attachmentRefreshKey} />
            </div>
          </div>

          {/* ── Right: Comments + Activity panel ── */}
          <div className="w-80 shrink-0 border-l border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex shrink-0 items-center border-b border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setRightTab("comments")}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  rightTab === "comments"
                    ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400 dark:border-gray-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Comments
              </button>
              <button
                type="button"
                onClick={() => setRightTab("activity")}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  rightTab === "activity"
                    ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400 dark:border-gray-400"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Activity
              </button>
              <div className="flex items-center gap-1 pr-2">
                <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <LuSearch className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <LuBell className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <LuFilter className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {rightTab === "comments" ? (
              <TaskComments taskId={task.id} currentUser={currentUser} members={members} onRefetchMembers={fetchMembers} />
            ) : (
              <ActivityFeed taskId={task.id} />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

