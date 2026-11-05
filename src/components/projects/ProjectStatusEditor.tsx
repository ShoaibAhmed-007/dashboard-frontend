"use client";

import React, { useRef } from "react";
import { GroupedStatuses, StatusGroup } from "@/services/status.service";
import {
  LuCircleDashed,
  LuPlus,
  LuInfo,
  LuGripVertical,
  LuEllipsis,
  LuTrash2,
  LuPalette,
  LuPencil,
  LuCheck,
} from "react-icons/lu";
import { IoCheckmarkCircle } from "react-icons/io5";
import { IoMdRadioButtonOn } from "react-icons/io";

export const PROJECT_STATUS_COLOR_OPTIONS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e",
  "#eab308", "#f97316", "#ef4444", "#ec4899", "#8b5cf6",
  "#a16207", "#64748b",
];

type GroupIconType = "dashed" | "active" | "check";

export type LocalProjectStatus = {
  tempId: string;
  id?: string;
  name: string;
  color: string;
  isProtected: boolean;
};

export type LocalProjectStatusGroup = {
  title: string;
  apiGroup: StatusGroup;
  iconType: GroupIconType;
  statuses: LocalProjectStatus[];
  canAdd: boolean;
};

const DEFAULT_STATUS_GROUPS: LocalProjectStatusGroup[] = [
  {
    title: "Not started",
    apiGroup: "NOT_STARTED",
    iconType: "dashed",
    canAdd: true,
    statuses: [{ tempId: "default_todo", name: "To Do", color: "#94a3b8", isProtected: false }],
  },
  {
    title: "Active",
    apiGroup: "ACTIVE",
    iconType: "active",
    canAdd: true,
    statuses: [{ tempId: "default_inprogress", name: "In Progress", color: "#3b82f6", isProtected: false }],
  },
  {
    title: "Done",
    apiGroup: "DONE",
    iconType: "check",
    canAdd: true,
    statuses: [{ tempId: "default_review", name: "Review", color: "#f59e0b", isProtected: false }],
  },
  {
    title: "Closed",
    apiGroup: "CLOSED",
    iconType: "check",
    canAdd: false,
    statuses: [{ tempId: "default_completed", name: "Completed", color: "#22c55e", isProtected: true }],
  },
];

let localStatusCounter = 0;

export function nextLocalProjectStatusId() {
  localStatusCounter += 1;
  return `tmp_${localStatusCounter}`;
}

export function cloneLocalProjectStatusGroups(groups: LocalProjectStatusGroup[]) {
  return groups.map((group) => ({
    ...group,
    statuses: group.statuses.map((status) => ({ ...status })),
  }));
}

export function createDefaultProjectStatusGroups() {
  return cloneLocalProjectStatusGroups(DEFAULT_STATUS_GROUPS);
}

export function groupedStatusesToLocalProjectStatusGroups(grouped: GroupedStatuses) {
  const groupMap = grouped.groups;

  return DEFAULT_STATUS_GROUPS.map((group) => {
    const source =
      group.apiGroup === "NOT_STARTED"
        ? groupMap.notStarted
        : group.apiGroup === "ACTIVE"
        ? groupMap.active
        : group.apiGroup === "DONE"
        ? groupMap.done
        : groupMap.closed;

    return {
      ...group,
      statuses: source.map((status) => ({
        tempId: status.id,
        id: status.id,
        name: status.name,
        color: status.color,
        isProtected: status.isProtected,
      })),
    };
  });
}

function GroupIcon({
  iconType,
  color,
}: {
  iconType: GroupIconType;
  color: string;
}) {
  if (iconType === "dashed") {
    return <LuCircleDashed className="w-4 h-4 shrink-0" style={{ color }} />;
  }
  if (iconType === "active") {
    return <IoMdRadioButtonOn className="w-4 h-4 shrink-0" style={{ color }} />;
  }
  return <IoCheckmarkCircle className="w-4 h-4 shrink-0" style={{ color }} />;
}

interface ProjectStatusGroupEditorProps {
  group: LocalProjectStatusGroup;
  groupIdx: number;
  addingToGroup: number | null;
  newStatusName: string;
  newStatusColor: string;
  menuOpen: string | null;
  colorPickerOpen: string | null;
  dragOver: { groupIdx: number; statusIdx: number } | null;
  addInputRef: React.RefObject<HTMLInputElement | null>;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onNewNameChange: (value: string) => void;
  onNewColorChange: (value: string) => void;
  newColorPickerOpen: boolean;
  onNewColorPickerToggle: () => void;
  onNewColorPickerClose: () => void;
  onAddStatus: () => void;
  onDeleteStatus: (tempId: string) => void;
  onChangeColor: (tempId: string, color: string) => void;
  onMenuOpen: (tempId: string) => void;
  onMenuClose: () => void;
  onColorPickerOpen: (tempId: string) => void;
  onColorPickerClose: () => void;
  renamingTempId: string | null;
  renameValue: string;
  onStartRename: (tempId: string, currentName: string) => void;
  onRenameChange: (value: string) => void;
  onCommitRename: (tempId: string) => void;
  pointerDragState: { groupIdx: number; statusIdx: number; offsetY: number } | null;
  onPointerDragStart: (
    event: React.PointerEvent,
    statusIdx: number,
    itemHeight: number
  ) => void;
  onPointerDragMove: (event: React.PointerEvent) => void;
  onPointerDragEnd: () => void;
}

