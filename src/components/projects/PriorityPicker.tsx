"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import { GrFlagFill } from "react-icons/gr";
import { TaskPriority } from "@/services/task.service";
import { useDropdownPosition } from "@/hooks/useDropdownPosition";

interface PriorityOption {
  value: TaskPriority;
  label: string;
  color: string;
}

const OPTIONS: PriorityOption[] = [
  { value: "URGENT", label: "Urgent", color: "#ef4444" },
  { value: "HIGH", label: "High", color: "#f97316" },
  { value: "NORMAL", label: "Normal", color: "#3b82f6" },
  { value: "LOW", label: "Low", color: "#94a3b8" },
];

export function getPriorityColor(priority: TaskPriority | null | undefined): string {
  if (!priority || priority === "NONE") return "#94a3b8";
  return OPTIONS.find((o) => o.value === priority)?.color ?? "#94a3b8";
}

export function getPriorityLabel(priority: TaskPriority | null | undefined): string {
  if (!priority || priority === "NONE") return "Priority";
  return OPTIONS.find((o) => o.value === priority)?.label ?? "Priority";
}

interface PriorityPickerProps {
  value: TaskPriority | null | undefined;
  onChange: (value: TaskPriority) => void;
  onClear?: () => void;
  iconSize?: "sm" | "md";
  showLabel?: boolean;
}

export default function PriorityPicker({ value, onChange, onClear, iconSize = "md", showLabel = false }: PriorityPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(btnRef, dropdownRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = ref.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideTrigger && !insideDropdown) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen((v) => !v);
  };

  const current = value && value !== "NONE" ? OPTIONS.find((o) => o.value === value) : null;

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => handleOpen(e)}
        className={`flex items-center gap-1.5 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-800 ${iconSize === "sm" ? "p-1" : "px-1.5 py-1"}`}
        title={current ? current.label : "Set priority"}
      >
        <GrFlagFill
          className={iconSize === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"}
          style={{ color: current ? current.color : "#4b5563" }}
        />
        {current ? (
          <span style={{ color: current.color }}>{current.label}</span>
        ) : showLabel ? (
          <span className="text-xs text-gray-600">Add priority</span>
        ) : null}
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, maxHeight: pos.maxHeight, zIndex: 9999 }}
          className="w-36 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 overflow-y-auto"
        >
          <div className="py-1">
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${value === opt.value ? "font-medium" : ""}`}
              >
                <GrFlagFill className="h-3 w-3 shrink-0" style={{ color: opt.color }} />
                <span style={{ color: opt.color }}>{opt.label}</span>
              </button>
            ))}
            {current && onClear && (
              <button
                type="button"
                onClick={() => { onClear(); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <LuX className="h-3.5 w-3.5 shrink-0" />
                Clear
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
