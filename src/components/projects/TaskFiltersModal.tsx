"use client";

import { useEffect, useRef, useState } from "react";
import type { MemberOption } from "@/components/projects/AssigneePicker";
import { createPortal } from "react-dom";
import { GrFlagFill } from "react-icons/gr";
import {
  LuX, LuPlus, LuTrash2, LuChevronDown, LuChevronUp,
  LuCircleDot, LuTag, LuCalendar, LuUser, LuSearch, LuFilter,
} from "react-icons/lu";
import { StatusItem } from "@/services/status.service";
import { WorkspaceTag } from "@/services/tag.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { TaskPriority, TaskSearchParams } from "@/services/task.service";
import { toTaskSearchPatch, TASK_DUE_DATE_OPTIONS } from "./task-search-utils";

// ── Types ────────────────────────────────────────────────────────────────────

type FilterField = "status" | "tags" | "due_date" | "priority" | "assignee";

interface FilterRow {
  id: string;
  field: FilterField;
  // values selected for multi-select fields
  statusGroups: string[];
  statusIds: string[];
  tagIds: string[];
  priorityValues: TaskPriority[];
  assigneeIds: string[];
  dueDateValue: string;
}

// ── Field meta ───────────────────────────────────────────────────────────────

const FIELD_OPTIONS: Array<{ value: FilterField; label: string; icon: React.ReactNode }> = [
  { value: "status",   label: "Status",   icon: <LuCircleDot className="h-4 w-4" /> },
  { value: "tags",     label: "Tags",     icon: <LuTag className="h-4 w-4" /> },
  { value: "due_date", label: "Due date", icon: <LuCalendar className="h-4 w-4" /> },
  { value: "priority", label: "Priority", icon: <GrFlagFill className="h-3 w-3" /> },
  { value: "assignee", label: "Assignee", icon: <LuUser className="h-4 w-4" /> },
];

const STATUS_GROUPS = [
  { value: "NOT_STARTED", label: "Not started", color: "#94a3b8" },
  { value: "ACTIVE",      label: "Active",      color: "#3b82f6" },
  { value: "DONE",        label: "Done",        color: "#22c55e" },
  { value: "CLOSED",      label: "Closed",      color: "#64748b" },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string; color: string }> = [
  { value: "URGENT", label: "Urgent", color: "#ef4444" },
  { value: "HIGH",   label: "High",   color: "#f97316" },
  { value: "NORMAL", label: "Normal", color: "#3b82f6" },
  { value: "LOW",    label: "Low",    color: "#94a3b8" },
  { value: "NONE",   label: "None",   color: "#d1d5db" },
];

function makeRow(field: FilterField = "status"): FilterRow {
  return {
    id: Math.random().toString(36).slice(2),
    field,
    statusGroups: [],
    statusIds: [],
    tagIds: [],
    priorityValues: [],
    assigneeIds: [],
    dueDateValue: "",
  };
}

function toggleItem<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

// ── Small reusable dropdown ───────────────────────────────────────────────────