export function ProjectStatusGroupEditor({
  group,
  groupIdx,
  addingToGroup,
  newStatusName,
  newStatusColor,
  menuOpen,
  colorPickerOpen,
  renamingTempId,
  renameValue,
  newColorPickerOpen,
  onNewColorPickerToggle,
  onNewColorPickerClose,
  dragOver,
  pointerDragState,
  addInputRef,
  onStartAdd,
  onCancelAdd,
  onNewNameChange,
  onNewColorChange,
  onAddStatus,
  onDeleteStatus,
  onChangeColor,
  onMenuOpen,
  onMenuClose,
  onColorPickerOpen,
  onColorPickerClose,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onPointerDragStart,
  onPointerDragMove,
  onPointerDragEnd,
}: ProjectStatusGroupEditorProps) {
  const isAddingHere = addingToGroup === groupIdx;
  const isClosed = group.apiGroup === "CLOSED";
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragSlotSize = 46;

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-normal text-gray-700 dark:text-gray-200">{group.title}</p>
          <LuInfo className="w-3.5 h-3.5 text-gray-400" />
        </div>
        {group.canAdd && !isClosed && (
          <button
            type="button"
            onClick={onStartAdd}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <LuPlus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {group.statuses.map((status, statusIdx) => {
          const isMenuOpen = menuOpen === status.tempId;
          const isColorOpen = colorPickerOpen === status.tempId;
          const isThisDragging =
            pointerDragState?.groupIdx === groupIdx &&
            pointerDragState?.statusIdx === statusIdx;
          const isDragTarget =
            dragOver?.groupIdx === groupIdx &&
            dragOver?.statusIdx === statusIdx &&
            !isThisDragging;

          let extraMarginTop = 0;
          if (
            pointerDragState?.groupIdx === groupIdx &&
            dragOver?.groupIdx === groupIdx &&
            !isThisDragging
          ) {
            const from = pointerDragState.statusIdx;
            const to = dragOver.statusIdx;

            if (from < to && statusIdx > from && statusIdx <= to) {
              extraMarginTop = -dragSlotSize;
            }
            if (from > to && statusIdx >= to && statusIdx < from) {
              extraMarginTop = dragSlotSize;
            }
          }

          return (
            <div
              key={status.tempId}
              ref={(element) => {
                itemRefs.current[statusIdx] = element;
              }}
              onPointerMove={isThisDragging ? onPointerDragMove : undefined}
              onPointerUp={isThisDragging ? onPointerDragEnd : undefined}
              style={
                isThisDragging
                  ? {
                      transform: `translateY(${pointerDragState.offsetY}px)`,
                      zIndex: 50,
                      position: "relative",
                    }
                  : {
                      marginTop:
                        extraMarginTop !== 0 ? `${extraMarginTop}px` : undefined,
                      transition: "margin 150ms ease",
                    }
              }
              className={`flex items-center gap-2 h-10 rounded-xl border px-3 text-sm ${
                isThisDragging
                  ? "border-brand-400 shadow-lg bg-white dark:bg-gray-900 opacity-95"
                  : isDragTarget
                  ? "border-brand-300 bg-brand-50/50 dark:bg-brand-950/10"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              }`}
            >
              {!isClosed && (
                <div
                  className="shrink-0 cursor-grab active:cursor-grabbing"
                  onPointerDown={(event) => {
                    const itemHeight =
                      itemRefs.current[statusIdx]?.offsetHeight ?? 40;
                    onPointerDragStart(event, statusIdx, itemHeight);
                  }}
                >
                  <LuGripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                </div>
              )}

              <div className="relative shrink-0">
                {isClosed ? (
                  <GroupIcon iconType={group.iconType} color={status.color} />
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isColorOpen) {
                        onColorPickerClose();
                      } else {
                        onColorPickerOpen(status.tempId);
                      }
                    }}
                    className="flex items-center justify-center rounded hover:opacity-70 transition-opacity"
                    title="Change color"
                  >
                    <GroupIcon iconType={group.iconType} color={status.color} />
                  </button>
                )}

                {isColorOpen && (
                  <div
                    className="absolute left-0 top-6 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-52"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mb-2">
                      Color
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PROJECT_STATUS_COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            onChangeColor(status.tempId, color);
                            onColorPickerClose();
                          }}
                          className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                          style={{ backgroundColor: color }}
                        >
                          {status.color === color && (
                            <LuCheck className="w-3 h-3 text-white" />
                          )}
                        </button>
                      ))}
                      <label
                        className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                        title="Custom color"
                      >
                        <LuPlus className="w-3.5 h-3.5 text-gray-500" />
                        <input
                          type="color"
                          className="sr-only"
                          value={status.color}
                          onChange={(event) =>
                            onChangeColor(status.tempId, event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {renamingTempId === status.tempId ? (
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(event) => onRenameChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onCommitRename(status.tempId);
                    }
                    if (event.key === "Escape") {
                      onCommitRename(status.tempId);
                    }
                  }}
                  onBlur={() => onCommitRename(status.tempId)}
                  onClick={(event) => event.stopPropagation()}
                  className="flex-1 bg-transparent text-xs font-normal tracking-wide text-gray-800 dark:text-gray-100 focus:outline-none"
                />
              ) : (
                <span
                  className="flex-1 font-normal text-gray-800 dark:text-gray-100 truncate text-xs tracking-wide cursor-text"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartRename(status.tempId, status.name);
                  }}
                >
                  {status.name}
                </span>
              )}

              {renamingTempId === status.tempId &&
              renameValue.trim() &&
              renameValue.trim() !== status.name ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCommitRename(status.tempId);
                  }}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-500 text-white text-xs font-normal hover:bg-brand-600 transition-colors"
                >
                  Save
                  <span className="opacity-70 text-[10px]">↵</span>
                </button>
              ) : (
                <div className="relative ml-auto">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isMenuOpen) {
                        onMenuClose();
                      } else {
                        onMenuOpen(status.tempId);
                      }
                    }}
                    className="flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <LuEllipsis className="w-3.5 h-3.5" />
                  </button>

                  {isMenuOpen && (
                    <div
                      className="absolute right-0 top-7 z-50 w-44 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl py-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onMenuClose();
                          onStartRename(status.tempId, status.name);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <LuPencil className="w-3.5 h-3.5" />
                        Rename
                      </button>
                      {!isClosed && (
                        <button
                          type="button"
                          onClick={() => {
                            onMenuClose();
                            onColorPickerOpen(status.tempId);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <LuPalette className="w-3.5 h-3.5" />
                          Change color
                        </button>
                      )}
                      {!status.isProtected && !isClosed && (
                        <button
                          type="button"
                          onClick={() => onDeleteStatus(status.tempId)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <LuTrash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isAddingHere ? (
          <div
            className="flex items-center gap-2 h-10 rounded-xl border-2 border-brand-400 bg-white dark:bg-gray-900 px-3"
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(event.relatedTarget as Node) &&
                !newStatusName.trim()
              ) {
                onCancelAdd();
              }
            }}
          >
            <div className="shrink-0 opacity-0 pointer-events-none">
              <LuGripVertical className="w-3.5 h-3.5" />
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onNewColorPickerToggle();
                }}
                className="flex items-center justify-center rounded hover:opacity-70 transition-opacity"
                title="Choose color"
              >
                <GroupIcon iconType={group.iconType} color={newStatusColor} />
              </button>

              {newColorPickerOpen && (
                <div
                  className="absolute left-0 top-6 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-52"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <p className="text-xs font-normal text-gray-500 dark:text-gray-400 mb-2">
                    Color
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_STATUS_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onNewColorChange(color);
                          onNewColorPickerClose();
                          addInputRef.current?.focus();
                        }}
                        className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                        style={{ backgroundColor: color }}
                      >
                        {newStatusColor === color && (
                          <LuCheck className="w-3 h-3 text-white" />
                        )}
                      </button>
                    ))}
                    <label
                      className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                      title="Custom color"
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      <LuPlus className="w-3.5 h-3.5 text-gray-500" />
                      <input
                        type="color"
                        className="sr-only"
                        value={newStatusColor}
                        onChange={(event) => {
                          onNewColorChange(event.target.value);
                          onNewColorPickerClose();
                          addInputRef.current?.focus();
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={addInputRef}
              type="text"
              value={newStatusName}
              onChange={(event) => onNewNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAddStatus();
                }
                if (event.key === "Escape") {
                  onCancelAdd();
                }
              }}
              placeholder="Status name..."
              className="flex-1 bg-transparent text-xs font-normal tracking-wide text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
            />

            {newStatusName.trim() && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onAddStatus}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-500 text-white text-xs font-normal hover:bg-brand-600 transition-colors"
              >
                Save
                <span className="opacity-70 text-[10px]">↵</span>
              </button>
            )}
          </div>
        ) : (
          group.canAdd &&
          !isClosed && (
            <button
              type="button"
              onClick={onStartAdd}
              className="w-full h-10 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-sm flex items-center justify-center gap-2 hover:border-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <LuPlus className="w-3.5 h-3.5" />
              Add status
            </button>
          )
        )}
      </div>
    </div>
  );
}
