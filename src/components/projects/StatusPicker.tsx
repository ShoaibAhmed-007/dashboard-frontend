"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuSearch } from "react-icons/lu";
import { StatusItem } from "@/services/status.service";
import StatusIcon from "./StatusIcon";
import { useDropdownPosition } from "@/hooks/useDropdownPosition";

interface StatusPickerProps {
  statuses: StatusItem[];
  value: string | null | undefined;
  onChange: (statusId: string) => void;
  className?: string;
  align?: "left" | "right";
}

type GroupKey = "NOT_STARTED" | "ACTIVE" | "DONE" | "CLOSED";
const GROUP_LABELS: Record<GroupKey, string> = {
  NOT_STARTED: "Not Started",
  ACTIVE: "Active",
  DONE: "Done",
  CLOSED: "Closed",
};
const GROUP_ORDER: GroupKey[] = ["NOT_STARTED", "ACTIVE", "DONE", "CLOSED"];

export default function StatusPicker({ statuses, value, onChange, className = "", align = "left" }: StatusPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(btnRef, dropdownRef, open, { align });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen((v) => !v);
  };

  const current = statuses.find((s) => s.id === value);

  const filtered = search
    ? statuses.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : statuses;

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: filtered.filter((s) => s.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => handleOpen(e)}
        className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {current ? (
          <>
            <StatusIcon group={current.group} color={current.color} size={13} />
            <span style={{ color: current.color }}>{current.name}</span>
          </>
        ) : (
          <span className="text-gray-400">Set status</span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, maxHeight: pos.maxHeight, zIndex: 9999 }}
          className="w-52 flex flex-col rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 overflow-hidden"
        >
          <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1 dark:bg-gray-800">
              <LuSearch className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search status..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-gray-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                  {GROUP_LABELS[group as GroupKey]}
                </p>
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { onChange(s.id); setOpen(false); setSearch(""); }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${s.id === value ? "bg-gray-50 dark:bg-gray-800" : ""}`}
                  >
                    <StatusIcon group={s.group} color={s.color} size={13} />
                    <span style={{ color: s.color }}>{s.name}</span>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-gray-400">No statuses found</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