function Dropdown({
  trigger,
  children,
  minWidth = 220,
}: {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const left = Math.min(rect.left, window.innerWidth - minWidth - 8);
      setPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <div ref={triggerRef} onClick={handleOpen} className="inline-flex cursor-pointer">
        {trigger}
      </div>
      {open && createPortal(
        <div
          ref={dropRef}
          data-filter-dropdown
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 10000, minWidth }}
          className="rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          {children(() => setOpen(false))}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Field selector ────────────────────────────────────────────────────────────

function FieldSelector({ value, onChange }: { value: FilterField; onChange: (f: FilterField) => void }) {
  const current = FIELD_OPTIONS.find((f) => f.value === value)!;
  const [search, setSearch] = useState("");
  const filtered = FIELD_OPTIONS.filter((f) => f.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dropdown
      trigger={
        <div className="flex h-9 min-w-[140px] cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          {current.icon}
          <span className="flex-1 truncate">{current.label}</span>
          <LuChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </div>
      }
    >
      {(close) => (
        <div className="py-1">
          <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 dark:border-gray-700">
              <LuSearch className="h-3.5 w-3.5 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-gray-400 dark:text-white"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
            {filtered.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => { onChange(f.value); close(); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${value === f.value ? "bg-gray-50 dark:bg-gray-800" : ""}`}
              >
                <span className="text-gray-500 dark:text-gray-400">{f.icon}</span>
                <span className="text-gray-700 dark:text-gray-200">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

// ── Value selector per field ──────────────────────────────────────────────────

function StatusValueSelector({
  row, statuses, onChange,
}: {
  row: FilterRow;
  statuses: StatusItem[];
  onChange: (patch: Partial<FilterRow>) => void;
}) {
  const [search, setSearch] = useState("");
  const selectedCount = row.statusGroups.length + row.statusIds.length;

  const label = selectedCount === 0
    ? "Select option"
    : selectedCount === 1
      ? (STATUS_GROUPS.find((g) => row.statusGroups.includes(g.value))?.label
        ?? statuses.find((s) => row.statusIds.includes(s.id))?.name
        ?? "1 selected")
      : `${selectedCount} selected`;

  const groupColor = selectedCount === 1 && row.statusGroups.length === 1
    ? STATUS_GROUPS.find((g) => row.statusGroups[0] === g.value)?.color
    : selectedCount === 1 && row.statusIds.length === 1
      ? statuses.find((s) => s.id === row.statusIds[0])?.color
      : undefined;

  const filteredGroups = STATUS_GROUPS.filter((g) => g.label.toLowerCase().includes(search.toLowerCase()));
  const filteredStatuses = statuses.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dropdown
      trigger={
        <div className="flex h-9 min-w-[180px] cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900">
          {groupColor && <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: groupColor }} />}
          <span className={`flex-1 truncate ${selectedCount === 0 ? "text-gray-400" : "text-gray-700 dark:text-gray-200"}`}>{label}</span>
          {selectedCount > 0
            ? <LuChevronUp className="h-3.5 w-3.5 text-gray-400" />
            : <LuChevronDown className="h-3.5 w-3.5 text-gray-400" />}
        </div>
      }
    >
      {() => (
        <div className="py-1" style={{ minWidth: 260 }}>
          <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-brand-400 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-gray-400 dark:text-white"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
            {filteredGroups.length > 0 && (
              <>
                <p className="flex items-center justify-between px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Statuses
                  <button type="button" onClick={() => onChange({ statusGroups: STATUS_GROUPS.map((g) => g.value), statusIds: [] })} className="text-brand-500 hover:underline normal-case tracking-normal text-xs font-normal">Select All</button>
                </p>
                {filteredGroups.map((g) => (
                  <label key={g.value} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <span className="flex items-center gap-2 flex-1 text-sm text-gray-700 dark:text-gray-200">
                      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: g.color }} />
                      {g.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={row.statusGroups.includes(g.value)}
                      onChange={() => onChange({ statusGroups: toggleItem(row.statusGroups, g.value) })}
                      className="h-4 w-4 rounded accent-brand-500"
                    />
                  </label>
                ))}
              </>
            )}
            {filteredStatuses.length > 0 && (
              <>
                {filteredGroups.length > 0 && <div className="my-1 border-t border-gray-100 dark:border-gray-800" />}
                {filteredStatuses.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <span className="flex items-center gap-2 flex-1 text-sm text-gray-700 dark:text-gray-200">
                      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <input
                      type="checkbox"
                      checked={row.statusIds.includes(s.id)}
                      onChange={() => onChange({ statusIds: toggleItem(row.statusIds, s.id) })}
                      className="h-4 w-4 rounded accent-brand-500"
                    />
                  </label>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

function TagValueSelector({ row, tags, onChange }: { row: FilterRow; tags: WorkspaceTag[]; onChange: (patch: Partial<FilterRow>) => void }) {
  const [search, setSearch] = useState("");
  const selected = row.tagIds.length;
  const label = selected === 0 ? "Select tags" : selected === 1 ? (tags.find((t) => t.id === row.tagIds[0])?.name ?? "1 tag") : `${selected} tags`;
  const filtered = tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dropdown
      trigger={
        <div className="flex h-9 min-w-[180px] cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900">
          <span className={`flex-1 truncate ${selected === 0 ? "text-gray-400" : "text-gray-700 dark:text-gray-200"}`}>{label}</span>
          <LuChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </div>
      }
    >
      {() => (
        <div className="py-1" style={{ minWidth: 240 }}>
          <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full rounded-lg border border-brand-400 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-gray-400 dark:text-white" />
          </div>
          <div className="max-h-60 overflow-y-auto py-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
            {filtered.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{t.name}</span>
                <input type="checkbox" checked={row.tagIds.includes(t.id)} onChange={() => onChange({ tagIds: toggleItem(row.tagIds, t.id) })} className="h-4 w-4 rounded accent-brand-500" />
              </label>
            ))}
            {filtered.length === 0 && <p className="px-3 py-3 text-center text-sm text-gray-400">No tags found</p>}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

function PriorityValueSelector({ row, onChange }: { row: FilterRow; onChange: (patch: Partial<FilterRow>) => void }) {
  const selected = row.priorityValues.length;
  const label = selected === 0 ? "Select priority" : selected === 1 ? PRIORITY_OPTIONS.find((p) => p.value === row.priorityValues[0])?.label ?? "1 selected" : `${selected} selected`;
  const dotColor = selected === 1 ? PRIORITY_OPTIONS.find((p) => p.value === row.priorityValues[0])?.color : undefined;

  return (
    <Dropdown
      trigger={
        <div className="flex h-9 min-w-[180px] cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900">
          {dotColor && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />}
          <span className={`flex-1 truncate ${selected === 0 ? "text-gray-400" : "text-gray-700 dark:text-gray-200"}`}>{label}</span>
          <LuChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </div>
      }
    >
      {() => (
        <div className="py-1" style={{ minWidth: 200 }}>
          {PRIORITY_OPTIONS.map((p) => (
            <label key={p.value} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{p.label}</span>
              <input type="checkbox" checked={row.priorityValues.includes(p.value)} onChange={() => onChange({ priorityValues: toggleItem(row.priorityValues, p.value) as TaskPriority[] })} className="h-4 w-4 rounded accent-brand-500" />
            </label>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

function AssigneeValueSelector({ row, members, onChange }: { row: FilterRow; members: MemberOption[]; onChange: (patch: Partial<FilterRow>) => void }) {
  const [search, setSearch] = useState("");
  const selected = row.assigneeIds.length;
  const label = selected === 0 ? "Select assignee" : selected === 1 ? (members.find((m) => m.id === row.assigneeIds[0])?.fullName ?? "1 selected") : `${selected} selected`;
  const filtered = members.filter((m) => m.fullName.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dropdown
      trigger={
        <div className="flex h-9 min-w-[200px] cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900">
          <span className={`flex-1 truncate ${selected === 0 ? "text-gray-400" : "text-gray-700 dark:text-gray-200"}`}>{label}</span>
          <LuChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </div>
      }
    >
      {() => (
        <div className="py-1" style={{ minWidth: 240 }}>
          <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or enter email..." className="w-full rounded-lg border border-brand-400 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-gray-400 dark:text-white" />
          </div>
          <div className="max-h-60 overflow-y-auto py-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
            <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-600">Me</span>
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">Me</span>
              <input type="checkbox" checked={row.assigneeIds.includes("__me__")} onChange={() => onChange({ assigneeIds: toggleItem(row.assigneeIds, "__me__") })} className="h-4 w-4 rounded accent-brand-500" />
            </label>
            {filtered.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white bg-indigo-500">
                  {m.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </span>
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{m.fullName}</span>
                <input type="checkbox" checked={row.assigneeIds.includes(m.id)} onChange={() => onChange({ assigneeIds: toggleItem(row.assigneeIds, m.id) })} className="h-4 w-4 rounded accent-brand-500" />
              </label>
            ))}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

function DueDateValueSelector({ row, onChange }: { row: FilterRow; onChange: (patch: Partial<FilterRow>) => void }) {
  const label = TASK_DUE_DATE_OPTIONS.find((o) => o.value === row.dueDateValue)?.label ?? "Select date";
  return (
    <Dropdown
      trigger={
        <div className="flex h-9 min-w-[180px] cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900">
          <span className={`flex-1 truncate ${!row.dueDateValue ? "text-gray-400" : "text-gray-700 dark:text-gray-200"}`}>{label}</span>
          <LuChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </div>
      }
    >
      {(close) => (
        <div className="py-1" style={{ minWidth: 200 }}>
          {TASK_DUE_DATE_OPTIONS.filter((o) => o.value !== "").map((o) => (
            <button key={o.value} type="button" onClick={() => { onChange({ dueDateValue: o.value }); close(); }} className={`flex w-full items-center px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${row.dueDateValue === o.value ? "text-brand-600 dark:text-brand-400" : "text-gray-700 dark:text-gray-200"}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

// ── Filter row ────────────────────────────────────────────────────────────────

function FilterRowUI({
  row, index, total, statuses, members, tags,
  onChange, onRemove,
}: {
  row: FilterRow;
  index: number;
  total: number;
  statuses: StatusItem[];
  members: MemberOption[];
  tags: WorkspaceTag[];
  onChange: (patch: Partial<FilterRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      {/* Where / AND label */}
      <div className="w-16 shrink-0 pt-2 text-right">
        {index === 0
          ? <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Where</span>
          : (
            <div className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900">
              AND 
            </div>
          )
        }
      </div>

      {/* Filter card */}
      <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
        <div className="flex flex-wrap items-center gap-2">
          {/* Field */}
          <FieldSelector value={row.field} onChange={(f) => onChange({ field: f, statusGroups: [], statusIds: [], tagIds: [], priorityValues: [], assigneeIds: [], dueDateValue: "" })} />

          {/* Operator (always "Is" for now) */}
          <div className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            is
          </div>

          {/* Value */}
          {row.field === "status" && <StatusValueSelector row={row} statuses={statuses} onChange={onChange} />}
          {row.field === "tags" && <TagValueSelector row={row} tags={tags} onChange={onChange} />}
          {row.field === "priority" && <PriorityValueSelector row={row} onChange={onChange} />}
          {row.field === "assignee" && <AssigneeValueSelector row={row} members={members} onChange={onChange} />}
          {row.field === "due_date" && <DueDateValueSelector row={row} onChange={onChange} />}
        </div>

        {/* Nested filter hint */}
        {/* <button type="button" className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          Add nested filter
        </button> */}
      </div>

      {/* Delete */}
      <button type="button" onClick={onRemove} className="mt-2 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800">
        <LuTrash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Build TaskSearchParams from rows ─────────────────────────────────────────

function rowsToParams(rows: FilterRow[]): Partial<TaskSearchParams> {
  const params: Partial<TaskSearchParams> = {};
  const statusGroups: string[] = [];
  const statusIds: string[] = [];
  const tagIds: string[] = [];
  const priorityValues: TaskPriority[] = [];
  const assigneeIds: string[] = [];
  let dueDateValue = "";
  let meMode = false;

  for (const row of rows) {
    if (row.field === "status") {
      statusGroups.push(...row.statusGroups);
      statusIds.push(...row.statusIds);
    } else if (row.field === "tags") {
      tagIds.push(...row.tagIds);
    } else if (row.field === "priority") {
      priorityValues.push(...row.priorityValues);
    } else if (row.field === "assignee") {
      if (row.assigneeIds.includes("__me__")) meMode = true;
      assigneeIds.push(...row.assigneeIds.filter((id) => id !== "__me__"));
    } else if (row.field === "due_date") {
      dueDateValue = row.dueDateValue;
    }
  }

  if (statusGroups.length) params.status_groups = [...new Set(statusGroups)] as TaskSearchParams["status_groups"];
  if (statusIds.length) params.status_ids = [...new Set(statusIds)];
  if (tagIds.length) params.tag_ids = [...new Set(tagIds)];
  if (priorityValues.length) params.priority = [...new Set(priorityValues)] as TaskPriority[];
  if (assigneeIds.length) params.assignee_ids = [...new Set(assigneeIds)];
  if (dueDateValue) params.due_date = dueDateValue;
  if (meMode) params.me = true;

  return params;
}

function paramsToRows(p: TaskSearchParams): FilterRow[] {
  const rows: FilterRow[] = [];

  if ((p.status_groups?.length ?? 0) > 0 || (p.status_ids?.length ?? 0) > 0) {
    rows.push({ ...makeRow("status"), statusGroups: p.status_groups ?? [], statusIds: p.status_ids ?? [] });
  }
  if ((p.tag_ids?.length ?? 0) > 0) {
    rows.push({ ...makeRow("tags"), tagIds: p.tag_ids ?? [] });
  }
  if ((p.priority?.length ?? 0) > 0) {
    rows.push({ ...makeRow("priority"), priorityValues: p.priority ?? [] });
  }
  if ((p.assignee_ids?.length ?? 0) > 0 || p.me) {
    const ids = [...(p.assignee_ids ?? [])];
    if (p.me) ids.unshift("__me__");
    rows.push({ ...makeRow("assignee"), assigneeIds: ids });
  }
  if (p.due_date) {
    rows.push({ ...makeRow("due_date"), dueDateValue: p.due_date });
  }

  return rows.length > 0 ? rows : [makeRow("status")];
}

// ── Main component ────────────────────────────────────────────────────────────

interface TaskFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: TaskSearchParams;
  statuses?: StatusItem[];
  members: MemberOption[];
  tags: WorkspaceTag[];
  allowStatusIds?: boolean;
  anchorRect?: DOMRect | null;
  onApply: (patch: Record<string, string | null>) => void;
  onClear: () => void;
}

export default function TaskFiltersModal({
  isOpen,
  onClose,
  value,
  statuses = [],
  members,
  tags,
  anchorRect,
  onApply,
  onClear,
}: TaskFiltersModalProps) {
  const [rows, setRows] = useState<FilterRow[]>(() => paramsToRows(value));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setRows(paramsToRows(value));
  }, [isOpen, value]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-filter-dropdown]")) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Position anchored below the filter button, right-aligned
  const PANEL_WIDTH = 640;
  const panelStyle: React.CSSProperties = anchorRect
    ? {
        position: "fixed",
        top: anchorRect.bottom + 6,
        left: Math.min(
          anchorRect.right - PANEL_WIDTH,
          window.innerWidth - PANEL_WIDTH - 8
        ),
        width: PANEL_WIDTH,
        zIndex: 9998,
      }
    : {
        position: "fixed",
        top: "4rem",
        left: "50%",
        transform: "translateX(-50%)",
        width: PANEL_WIDTH,
        zIndex: 9998,
      };

  const updateRow = (id: string, patch: Partial<FilterRow>) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  };

  const removeRow = (id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length > 0 ? next : [makeRow("status")];
    });
  };

  const handleApply = () => {
    const params = rowsToParams(rows);
    onApply({ ...toTaskSearchPatch({ ...params, page: 1 }), page: null });
    onClose();
  };

  const handleClear = () => {
    setRows([makeRow("status")]);
    onClear();
    onClose();
  };

  return createPortal(
    <div ref={panelRef} style={panelStyle} className="rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-901">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <LuFilter className="h-3.5 w-3.5 text-gray-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Filters</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
              Saved <LuChevronDown className="h-3 w-3" />
            </button> */}
            <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
              <LuX className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Filter rows */}
        <div className="max-h-[60vh] space-y-2 overflow-y-auto px-4 py-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
          {rows.map((row, idx) => (
            <FilterRowUI
              key={row.id}
              row={row}
              index={idx}
              total={rows.length}
              statuses={statuses}
              members={members}
              tags={tags}
              onChange={(patch) => updateRow(row.id, patch)}
              onRemove={() => removeRow(row.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, makeRow("status")])}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <LuPlus className="h-3 w-3" />
            Add condition
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600 dark:bg-gray-000 dark:text-black dark:hover:bg-gray-200"
            >
              Apply
            </button>
          </div>
        </div>
    </div>,
    document.body
  );
}

