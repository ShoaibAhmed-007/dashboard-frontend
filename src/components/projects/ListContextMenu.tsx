"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TaskList } from "@/services/task-list.service";
import { LuArchive, LuPencil, LuRotateCcw, LuTrash2 } from "react-icons/lu";

interface ListContextMenuProps {
  list: TaskList;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  onRename: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete: () => void;
}

function MenuAction({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
      }`}
    >
      <span className={danger ? "text-red-500 dark:text-red-400" : "text-gray-400"}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export default function ListContextMenu({
  list,
  triggerRef,
  isOpen,
  onClose,
  onRename,
  onArchive,
  onRestore,
  onDelete,
}: ListContextMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const measure = () => {
      const menuWidth = panelRef.current?.offsetWidth ?? 224;
      const menuHeight = panelRef.current?.offsetHeight ?? 180;
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - menuHeight - 8));
      const left = Math.max(
        8,
        Math.min(rect.right + 8, window.innerWidth - menuWidth - 8)
      );
      setPosition({ top, left });
    };

    measure();
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    return () => document.removeEventListener("mousedown", handleMouseDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: position.top, left: position.left }}
      className="fixed z-[10000] w-56 rounded-2xl border border-gray-200 bg-white py-1.5 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
        <p className="truncate text-sm font-normal text-gray-900 dark:text-white">{list.name}</p>
      </div>

      <MenuAction
        icon={<LuPencil className="h-4 w-4" />}
        label="Rename"
        onClick={() => {
          onClose();
          onRename();
        }}
      />

      {list.isArchived ? (
        <MenuAction
          icon={<LuRotateCcw className="h-4 w-4" />}
          label="Restore"
          onClick={() => {
            onClose();
            onRestore?.();
          }}
        />
      ) : (
        <MenuAction
          icon={<LuArchive className="h-4 w-4" />}
          label="Archive"
          onClick={() => {
            onClose();
            onArchive?.();
          }}
        />
      )}

      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

      <MenuAction
        icon={<LuTrash2 className="h-4 w-4" />}
        label="Delete"
        danger
        onClick={() => {
          onClose();
          onDelete();
        }}
      />
    </div>,
    document.body
  );
}
