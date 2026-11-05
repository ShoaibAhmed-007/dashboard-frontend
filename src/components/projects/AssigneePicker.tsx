"use client";

import { useEffect, useRef, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import { createPortal } from "react-dom";
import { LuSearch, LuUsers, LuCheck } from "react-icons/lu";
import { WorkspaceMember } from "@/services/workspace.service";
import { TaskAssignee } from "@/services/task.service";
import UserAvatarHoverCard from "@/components/user-profile/UserAvatarHoverCard";
import { useDropdownPosition } from "@/hooks/useDropdownPosition";


const AVATAR_COLORS = [
  "#18181b", "#7c3aed", "#eab308", "#0f172a", "#6d28d9",
  "#ca8a04", "#1e1b4b", "#fbbf24", "#3b0764", "#292524",
];

function avatarBg(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33) ^ id.charCodeAt(i);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * The subset of a member this picker actually renders.
 *
 * Deliberately narrower than `WorkspaceMember`: on a PRIVATE project the
 * options come from `GET /projects/:id/members`, whose user objects carry only
 * these fields — no role, tier, or invite status. `WorkspaceMember`
 * structurally satisfies this, so PUBLIC call sites pass through unchanged.
 */
export type MemberOption = Pick<
  WorkspaceMember,
  "id" | "fullName" | "email" | "avatarUrl" | "avatarColor"
>;

interface AssigneePickerProps {
  assignees: TaskAssignee[];
  members: MemberOption[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
  onOpen?: () => void;
  align?: "left" | "right";
  iconSize?: "sm" | "md";
  showLabel?: boolean;
  /** Stretch the trigger to fill its parent so the whole field is clickable,
   *  not just the avatars/icon. For pickers rendered inside a bordered box. */
  fillContainer?: boolean;
}

export default function AssigneePicker({ assignees, members, onAdd, onRemove, onOpen, align = "left", iconSize = "md", showLabel = false, fillContainer = false }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(btnRef, dropdownRef, open, { align });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = ref.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideTrigger && !insideDropdown) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen((v) => {
      if (!v) onOpen?.();
      return !v;
    });
  };

  const assignedIds = new Set(assignees.map((a) => a.user.id));
  const filtered = members.filter((m) =>
    search ? m.fullName.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div ref={ref} className={`relative ${fillContainer ? "h-full w-full" : ""}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => handleOpen(e)}
        className={`flex items-center gap-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${fillContainer ? "h-full w-full px-3" : iconSize === "sm" ? "p-1" : "px-1.5 py-1"}`}
        title="Assignees"
      >
        {assignees.length === 0 ? (
          <div className="flex items-center gap-2">
            <LuUsers className={`text-gray-600 ${iconSize === "sm" ? "h-3 w-3" : "h-4 w-4"}`} />
            {showLabel && <span className="text-xs text-gray-600">Add assignee</span>}
          </div>
        ) : (
          <div className="flex -space-x-1.5">
            {assignees.slice(0, 3).map((a) => (
              <UserAvatarHoverCard
                key={a.user.id}
                user={{ id: a.user.id, fullName: a.user.fullName, avatarColor: a.user.avatarColor }}
                size="sm"
              />
            ))}
            {assignees.length > 3 && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[8px] text-gray-600 ring-1 ring-white dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-900">
                +{assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, maxHeight: pos.maxHeight, zIndex: 9999 }}
          className="w-56 flex flex-col rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 overflow-hidden"
        >
          <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1 dark:bg-gray-800">
              <LuSearch className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-gray-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {filtered.map((m) => {
              const assigned = assignedIds.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => assigned ? onRemove(m.id) : onAdd(m.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <UserAvatar
                    name={m.fullName}
                    avatarUrl={m.avatarUrl}
                    size={24}
                    color={m.avatarColor || avatarBg(m.id)}
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-medium text-gray-800 dark:text-white">{m.fullName}</p>
                    <p className="truncate text-[10px] text-gray-400">{m.email}</p>
                  </div>
                  {assigned && <LuCheck className="h-3.5 w-3.5 shrink-0 text-brand-500" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-gray-400">No members found</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
