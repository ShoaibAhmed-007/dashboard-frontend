"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuX, LuMaximize2, LuPaperclip, LuSparkles, LuFileText } from "react-icons/lu";
import { StatusItem } from "@/services/status.service";
import { TaskList } from "@/services/task-list.service";
import { useTaskStore } from "@/stores/task.store";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useWorkspaceTags } from "@/hooks/useWorkspaceTags";
import TagPicker from "./TagPicker";
import { TaskPriority } from "@/services/task.service";
import { parseApiError } from "@/lib/api";
import { todayDueDateIso } from "@/lib/utils";
import { toast } from "sonner";
import StatusPicker from "./StatusPicker";
import AssigneePicker from "./AssigneePicker";
import DatePicker from "./DatePicker";
import PriorityPicker from "./PriorityPicker";

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  editTask?: import("@/types/task").Task | null;
  projectId: string | null;
  availableLists: TaskList[];
  statuses: StatusItem[];
  defaultStatusId?: string | null;
  defaultListId?: string | null;
}

export default function TaskForm({
  isOpen,
  onClose,
  projectId,
  availableLists,
  statuses,
  defaultStatusId,
  defaultListId,
}: TaskFormProps) {
  const { createTask } = useTaskStore();
  const { members, refetch: refetchMembers } = useProjectMembers(projectId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState<string>(() => defaultStatusId ?? statuses[0]?.id ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<{ user: { id: string; fullName: string; avatarUrl: null; avatarColor: string }; assignedBy: string }[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(todayDueDateIso());
  const [priority, setPriority] = useState<TaskPriority>("NONE");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [currentTags, setCurrentTags] = useState<{ tag: { id: string; name: string; color: string } }[]>([]);
  const { tags: allTags } = useWorkspaceTags();
  const [saving, setSaving] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDescription("");
    setStatusId(defaultStatusId ?? statuses[0]?.id ?? "");
    setAssigneeIds([]);
    setAssignees([]);
    setStartDate(null);
    setDueDate(todayDueDateIso());
    setPriority("NONE");
    setTagIds([]);
    setTimeout(() => titleRef.current?.focus(), 50);
  }, [isOpen, defaultStatusId, statuses]);

  const resolvedListId = defaultListId ?? availableLists[0]?.id ?? "";
  const currentStatus = statuses.find((s) => s.id === statusId) ?? statuses[0];

  const handleAddAssignee = (userId: string) => {
    if (assigneeIds.includes(userId)) return;
    const member = members.find((m) => m.id === userId);
    if (!member) return;
    setAssigneeIds((p) => [...p, userId]);
    setAssignees((p) => [...p, { user: { id: member.id, fullName: member.fullName, avatarUrl: null, avatarColor: "#6366f1" }, assignedBy: "" }]);
  };

  const handleRemoveAssignee = (userId: string) => {
    setAssigneeIds((p) => p.filter((id) => id !== userId));
    setAssignees((p) => p.filter((a) => a.user.id !== userId));
  };

  const handleAddTag = async (tagId: string) => {
    if (tagIds.includes(tagId)) return;
    const tag = allTags.find((t) => t.id === tagId);
    if (!tag) return;
    setTagIds((p) => [...p, tagId]);
    setCurrentTags((p) => [...p, { tag: { id: tag.id, name: tag.name, color: tag.color } }]);
  };

  const handleRemoveTag = async (tagId: string) => {
    setTagIds((p) => p.filter((id) => id !== tagId));
    setCurrentTags((p) => p.filter((t) => t.tag.id !== tagId));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !resolvedListId || !projectId) return;
    setSaving(true);
    try {
      await createTask(projectId, resolvedListId, {
        title: title.trim(),
        description: description.trim() || undefined,
        statusId: statusId || statuses[0]?.id,
        assigneeIds: assigneeIds.length ? assigneeIds : undefined,
        startDate: startDate ?? undefined,
        dueDate: dueDate ?? undefined,
        priority: priority !== "NONE" ? priority : undefined,
        tagIds: tagIds.length ? tagIds : undefined,
      });
      toast.success("Task created");
      onClose();
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const listName = availableLists.find((l) => l.id === resolvedListId)?.name ?? "Task";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white shadow-2xl dark:bg-gray-900 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-medium text-gray-700 dark:text-gray-200">{listName}</span>
            <span className="text-gray-300">/</span>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">Task</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <LuMaximize2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <LuX className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
            placeholder="Task Name or type '/' for commands"
            className="w-full border-0 bg-transparent text-xl font-normal text-gray-800 placeholder:text-gray-300 outline-none dark:text-white dark:placeholder:text-gray-600"
          />

          {/* Description */}
          <button type="button" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={() => {}}>
            <LuFileText className="h-4 w-4" />
            {description ? null : <span>Add description</span>}
          </button>
          {description !== null && (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description..."
              rows={2}
              className="w-full resize-none border-0 bg-transparent text-sm text-gray-500 placeholder:text-gray-300 outline-none dark:text-gray-400 dark:placeholder:text-gray-600"
            />
          )}

          {/* Write with AI */}
          <button type="button" className="group flex items-center gap-2 text-sm text-gray-400 hover:text-brand-500 dark:hover:text-gray-000 ">
            <LuSparkles className="h-4 w-4 text-gray-400 group-hover:text-brand-500 dark:group-hover:text-gray-000" />
            <span>Write with AI</span>
          </button>

          {/* Toolbar pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Status */}
            {currentStatus && (
              <div
                className="rounded-lg border"
                style={{ borderColor: `${currentStatus.color}55`, backgroundColor: `${currentStatus.color}15` }}
              >
                <StatusPicker statuses={statuses} value={statusId} onChange={setStatusId} />
              </div>
            )}

            {/* Assignee */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700">
              <AssigneePicker assignees={assignees} members={members} onAdd={handleAddAssignee} onRemove={handleRemoveAssignee} onOpen={refetchMembers} iconSize="sm" />
            </div>

            {/* Due date */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700">
              <DatePicker startDate={startDate} dueDate={dueDate} onChange={(r) => { setStartDate(r.startDate); setDueDate(r.dueDate); }} iconSize="sm" />
            </div>

            {/* Priority */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700">
              <PriorityPicker value={priority} onChange={setPriority} onClear={() => setPriority("NONE")} iconSize="sm" />
            </div>

            {/* Tags */}
            <TagPicker
              taskId=""
              listId={resolvedListId}
              currentTags={currentTags}
              onAdd={handleAddTag}
              onRemove={handleRemoveTag}
            />
          </div>

          {/* Fields section */}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button type="button" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <LuPaperclip className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!title.trim() || saving}
              className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-normal text-white dark:bg-gray-000 dark:text-black dark:hover:bg-gray-200 hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating..." : "Create Task"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
