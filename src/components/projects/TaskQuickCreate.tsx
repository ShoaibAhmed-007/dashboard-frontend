"use client";

import { useEffect, useRef, useState } from "react";
import type { MemberOption } from "@/components/projects/AssigneePicker";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { TaskAssignee, TaskPriority } from "@/services/task.service";
import StatusIcon from "./StatusIcon";
import AssigneePicker from "./AssigneePicker";
import DatePicker from "./DatePicker";
import PriorityPicker from "./PriorityPicker";
import { todayDueDateIso } from "@/lib/utils";

interface TaskQuickCreateProps {
  status: StatusItem;
  members: MemberOption[];
  onSave: (payload: {
    title: string;
    assigneeIds: string[];
    startDate: string | null;
    dueDate: string | null;
    priority: TaskPriority;
  }) => Promise<void>;
  onCancel: () => void;
  variant?: "list" | "board";
}

export default function TaskQuickCreate({ status, members, onSave, onCancel, variant = "list" }: TaskQuickCreateProps) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(todayDueDateIso());
  const [priority, setPriority] = useState<TaskPriority>("NONE");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!title.trim()) onCancel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [title, onCancel]);

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
    setSaving(true);
    try {
      await onSave({ title: trimmed, assigneeIds, startDate, dueDate, priority });
      setTitle("");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); void handleSave(); }
    if (e.key === "Escape") { onCancel(); }
  };

  if (variant === "board") {
    return (
      <div ref={containerRef} className="rounded-xl border border-brand-500 bg-white dark:bg-gray-900 dark:border-gray-000">
        {/* Title + Save */}
        <div className="flex items-center justify-between gap-1.5 px-2.5 pt-2.5 pb-0.5">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Task Name..."
            className="min-w-0 flex-1 bg-transparent text-xs text-gray-600 outline-none placeholder:text-gray-600 dark:text-white dark:placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!title.trim() || saving}
            className="shrink-0 rounded bg-brand-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-brand-600 dark:bg-gray-000 dark:text-black dark:hover:bg-gray-200 disabled:opacity-40"
          >
            {saving ? "..." : "Save ↵"}
          </button>
        </div>

        {/* List label */}
        <div className="px-2.5 pb-1.5 text-[10px] text-gray-600">List</div>

        {/* Picker rows */}
        <div className="border-t border-gray-100 dark:border-gray-800">
          {/* Assignee */}
          <div className="flex items-center px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <AssigneePicker
              assignees={assignees}
              members={members}
              onAdd={handleAddAssignee}
              onRemove={handleRemoveAssignee}
              iconSize="sm"
              showLabel
            />
          </div>
          {/* Date */}
          <div className="flex items-center px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <DatePicker
              startDate={startDate}
              dueDate={dueDate}
              onChange={(range) => { setStartDate(range.startDate); setDueDate(range.dueDate); }}
              iconSize="sm"
              showLabel
            />
          </div>
          {/* Priority */}
          <div className="flex items-center px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <PriorityPicker
              value={priority}
              onChange={setPriority}
              onClear={() => setPriority("NONE")}
              iconSize="sm"
              showLabel
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex items-center gap-2 border-t border-gray-100 px-4 py-2 dark:border-gray-800">
      {/* Status icon */}
      <div className="flex w-8 shrink-0 items-center justify-center">
        <StatusIcon group={status.group} color={status.color} size={13} />
      </div>

      {/* Title input */}
      <input
        ref={inputRef}
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task Name or type '/' for commands"
        className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-300 dark:text-gray-200 dark:placeholder:text-gray-600"
      />

      {/* Inline pickers */}
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

      {/* Cancel / Save */}
      <button type="button" onClick={onCancel} className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
        Cancel
      </button>
      <button type="button" onClick={() => void handleSave()} disabled={!title.trim() || saving} className="shrink-0 rounded-lg bg-brand-500 px-2.5 py-1 text-xs text-white dark:bg-gray-000 dark:text-black dark:hover:bg-gray-200 hover:bg-brand-600 disabled:opacity-50">
        {saving ? "..." : "Save ↵"}
      </button>
    </div>
  );
}
