"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useOptionalProjects } from "@/context/ProjectContext";
import { Project } from "@/services/project.service";
import { statusService } from "@/services/status.service";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { syncProjectStatuses } from "@/components/projects/project-status-sync";
import {
  createDefaultProjectStatusGroups,
  groupedStatusesToLocalProjectStatusGroups,
  LocalProjectStatusGroup,
  nextLocalProjectStatusId,
  ProjectStatusGroupEditor,
  PROJECT_STATUS_COLOR_OPTIONS,
} from "@/components/projects/ProjectStatusEditor";
import { toast } from "sonner";
import {
  LuX,
  LuLock,
  LuLockOpen,
  LuChevronLeft,
  LuInfo,
} from "react-icons/lu";

type EditStep = "details" | "statuses";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  /** Closes this modal and opens Sharing & Permissions, where visibility and
   *  project members are actually managed. */
  onManageSharing?: () => void;
}

export default function EditSpaceModal({ isOpen, onClose, project, onManageSharing }: Props) {
  const { updateProject, refetch } = useOptionalProjects();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<EditStep>("details");
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [color, setColor] = useState(project.color);
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalContainerRef, isOpen);

  const [groups, setGroups] = useState<LocalProjectStatusGroup[]>(() =>
    createDefaultProjectStatusGroups()
  );
  const [addingToGroup, setAddingToGroup] = useState<number | null>(null);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState(
    PROJECT_STATUS_COLOR_OPTIONS[0]
  );
  const [newColorPickerOpen, setNewColorPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [renamingTempId, setRenamingTempId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragOver, setDragOver] = useState<{
    groupIdx: number;
    statusIdx: number;
  } | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
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
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    setStep("details");
    setName(project.name);
    setDescription(project.description ?? "");
    setColor(project.color);
    setNameError("");
    setLoading(false);
    setStatusLoading(true);
    setStatusError("");
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

    void (async () => {
      try {
        const grouped = await statusService.list(project.id);
        if (cancelled) {
          return;
        }
        setGroups(groupedStatusesToLocalProjectStatusGroups(grouped));
      } catch (error) {
        if (cancelled) {
          return;
        }
        const { message } = parseApiError(error);
        setStatusError(message);
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, project]);

  useEffect(() => {
    if (addingToGroup !== null) {
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [addingToGroup]);

  const handleNameChange = (value: string) => {
    setName(value);
    const trimmed = value.trim();
    setNameError(
      trimmed.length > 0 && trimmed.length < 2
        ? "Name must be at least 2 characters"
        : ""
    );
  };

  const handleDetailsSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setNameError("Name must be at least 2 characters");
      return;
    }
    setStep("statuses");
  };

  const addStatus = (groupIdx: number) => {
    const trimmed = newStatusName.trim();
    setNewColorPickerOpen(false);
    if (!trimmed) {
      setAddingToGroup(null);
      return;
    }

    setGroups((prev) =>
      prev.map((group, index) =>
        index === groupIdx
          ? {
              ...group,
              statuses: [
                ...group.statuses,
                {
                  tempId: nextLocalProjectStatusId(),
                  name: trimmed,
                  color: newStatusColor,
                  isProtected: false,
                },
              ],
            }
          : group
      )
    );
    setNewStatusName("");
    setNewStatusColor(PROJECT_STATUS_COLOR_OPTIONS[0]);
    setAddingToGroup(null);
  };

  const deleteStatus = (groupIdx: number, tempId: string) => {
    setGroups((prev) =>
      prev.map((group, index) =>
        index === groupIdx
          ? {
              ...group,
              statuses: group.statuses.filter((status) => status.tempId !== tempId),
            }
          : group
      )
    );
    setMenuOpen(null);
  };

  const changeStatusColor = (
    groupIdx: number,
    tempId: string,
    nextColor: string
  ) => {
    setGroups((prev) =>
      prev.map((group, index) =>
        index === groupIdx
          ? {
              ...group,
              statuses: group.statuses.map((status) =>
                status.tempId === tempId
                  ? { ...status, color: nextColor }
                  : status
              ),
            }
          : group
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
        prev.map((group, index) =>
          index === groupIdx
            ? {
                ...group,
                statuses: group.statuses.map((status) =>
                  status.tempId === tempId
                    ? { ...status, name: trimmed }
                    : status
                ),
              }
            : group
        )
      );
    }
    setRenamingTempId(null);
    setRenameValue("");
  };

  const handlePointerDragStart = useCallback(
    (
      event: React.PointerEvent,
      groupIdx: number,
      statusIdx: number,
      itemHeight: number
    ) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerDragRef.current = {
        groupIdx,
        statusIdx,
        startY: event.clientY,
        currentY: event.clientY,
        itemHeight,
      };
      setPointerDragState({ groupIdx, statusIdx, offsetY: 0 });
    },
    []
  );

  const handlePointerDragMove = useCallback(
    (event: React.PointerEvent, groupIdx: number) => {
      const drag = pointerDragRef.current;
      if (!drag || drag.groupIdx !== groupIdx) {
        return;
      }

      const offsetY = event.clientY - drag.startY;
      drag.currentY = event.clientY;
      setPointerDragState({ groupIdx, statusIdx: drag.statusIdx, offsetY });

      const slotSize = drag.itemHeight + 6;
      const hoverIdx = Math.round(drag.statusIdx + offsetY / slotSize);
      const groupLength = groups[groupIdx]?.statuses.length ?? 0;
      const clamped = Math.max(0, Math.min(groupLength - 1, hoverIdx));
      setDragOver({ groupIdx, statusIdx: clamped });
    },
    [groups]
  );

  const handlePointerDragEnd = useCallback(
    (groupIdx: number) => {
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
          prev.map((group, index) => {
            if (index !== groupIdx) {
              return group;
            }
            const statuses = [...group.statuses];
            const [moved] = statuses.splice(from, 1);
            statuses.splice(to, 0, moved);
            return { ...group, statuses };
          })
        );
      }
    },
    [dragOver]
  );

  const handleSaveChanges = async () => {
    if (statusLoading) {
      return;
    }

    setLoading(true);
    try {
      const trimmedName = name.trim();
      const trimmedDescription = description.trim();
      const projectPayload: {
        name?: string;
        description?: string | null;
        color?: string;
      } = {};

      if (trimmedName !== project.name) {
        projectPayload.name = trimmedName;
      }
      if (trimmedDescription !== (project.description ?? "")) {
        projectPayload.description = trimmedDescription || null;
      }
      if (color !== project.color) {
        projectPayload.color = color;
      }

      const initialGroupedStatuses = await statusService.list(project.id);
      await syncProjectStatuses(project.id, initialGroupedStatuses, groups);
      // Statuses were just edited — drop the shared cache so the board/task
      // views pick up the changes (they now hold statuses for up to 5 min).
      await queryClient.invalidateQueries({ queryKey: queryKeys.statuses(project.id) });

      if (Object.keys(projectPayload).length > 0) {
        await updateProject(project.id, projectPayload);
      }

      await refetch();
      toast.success(`Project "${trimmedName}" updated`);
      onClose();
    } catch (error) {
      const { message } = parseApiError(error);
      await refetch();
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const initial =
    name.trim().charAt(0).toUpperCase() || project.name.charAt(0).toUpperCase();
  const titleName = name.trim() || project.name;
  const isNameValid = name.trim().length >= 2;

  const modal = (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-9999 flex items-center justify-center"
      onClick={() => {
        setMenuOpen(null);
        setColorPickerOpen(null);
      }}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {step === "details" ? (
        <div className="relative z-10 w-full max-w-[760px] mx-4 bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-start justify-between px-6 pt-6 pb-4">
            <div>
              <h2 className="text-lg font-normal text-gray-900 dark:text-white">
                Edit Project
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                A Project represents teams, departments, or groups, each with its
                own Lists, workflows, and settings.
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
              <div>
                <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-2">
                  Icon &amp; name
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-normal cursor-pointer shrink-0 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: color }}
                    >
                      {initial}
                    </div>
                    <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-wrap gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-2 w-36 z-10 shadow-xl">
                      {PROJECT_STATUS_COLOR_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setColor(option)}
                          className="w-6 h-6 rounded-lg transition-transform hover:scale-110"
                          style={{ backgroundColor: option }}
                        />
                      ))}
                    </div>
                  </div>
                  <input
                    ref={nameRef}
                    type="text"
                    value={name}
                    onChange={(event) => handleNameChange(event.target.value)}
                    placeholder="e.g. Marketing, Engineering, HR"
                    maxLength={100}
                    className={`flex-1 bg-gray-50 dark:bg-gray-800 border rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none transition-colors text-sm ${
                      nameError
                        ? "border-red-500 focus:ring-1 focus:ring-red-500"
                        : "border-gray-200 dark:border-gray-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    }`}
                  />
                </div>
                {nameError && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    {nameError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1">
                  Task ID Prefix
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">
                    (cannot be changed)
                  </span>
                </label>
                <input
                  type="text"
                  value={project.taskIdPrefix}
                  readOnly
                  className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-400 dark:text-gray-500 text-sm font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1">
                  Description{" "}
                  <span className="text-gray-400 dark:text-gray-500 font-normal">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors text-sm resize-none"
                />
              </div>

              {/* Read-only here on purpose. This form's submit builds a
                  diff-only payload for PATCH /projects/:id, which has no
                  `visibility` field — that lives on its own creator-only route.
                  A live toggle here would either need a second request with its
                  own 403 path, or would 403 an ordinary rename by a non-creator.
                  Sharing & Permissions is the one place it changes. */}
              <div className="flex items-center justify-between gap-4 py-1">
                <div className="flex items-center gap-2.5">
                  {project.visibility === "PRIVATE" ? (
                    <LuLock className="w-4 h-4 text-gray-400" />
                  ) : (
                    <LuLockOpen className="w-4 h-4 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm font-normal text-gray-800 dark:text-gray-200">
                      {project.visibility === "PRIVATE" ? "Private" : "Open to workspace"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {project.visibility === "PRIVATE"
                        ? "Only you and invited members have access"
                        : "Everyone in the workspace has access"}
                    </p>
                  </div>
                </div>
                {onManageSharing && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onManageSharing();
                    }}
                    className="shrink-0 text-xs font-medium text-brand-500 hover:text-brand-600"
                  >
                    Manage sharing
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 mt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="submit"
                disabled={loading || !isNameValid}
                className="px-6 py-2 rounded-xl bg-brand-500 text-white text-sm font-normal hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div
          className="relative z-10 w-full max-w-[720px] mx-4 bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden max-h-[86vh] flex flex-col"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <LuChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-normal text-gray-900 dark:text-white">
                Edit {titleName} statuses
              </h2>
            </div>
            <button
              onClick={onClose}
              className="ml-4 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[200px_1fr] overflow-hidden">
            <div className="px-4 py-5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 shrink-0">
              <p className="text-sm font-normal text-gray-700 dark:text-gray-300 mb-2">
                Status template
              </p>
              <select
                disabled
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 appearance-none"
              >
                <option>Custom</option>
              </select>
            </div>

            <div className="overflow-y-auto px-5 py-5 space-y-6">
              {statusLoading ? (
                <div className="flex min-h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading statuses...
                </div>
              ) : statusError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                  {statusError}
                </div>
              ) : (
                groups.map((group, groupIdx) => (
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
                    onCancelAdd={() => {
                      setAddingToGroup(null);
                      setNewColorPickerOpen(false);
                    }}
                    onNewNameChange={setNewStatusName}
                    onNewColorChange={setNewStatusColor}
                    newColorPickerOpen={newColorPickerOpen}
                    onNewColorPickerToggle={() =>
                      setNewColorPickerOpen((value) => !value)
                    }
                    onNewColorPickerClose={() => setNewColorPickerOpen(false)}
                    onAddStatus={() => addStatus(groupIdx)}
                    onDeleteStatus={(tempId) => deleteStatus(groupIdx, tempId)}
                    onChangeColor={(tempId, nextColor) =>
                      changeStatusColor(groupIdx, tempId, nextColor)
                    }
                    onMenuOpen={(tempId) => {
                      setMenuOpen(tempId);
                      setColorPickerOpen(null);
                    }}
                    onMenuClose={() => setMenuOpen(null)}
                    onColorPickerOpen={(tempId) => {
                      setColorPickerOpen(tempId);
                      setMenuOpen(null);
                    }}
                    onColorPickerClose={() => setColorPickerOpen(null)}
                    renamingTempId={renamingTempId}
                    renameValue={renameValue}
                    onStartRename={(tempId, currentName) =>
                      startRename(tempId, currentName)
                    }
                    onRenameChange={setRenameValue}
                    onCommitRename={(tempId) => commitRename(groupIdx, tempId)}
                    pointerDragState={pointerDragState}
                    onPointerDragStart={(event, statusIdx, itemHeight) =>
                      handlePointerDragStart(event, groupIdx, statusIdx, itemHeight)
                    }
                    onPointerDragMove={(event) =>
                      handlePointerDragMove(event, groupIdx)
                    }
                    onPointerDragEnd={() => handlePointerDragEnd(groupIdx)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <button
              type="button"
              className="text-sm text-gray-400 flex items-center gap-1.5 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <LuInfo className="w-4 h-4" />
              Learn more about statuses
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-400 dark:text-gray-500 disabled:cursor-not-allowed"
              >
                Save as template
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={loading || statusLoading || Boolean(statusError)}
                className="px-6 py-2 rounded-xl bg-brand-500 text-white text-sm font-normal hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Saving..." : "Apply changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
