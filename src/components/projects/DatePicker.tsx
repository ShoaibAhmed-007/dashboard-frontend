"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuCalendarPlus, LuChevronLeft, LuChevronRight, LuX } from "react-icons/lu";
import { useDropdownPosition } from "@/hooks/useDropdownPosition";

interface DateRange {
  startDate: string | null;
  dueDate: string | null;
}

interface DatePickerProps {
  startDate: string | null | undefined;
  dueDate: string | null | undefined;
  onChange: (range: DateRange) => void;
  align?: "left" | "right";
  iconSize?: "sm" | "md";
  showLabel?: boolean;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function toLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildCalendar(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function DatePicker({ startDate, dueDate, onChange, align = "left", iconSize = "md", showLabel = false }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(btnRef, dropdownRef, open, { align });
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [localStart, setLocalStart] = useState<string>(toLocal(startDate));
  const [localDue, setLocalDue] = useState<string>(toLocal(dueDate));
  const [selecting, setSelecting] = useState<"start" | "due">("due");

  useEffect(() => {
    setLocalStart(toLocal(startDate));
    setLocalDue(toLocal(dueDate));
  }, [startDate, dueDate]);

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

  const weeks = buildCalendar(viewYear, viewMonth);

  const handleDayClick = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    let ns = localStart, nd = localDue;
    if (selecting === "start") {
      ns = iso;
      if (localDue && iso > localDue) nd = "";
    } else {
      nd = iso;
      if (localStart && iso < localStart) ns = "";
    }
    setLocalStart(ns);
    setLocalDue(nd);
    onChange({
      startDate: ns ? `${ns}T00:00:00.000Z` : null,
      dueDate: nd ? `${nd}T00:00:00.000Z` : null,
    });
    setSelecting(selecting === "start" ? "due" : "start");
  };

  const isInRange = (day: number): boolean => {
    if (!localStart || !localDue) return false;
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return iso > localStart && iso < localDue;
  };

  const isSelected = (day: number): "start" | "due" | null => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (iso === localStart) return "start";
    if (iso === localDue) return "due";
    return null;
  };

  const isToday = (day: number): boolean =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const hasDate = localStart || localDue;

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => handleOpen(e)}
        className={`flex items-center gap-1.5 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-800 ${iconSize === "sm" ? "p-1" : "px-1.5 py-1"}`}
        title="Due date"
      >
        <LuCalendarPlus className={`text-gray-600 ${iconSize === "sm" ? "h-3 w-3" : "h-4 w-4"}`} />
        {localDue ? (
          <span className="text-gray-600 dark:text-gray-300">{formatDisplay(localDue)}</span>
        ) : localStart ? (
          <span className="text-gray-400">Start: {formatDisplay(localStart)}</span>
        ) : showLabel ? (
          <span className="text-xs text-gray-600">Add dates</span>
        ) : null}
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, maxHeight: pos.maxHeight, zIndex: 9999 }}
          className="w-72 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 overflow-y-auto"
        >
          {/* Selecting toggle */}
          <div className="flex gap-2 border-b border-gray-100 p-3 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setSelecting("start")}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${selecting === "start" ? "border-brand-500 text-brand-600" : "border-gray-200 text-gray-400 dark:border-gray-700"}`}
            >
              Start: {localStart ? formatDisplay(localStart) : "None"}
            </button>
            <button
              type="button"
              onClick={() => setSelecting("due")}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${selecting === "due" ? "border-brand-500 text-brand-600" : "border-gray-200 text-gray-400 dark:border-gray-700"}`}
            >
              Due: {localDue ? formatDisplay(localDue) : "None"}
            </button>
          </div>

          {/* Calendar */}
          <div className="p-3">
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => { const d = new Date(viewYear, viewMonth - 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }}>
                <LuChevronLeft className="h-4 w-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
              </button>
              <span className="text-sm font-medium text-gray-800 dark:text-white">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button type="button" onClick={() => { const d = new Date(viewYear, viewMonth + 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }}>
                <LuChevronRight className="h-4 w-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {DAYS.map((d) => (
                <span key={d} className="py-1 text-[10px] font-medium text-gray-400">{d}</span>
              ))}
              {weeks.map((week, wi) =>
                week.map((day, di) => {
                  if (!day) return <span key={`${wi}-${di}`} />;
                  const sel = isSelected(day);
                  const inRange = isInRange(day);
                  const todayMark = isToday(day);
                  return (
                    <button
                      key={`${wi}-${di}`}
                      type="button"
                      onClick={() => handleDayClick(day)}
                      className={`rounded-lg py-1 text-xs transition-colors ${
                        sel
                          ? "bg-brand-500 text-white font-medium"
                          : inRange
                          ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                          : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                      } ${todayMark && !sel ? "font-semibold ring-1 ring-inset ring-brand-500 text-brand-600 dark:text-brand-400" : ""}`}
                      title={todayMark ? "Today" : undefined}
                    >
                      {day}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {hasDate && (
            <div className="border-t border-gray-100 p-2 dark:border-gray-800">
              <button
                type="button"
                onClick={() => { setLocalStart(""); setLocalDue(""); onChange({ startDate: null, dueDate: null }); }}
                className="flex w-full items-center justify-center gap-1 py-1 text-xs text-gray-400 hover:text-red-500"
              >
                <LuX className="h-3 w-3" /> Clear dates
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
