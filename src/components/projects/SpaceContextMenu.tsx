"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Project } from "@/services/project.service";
import { toast } from "sonner";
import IconColorPicker from "@/components/projects/IconColorPicker";
import {
  LuStar,
  LuPencil,
  LuLink,
  LuPalette,
  LuArchive,
  LuArchiveRestore,
  LuTrash2,
  LuUsers,
  LuChevronRight,
} from "react-icons/lu";

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  danger?: boolean;
  hasSubmenu?: boolean;
}

function MenuItem({ icon, label, description, onClick, danger, hasSubmenu }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full rounded-lg items-center gap-3 px-4 py-2 text-sm transition-colors
        ${danger
          ? "text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
          : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
    >
      <span className={`shrink-0 ${danger ? "text-red-500 dark:text-red-400" : "text-gray-400"}`}>{icon}</span>
      <span className="flex-1 text-left">
        <span className="block">{label}</span>
        {description && (
          <span className="block text-xs text-gray-400 dark:text-gray-500 font-normal leading-tight mt-0.5">
            {description}
          </span>
        )}
      </span>
      {hasSubmenu && <LuChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />}
    </button>
  );
}

interface Props {
  project: Project;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
  onIconColorChange: (icon: string | null, color: string) => void;
  onFavorite?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  /** Opens the Sharing & Permissions modal (visibility + project members). */
  onSharing?: () => void;
}

export default function SpaceContextMenu({
  project,
  triggerRef,
  isOpen,
  onClose,
  onEdit,
  onRename,
  onDelete,
  onIconColorChange,
  onFavorite,
  onArchive,
  onRestore,
  onSharing,
}: Props) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [pickerIcon, setPickerIcon] = useState<string | null>(project.icon ?? null);
  const [pickerColor, setPickerColor] = useState(project.color ?? "#6366f1");
  const panelRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPickerIcon(project.icon ?? null);
      setPickerColor(project.color ?? "#6366f1");
      setIconPickerOpen(false);
    }
  }, [isOpen, project.icon, project.color]);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = 288 + 4;

    const measure = () => {
      if (!panelRef.current) return;
      const menuHeight = panelRef.current.offsetHeight;
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - menuHeight - 8));
      setPosition({ top, left });
    };

    measure();
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inPanel = panelRef.current?.contains(target);
      const inPicker = pickerRef.current?.contains(target);
      if (!inPanel && !inPicker) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [isOpen, onClose]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/projects?projectId=${project.id}`);
    toast.success("Link copied");
    onClose();
  };

  const applyIconColor = () => {
    onIconColorChange(pickerIcon, pickerColor);
    setIconPickerOpen(false);
  };

  if (!isOpen) return null;

  const menu = (
    <>
      <div
        ref={panelRef}
        style={{ top: position.top, left: position.left }}
        className="fixed z-9999 w-64 bg-white dark:bg-gray-901 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl py-1.5 max-h-[calc(100vh-32px)] overflow-y-auto"
      >
        <MenuItem
          icon={<LuStar className="w-4 h-4" style={project.isFavorite ? { fill: "currentColor", color: "#f59e0b" } : undefined} />}
          label={project.isFavorite ? "Unfavorite" : "Favorite"}
          onClick={() => { onFavorite?.(); onClose(); }}
        />
        <MenuItem icon={<LuPencil className="w-4 h-4" />} label="Edit" onClick={onEdit} />
        <MenuItem icon={<LuPencil className="w-4 h-4" />} label="Rename" onClick={() => { onClose(); onRename(); }} />
        <MenuItem icon={<LuLink className="w-4 h-4" />} label="Copy link" onClick={handleCopyLink} />

        <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

        <MenuItem
          icon={<LuPalette className="w-4 h-4" />}
          label="Color & Icon"
          hasSubmenu
          onClick={() => setIconPickerOpen((v) => !v)}
        />

        <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

        <MenuItem
          icon={<LuUsers className="w-4 h-4" />}
          label="Sharing & Permissions"
          description={
            project.visibility === "PRIVATE" ? "Private" : "Everyone in workspace"
          }
          onClick={() => { onClose(); onSharing?.(); }}
        />

        <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

        {project.isArchived ? (
          <MenuItem
            icon={<LuArchiveRestore className="w-4 h-4" />}
            label="Restore"
            onClick={() => { onRestore?.(); onClose(); }}
          />
        ) : (
          <MenuItem
            icon={<LuArchive className="w-4 h-4" />}
            label="Archive"
            onClick={() => { onArchive?.(); onClose(); }}
          />
        )}
        <MenuItem icon={<LuTrash2 className="w-4 h-4" />} label="Delete" danger onClick={onDelete} />

        <div className="px-3 pt-2 pb-1">
          <button
            onClick={() => { onClose(); onSharing?.(); }}
            className="w-full py-2 rounded-xl bg-brand-500 text-white text-sm font-normal dark:bg-gray-000 dark:hover:bg-gray-200 dark:text-black hover:bg-brand-600 transition-colors"
          >
            Sharing &amp; Permissions
          </button>
        </div>
      </div>

      {/* Icon & Color picker floating panel */}
      {iconPickerOpen && (
        <div
          ref={pickerRef}
          style={{ top: position.top, left: position.left + 260 }}
          className="fixed z-9999"
        >
          <IconColorPicker
            selectedIcon={pickerIcon}
            selectedColor={pickerColor}
            onIconChange={(v) => setPickerIcon(v)}
            onColorChange={(v) => setPickerColor(v)}
          />
          <div className="flex justify-end gap-2 rounded-b-xl border border-t-0 border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setIconPickerOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyIconColor}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs text-white hover:bg-brand-600"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(menu, document.body);
}
