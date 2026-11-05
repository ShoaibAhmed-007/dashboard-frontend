"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useOptionalProjects } from "@/context/ProjectContext";
import { parseApiError } from "@/lib/api";
import { statusService } from "@/services/status.service";
import { projectService } from "@/services/project.service";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useAuthStore } from "@/stores/auth.store";
import { getInitials } from "@/lib/getInitials";
import { taskListService } from "@/services/task-list.service";
import { syncProjectStatuses } from "@/components/projects/project-status-sync";
import {
  createDefaultProjectStatusGroups,
  LocalProjectStatusGroup,
  nextLocalProjectStatusId,
  ProjectStatusGroupEditor,
  PROJECT_STATUS_COLOR_OPTIONS,
} from "@/components/projects/ProjectStatusEditor";
import IconColorPicker, { ICON_MAP } from "@/components/projects/IconColorPicker";
import { toast } from "sonner";
import {
  LuX,
  LuLock,
  LuLockOpen,
  LuChevronLeft,
  LuInfo,
} from "react-icons/lu";

function generatePrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 6);
}

type CreateStep = "details" | "statuses";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateSpaceModal({ isOpen, onClose }: Props) {
  const { createProject, refetch } = useOptionalProjects();

  // Step 1 state
  const [step, setStep] = useState<CreateStep>("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PROJECT_STATUS_COLOR_OPTIONS[0]);
  const [icon, setIcon] = useState<string | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  /* Who to invite once the project exists. Collected here rather than after
     creation so a private project is set up in one pass; the invite itself has
     to wait for a project id. */
  const [inviteIds, setInviteIds] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState("");

  const { members: workspaceMembers } = useWorkspaceMembers();
  const currentUserId = useAuthStore((state) => state.user?.id);
  /* The creator is always a member of their own project, so they are never an
     option here — showing them would imply they could be left out. */
  const invitableMembers = workspaceMembers.filter((m) => m.id !== currentUserId);
  const filteredMembers = memberSearch.trim()
    ? invitableMembers.filter((m) => {
        const needle = memberSearch.trim().toLowerCase();
        return (
          m.fullName.toLowerCase().includes(needle) ||
          m.email.toLowerCase().includes(needle)
        );
      })
    : invitableMembers;

  const toggleInvite = (userId: string) => {
    setInviteIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };
  const [prefixError, setPrefixError] = useState("");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalContainerRef, isOpen);

  // Step 2 state
  const [groups, setGroups] = useState<LocalProjectStatusGroup[]>(() =>
    createDefaultProjectStatusGroups()
  );
  const [addingToGroup, setAddingToGroup] = useState<number | null>(null);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState(PROJECT_STATUS_COLOR_OPTIONS[0]);
  const [newColorPickerOpen, setNewColorPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null); // tempId
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null); // tempId
  const [renamingTempId, setRenamingTempId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragOver, setDragOver] = useState<{ groupIdx: number; statusIdx: number } | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  // Pointer-drag state
  const pointerDragRef = useRef<{
    groupIdx: number;
    statusIdx: number;
    startY: number;
    currentY: number;
    itemHeight: number;
  } | null>(null);
  const [pointerDragState, setPointerDragState] = useState<{
    groupIdx: number;
    statusIdx: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("details");
      setName("");
      setDescription("");
      setColor(PROJECT_STATUS_COLOR_OPTIONS[0]);
      setIcon(null);
      setIconPickerOpen(false);
      setPrefix("");
      setPrefixTouched(false);
      setIsPrivate(false);
      setInviteIds(new Set());
      setMemberSearch("");
      setPrefixError("");
      setNameError("");
      setLoading(false);
      setGroups(createDefaultProjectStatusGroups());
      setAddingToGroup(null);
      setNewStatusName("");
      setNewStatusColor(PROJECT_STATUS_COLOR_OPTIONS[0]);
      setMenuOpen(null);
      setColorPickerOpen(null);
      setNewColorPickerOpen(false);
      setRenamingTempId(null);
      setRenameValue("");
      setDragOver(null);
      setPointerDragState(null);
      pointerDragRef.current = null;
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!prefixTouched) setPrefix(generatePrefix(name));
  }, [name, prefixTouched]);

  useEffect(() => {
    if (addingToGroup !== null) {
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [addingToGroup]);

  const handlePrefixChange = (val: string) => {
    setPrefixTouched(true);
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setPrefix(clean);
    setPrefixError(clean.length < 2 ? "Prefix must be at least 2 characters" : "");
  };

  const handleNameChange = (val: string) => {
    setName(val);
    const trimmed = val.trim();
    setNameError(trimmed.length > 0 && trimmed.length < 2 ? "Name must be at least 2 characters" : "");
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setNameError("Name must be at least 2 characters");
      return;
    }
    if (prefix.length < 2) {
      setPrefixError("Prefix must be at least 2 characters");
      return;
    }
    setStep("statuses");
  };

  // --- Status group editing ---

  const addStatus = (groupIdx: number) => {
    const trimmed = newStatusName.trim();
    setNewColorPickerOpen(false);
    if (!trimmed) {
      setAddingToGroup(null);
      return;
    }
    setGroups((prev) => {
      const next = prev.map((g, i) =>
        i === groupIdx
          ? {
              ...g,
              statuses: [
                ...g.statuses,
                {
                  tempId: nextLocalProjectStatusId(),
                  name: trimmed,
                  color: newStatusColor,
                  isProtected: false,
                },
              ],
            }
          : g
      );
      return next;
    });
    setNewStatusName("");
    setNewStatusColor(PROJECT_STATUS_COLOR_OPTIONS[0]);
    setAddingToGroup(null);
  };

  const deleteStatus = (groupIdx: number, tempId: string) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx ? { ...g, statuses: g.statuses.filter((s) => s.tempId !== tempId) } : g
      )
    );
    setMenuOpen(null);
  };

  const changeStatusColor = (groupIdx: number, tempId: string, newColor: string) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, statuses: g.statuses.map((s) => (s.tempId === tempId ? { ...s, color: newColor } : s)) }
          : g
      )
    );
  };

  const startRename = (tempId: string, currentName: string) => {
    setMenuOpen(null);
    setRenamingTempId(tempId);
    setRenameValue(currentName);
  };

  const commitRename = (groupIdx: number, tempId: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      setGroups((prev) =>
        prev.map((g, i) =>
          i === groupIdx
            ? {
                ...g,
                statuses: g.statuses.map((s) =>
                  s.tempId === tempId ? { ...s, name: trimmed } : s
                ),
              }
            : g
        )
      );
    }
    setRenamingTempId(null);
    setRenameValue("");
  };

  // Pointer-based smooth drag reorder
  const handlePointerDragStart = useCallback((
    e: React.PointerEvent,
    groupIdx: number,
    statusIdx: number,
    itemHeight: number,
  ) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerDragRef.current = { groupIdx, statusIdx, startY: e.clientY, currentY: e.clientY, itemHeight };
    setPointerDragState({ groupIdx, statusIdx, offsetY: 0 });
  }, []);

  const handlePointerDragMove = useCallback((e: React.PointerEvent, groupIdx: number) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.groupIdx !== groupIdx) return;
    const offsetY = e.clientY - drag.startY;
    drag.currentY = e.clientY;
    setPointerDragState({ groupIdx, statusIdx: drag.statusIdx, offsetY });

    // Compute which slot we're hovering: each item is itemHeight + gap(6px)
    const slotSize = drag.itemHeight + 6;
    const hoverIdx = Math.round(drag.statusIdx + offsetY / slotSize);
    const groupLen = groups[groupIdx]?.statuses.length ?? 0;
    const clamped = Math.max(0, Math.min(groupLen - 1, hoverIdx));
    setDragOver({ groupIdx, statusIdx: clamped });
  }, [groups]);

  const handlePointerDragEnd = useCallback((groupIdx: number) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.groupIdx !== groupIdx) {
      pointerDragRef.current = null;
      setDragOver(null);
      setPointerDragState(null);
      return;
    }
    const from = drag.statusIdx;
    const to = dragOver?.groupIdx === groupIdx ? dragOver.statusIdx : from;
    pointerDragRef.current = null;
    setDragOver(null);
    setPointerDragState(null);
    if (from !== to) {
      setGroups((prev) =>
        prev.map((g, i) => {
          if (i !== groupIdx) return g;
          const statuses = [...g.statuses];
          const [moved] = statuses.splice(from, 1);
          statuses.splice(to, 0, moved);
          return { ...g, statuses };
        })
      );
    }
  }, [dragOver]);

  // --- Project creation ---

  const handleCreateProject = async () => {
    setLoading(true);
    let createdProjectId: string | null = null;
    try {
      const project = await createProject({
        name: name.trim(),
        taskIdPrefix: prefix,
        description: description.trim() || undefined,
        color,
        icon: icon ?? undefined,
        visibility: isPrivate ? "PRIVATE" : "PUBLIC",
      });
      createdProjectId = project.id;

      /* Invites can only happen once the project exists. Failures here are
         reported but never fail the creation — the project is already made, and
         people can still be added from Sharing & Permissions. */
      if (isPrivate && inviteIds.size > 0) {
        try {
          const { summary } = await projectService.addMembersBatch(
            project.id,
            Array.from(inviteIds)
          );
          if (summary.failed > 0) {
            toast.warning(
              `Project created, but ${summary.failed} of ${summary.total} ${
                summary.failed === 1 ? "invite" : "invites"
              } failed.`
            );
          }
        } catch (err) {
          toast.warning(
            `Project created, but members couldn't be added: ${parseApiError(err).message}`
          );
        }
      }

      const initialGroupedStatuses = await statusService.list(project.id);
      await syncProjectStatuses(project.id, initialGroupedStatuses, groups);
      await taskListService.create(project.id, { name: "List" });
      await refetch();
      toast.success(`Project "${name.trim()}" created`);
      onClose();
    } catch (err) {
      const { message, code } = parseApiError(err);
      if (!createdProjectId && code === "CONFLICT") {
        setPrefixError("This prefix is already taken in this workspace");
        setStep("details");
      } else if (createdProjectId) {
        await refetch();
        toast.error(
          `Project "${name.trim()}" was created, but some status changes could not be applied: ${message}`
        );
        onClose();
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const initial = name.trim().charAt(0).toUpperCase() || "S";
  const titleName = name.trim() || "Project";
  const isNameValid = name.trim().length >= 2;

  const modal = (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-9999 flex items-center justify-center"
      onClick={() => { setMenuOpen(null); setColorPickerOpen(null); setIconPickerOpen(false); }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {step === "details" ? (
        /* ───────────── STEP 1: Details ───────────── */
        <div className="relative z-10 w-full max-w-[760px] mx-4 bg-white dark:bg-gray-901 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-start justify-between px-6 pt-6 pb-4">
            <div>
              <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white">Create a Project</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                A Project represents teams, departments, or groups, each with its own Lists, workflows, and settings.
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleDetailsSubmit}>
            <div className="px-6 space-y-5">
              {/* Icon & Name */}
              <div>
                <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-2">Icon &amp; name</label>
                <div className="flex items-center gap-3">
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setIconPickerOpen((v) => !v)}
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-normal cursor-pointer shrink-0 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: color }}
                      title="Pick icon & color"
                    >
                      {icon && ICON_MAP.has(icon)
                        ? (() => { const I = ICON_MAP.get(icon)!; return <I className="w-5 h-5" />; })()
                        : initial}
                    </button>
                    {iconPickerOpen && (
                      <div className="absolute left-0 top-full mt-2 z-20">
                        <IconColorPicker
                          selectedIcon={icon}
                          selectedColor={color}
                          onIconChange={(v) => { setIcon(v); }}
                          onColorChange={(v) => { setColor(v); }}
                        />
                      </div>
                    )}
                  </div>
                  <input
                    ref={nameRef}
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Marketing, Engineering, HR"
                    maxLength={100}
                    className={`flex-1 bg-gray-50 dark:bg-gray-800 border dark:border-gray-905 dark:focus:border-gray-000 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none transition-colors text-sm ${nameError ? "border-red-500 focus:ring-1 focus:ring-red-500" : "border-gray-200 dark:border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"}`}
                  />
                </div>
                {nameError && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{nameError}</p>}
              </div>

              {/* Task ID Prefix */}
              <div>
                <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1">
                  Task ID Prefix
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">(2–6 chars, e.g. API, MKT)</span>
                </label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => handlePrefixChange(e.target.value)}
                  placeholder="e.g. MKT"
                  className={`w-full bg-gray-50 dark:bg-gray-800 border  dark:border-gray-905 dark:focus:border-gray-000  rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none transition-colors text-sm font-mono ${prefixError ? "border-red-500 focus:ring-1 focus:ring-red-500" : "border-gray-200 dark:border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"}`}
                />
                {prefixError && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{prefixError}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1">
                  Description <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full bg-gray-50 dark:bg-gray-800 border  dark:border-gray-905 dark:focus:border-gray-000  border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors text-sm resize-none"
                />
              </div>

              {/* Set at creation, so a private project is never briefly visible
                  workspace-wide the way a create-then-toggle flow would leave
                  it. Invite people afterwards from Sharing & Permissions. */}
              <div className="flex items-center justify-between gap-4 py-1">
                <div className="flex items-center gap-2.5">
                  {isPrivate ? (
                    <LuLock className="w-4 h-4 text-gray-400" />
                  ) : (
                    <LuLockOpen className="w-4 h-4 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm font-normal text-gray-800 dark:text-gray-200">
                      Make Private
                    </p>
                    <p className="text-xs text-gray-500">
                      {isPrivate
                        ? "Only you and invited members have access"
                        : "Everyone in the workspace will have access"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPrivate}
                  aria-label="Make this project private"
                  onClick={() => setIsPrivate((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    isPrivate ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      isPrivate ? "translate-x-5.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Only meaningful while private — a public project already grants
                  everyone access, so there would be nothing to choose. */}
              {isPrivate && (
                <div className="pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Who has access
                    </p>
                    <span className="text-[11px] text-gray-400">
                      {inviteIds.size > 0
                        ? `${inviteIds.size} selected`
                        : "Just you"}
                    </span>
                  </div>

                  {invitableMembers.length > 6 && (
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search people..."
                      className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  )}

                  <div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto">
                    {filteredMembers.length === 0 && (
                      <p className="py-3 text-center text-xs text-gray-400">
                        {invitableMembers.length === 0
                          ? "You're the only member of this workspace."
                          : "No one matches that search."}
                      </p>
                    )}
                    {filteredMembers.map((m) => {
                      const picked = inviteIds.has(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleInvite(m.id)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                            picked
                              ? "bg-brand-50 dark:bg-brand-900/20"
                              : "hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[10px] text-white">
                            {getInitials(m.fullName)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] text-gray-800 dark:text-gray-200">
                              {m.fullName}
                            </span>
                            <span className="block truncate text-[11px] text-gray-400">
                              {m.email}
                            </span>
                          </span>
                          {picked && (
                            <span className="shrink-0 text-[11px] font-medium text-brand-500">
                              Added
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    You can change this later in Sharing &amp; Permissions.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end px-6 py-4 mt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="submit"
                disabled={loading || !isNameValid || prefix.length < 2}
                className="px-6 py-2 rounded-xl bg-brand-500 text-white dark:bg-white dark:text-black text-sm font-normal hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ───────────── STEP 2: Statuses ───────────── */
        <div
          className="relative z-10 w-full max-w-[720px] mx-4 bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden max-h-[86vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <LuChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-normal text-gray-900 dark:text-white">Edit {titleName} statuses</h2>
            </div>
            <button
              onClick={onClose}
              className="ml-4 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[200px_1fr] overflow-hidden">
            {/* Left panel */}
            <div className="px-4 py-5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 shrink-0">
              <p className="text-sm font-normal text-gray-700 dark:text-gray-300 mb-2">Status template</p>
              <select
                disabled
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 appearance-none"
              >
                <option>Custom</option>
              </select>
            </div>

            {/* Right panel: groups */}
            <div className="overflow-y-auto px-5 py-5 space-y-6">
              {groups.map((group, groupIdx) => (
                <ProjectStatusGroupEditor
                  key={group.apiGroup}
                  group={group}
                  groupIdx={groupIdx}
                  addingToGroup={addingToGroup}
                  newStatusName={newStatusName}
                  newStatusColor={newStatusColor}
                  menuOpen={menuOpen}
                  colorPickerOpen={colorPickerOpen}
                  dragOver={dragOver}
                  addInputRef={addInputRef}
                  onStartAdd={() => {
                    setAddingToGroup(groupIdx);
                    setNewStatusName("");
                    setNewStatusColor(PROJECT_STATUS_COLOR_OPTIONS[0]);
                    setNewColorPickerOpen(true);
                  }}
                  onCancelAdd={() => { setAddingToGroup(null); setNewColorPickerOpen(false); }}
                  onNewNameChange={setNewStatusName}
                  onNewColorChange={setNewStatusColor}
                  newColorPickerOpen={newColorPickerOpen}
                  onNewColorPickerToggle={() => setNewColorPickerOpen((v) => !v)}
                  onNewColorPickerClose={() => setNewColorPickerOpen(false)}
                  onAddStatus={() => addStatus(groupIdx)}
                  onDeleteStatus={(tid) => deleteStatus(groupIdx, tid)}
                  onChangeColor={(tid, c) => changeStatusColor(groupIdx, tid, c)}
                  onMenuOpen={(tid) => { setMenuOpen(tid); setColorPickerOpen(null); }}
                  onMenuClose={() => setMenuOpen(null)}
                  onColorPickerOpen={(tid) => { setColorPickerOpen(tid); setMenuOpen(null); }}
                  onColorPickerClose={() => setColorPickerOpen(null)}
                  renamingTempId={renamingTempId}
                  renameValue={renameValue}
                  onStartRename={(tid, name) => startRename(tid, name)}
                  onRenameChange={setRenameValue}
                  onCommitRename={(tid) => commitRename(groupIdx, tid)}
                  pointerDragState={pointerDragState}
                  onPointerDragStart={(e, sIdx, h) => handlePointerDragStart(e, groupIdx, sIdx, h)}
                  onPointerDragMove={(e) => handlePointerDragMove(e, groupIdx)}
                  onPointerDragEnd={() => handlePointerDragEnd(groupIdx)}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <button type="button" className="text-sm text-gray-400 flex items-center gap-1.5 hover:text-gray-600 dark:hover:text-gray-200">
              <LuInfo className="w-4 h-4" />
              Learn more about statuses
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Save as template
              </button>
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={loading}
                className="px-6 py-2 rounded-xl bg-brand-500 text-white text-sm font-normal hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating..." : "Apply changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
