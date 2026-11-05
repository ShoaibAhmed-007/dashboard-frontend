"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import flatpickr from "flatpickr";
import { toast } from "sonner";
import {
  LuCalendarDays,
  LuCalendarRange,
  LuClock3,
  LuSunrise,
} from "react-icons/lu";

interface SnoozePopoverProps {
  notificationId: string;
  anchorRect: DOMRect;
  onClose: () => void;
  onSnooze: (id: string, until?: string) => void;
}

interface QuickOption {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  getDate: () => Date;
}

const DEFAULT_MORNING_HOUR = 8;
const POPOVER_WIDTH = 258;
const VIEWPORT_GUTTER = 12;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function atHour(base: Date, hour: number, minute = 0): Date {
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function tomorrowAtMorning(): Date {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return atHour(next, DEFAULT_MORNING_HOUR);
}

function inTwoDaysAtMorning(): Date {
  const next = new Date();
  next.setDate(next.getDate() + 2);
  return atHour(next, DEFAULT_MORNING_HOUR);
}

function nextWeekAtMorning(): Date {
  const next = new Date();
  const day = next.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  next.setDate(next.getDate() + daysUntilMonday);
  return atHour(next, DEFAULT_MORNING_HOUR);
}

const QUICK_OPTIONS: QuickOption[] = [
  { label: "In 20 minutes", icon: LuClock3, getDate: () => addMinutes(new Date(), 20) },
  { label: "In 2 hours", icon: LuClock3, getDate: () => addHours(new Date(), 2) },
  { label: "Tomorrow", icon: LuSunrise, getDate: tomorrowAtMorning },
  { label: "In 2 days", icon: LuCalendarDays, getDate: inTwoDaysAtMorning },
  { label: "Next week", icon: LuCalendarRange, getDate: nextWeekAtMorning },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatTimeInputValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseTimeValue(value: string): { hours: number; minutes: number } {
  const [hours, minutes] = value.split(":").map(Number);
  return {
    hours: Number.isFinite(hours) ? hours : DEFAULT_MORNING_HOUR,
    minutes: Number.isFinite(minutes) ? minutes : 0,
  };
}

function combineDateAndTime(date: Date, timeValue: string): Date {
  const next = new Date(date);
  const { hours, minutes } = parseTimeValue(timeValue);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function formatQuickOptionDate(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDisplayDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitialCalendarDate(): Date {
  return tomorrowAtMorning();
}

function getTodaySelection(): Date {
  const next = addMinutes(new Date(), 30);
  next.setSeconds(0, 0);
  return next;
}

function getPopoverPosition(
  anchorRect: DOMRect,
  width: number,
  popoverHeight: number,
): { top: number; left: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // Prefer aligning right edge of popover with right edge of anchor
  let left = anchorRect.right - width;
  left = Math.min(left, vw - width - VIEWPORT_GUTTER);
  left = Math.max(VIEWPORT_GUTTER, left);

  // Prefer opening below; flip above if it would clip the viewport
  const spaceBelow = vh - anchorRect.bottom - VIEWPORT_GUTTER;
  const spaceAbove = anchorRect.top - VIEWPORT_GUTTER;
  let top: number;
  if (spaceBelow >= popoverHeight || spaceBelow >= spaceAbove) {
    top = anchorRect.bottom + 8;
  } else {
    top = anchorRect.top - popoverHeight - 8;
  }
  top = Math.max(VIEWPORT_GUTTER, Math.min(top, vh - popoverHeight - VIEWPORT_GUTTER));

  return { top, left };
}

export default function SnoozePopover({ notificationId, anchorRect, onClose, onSnooze }: SnoozePopoverProps) {
  const initialDate = getInitialCalendarDate();
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [timeValue, setTimeValue] = useState(formatTimeInputValue(initialDate));
  const [selectedQuick, setSelectedQuick] = useState<string | null>("Tomorrow");
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const calendarInputRef = useRef<HTMLInputElement>(null);
  const calendarInstanceRef = useRef<flatpickr.Instance | null>(null);

  useEffect(() => {
    const input = calendarInputRef.current;
    if (!input) return;

    const instance = flatpickr(input, {
      inline: true,
      static: true,
      monthSelectorType: "static",
      defaultDate: initialDate,
      minDate: "today",
      clickOpens: false,
      prevArrow:
        "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='m15 18-6-6 6-6'/></svg>",
      nextArrow:
        "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='m9 18 6-6-6-6'/></svg>",
      onChange: (dates) => {
        const nextDate = dates[0];
        if (!nextDate) return;
        setSelectedQuick(null);
        setSelectedDate((current) => {
          const base = current ?? initialDate;
          const merged = new Date(nextDate);
          merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
          return merged;
        });
      },
    });

    calendarInstanceRef.current = Array.isArray(instance) ? null : instance;

    return () => {
      if (calendarInstanceRef.current) {
        calendarInstanceRef.current.destroy();
        calendarInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (!selectedDate) return;
    const merged = combineDateAndTime(selectedDate, timeValue);
    setSelectedDate(merged);
  }, [timeValue]);

  useEffect(() => {
    if (!calendarInstanceRef.current || !selectedDate) return;
    calendarInstanceRef.current.setDate(selectedDate, false);
  }, [selectedDate]);

  // Measure real rendered height and compute smart position
  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight || 400;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
      const w = Math.min(POPOVER_WIDTH, vw - VIEWPORT_GUTTER * 2);
      setPosition(getPopoverPosition(anchorRect, w, h));
    };
    measure();
    // Re-measure after flatpickr calendar renders (it paints async)
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [anchorRect]);

  const handleQuickSelect = (option: QuickOption) => {
    const next = option.getDate();
    setSelectedQuick(option.label);
    setSelectedDate(next);
    setTimeValue(formatTimeInputValue(next));
  };

  const handleConfirm = () => {
    const nextDate = combineDateAndTime(selectedDate, timeValue);
    if (Number.isNaN(nextDate.getTime()) || nextDate <= new Date()) {
      toast.error("Snooze time must be in the future");
      return;
    }

    onSnooze(notificationId, nextDate.toISOString());
    onClose();
  };

  const popoverWidth = typeof window !== "undefined"
    ? Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_GUTTER * 2)
    : POPOVER_WIDTH;

  const content = (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 9999,
        width: popoverWidth,
        // Hidden off-screen until measured so it doesn't flash in wrong position
        visibility: position.top === -9999 ? "hidden" : "visible",
      }}
      className="snooze-popover rounded-[14px] border border-gray-200 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.1)] overflow-hidden"
    >
      <div className="border-b border-gray-100 px-1.5 pt-1.5 pb-1">
        <div className="rounded-[10px] border border-brand-400/70 bg-white px-2 py-1.5 shadow-[0_0_0_2px_rgba(70,95,255,0.08)]">
          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-gray-400">Snooze until</div>
          <div className={`mt-0.5 truncate text-[11px] ${selectedDate ? "text-gray-800" : "text-gray-400"}`}>
            {selectedDate ? formatDisplayDate(combineDateAndTime(selectedDate, timeValue)) : "Choose a snooze time"}
          </div>
        </div>
      </div>

      <div className="px-1 py-1">
        {QUICK_OPTIONS.map((option) => {
          const preview = option.getDate();
          const Icon = option.icon;
          const isActive = selectedQuick === option.label;

          return (
            <button
              key={option.label}
              onClick={() => handleQuickSelect(option)}
              className={`flex w-full items-center gap-1.5 rounded-[10px] px-1.5 py-1 text-left transition-colors ${
                isActive ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${isActive ? "bg-brand-100" : "bg-gray-100 text-gray-500"}`}>
                <Icon className="h-2.5 w-2.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium">{option.label}</span>
              </span>
              <span className={`text-[10px] ${isActive ? "text-brand-500" : "text-gray-400"}`}>
                {formatQuickOptionDate(preview)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t border-gray-100 px-1.5 pt-1.5 pb-1">
        <div className="mb-1.5 flex items-center justify-between gap-1.5">
          <div className="text-[11px] font-medium text-gray-800">Pick a date</div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const next = getTodaySelection();
                setSelectedQuick(null);
                setSelectedDate(next);
                setTimeValue(formatTimeInputValue(next));
              }}
              className="text-[9px] font-medium text-gray-400 transition-colors hover:text-brand-500"
            >
              Today
            </button>
            <input
              type="time"
              value={timeValue}
              onChange={(event) => {
                setSelectedQuick(null);
                setTimeValue(event.target.value);
              }}
              className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[9px] text-gray-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15"
            />
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[9px] font-medium text-white transition-colors hover:bg-brand-600"
            >
              Set
            </button>
          </div>
        </div>

        <div className="snooze-calendar-shell">
          <input ref={calendarInputRef} aria-hidden="true" className="sr-only" tabIndex={-1} />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
