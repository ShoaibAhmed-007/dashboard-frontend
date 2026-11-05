"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuPlay, LuSquare, LuChevronLeft, LuChevronRight, LuAlignLeft } from "react-icons/lu";
import { timeEntryService, TimeEntry } from "@/services/timeEntry.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";

const AVATAR_COLORS = [
  "#18181b", "#7c3aed", "#eab308", "#0f172a", "#6d28d9",
  "#ca8a04", "#1e1b4b", "#fbbf24", "#3b0764", "#292524",
];
function avatarBg(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) hash = (hash * 33) ^ id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatTime12(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Parse a "h:mm am/pm" string into minutes from midnight
function parseTime12(str: string): number | null {
  const m = str.match(/(\d+):(\d+)\s*(am|pm)/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && h !== 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h * 60 + min;
}

// Compute duration in minutes between two time strings (handles overnight)
function computeDurationMinutes(start: string, end: string): number {
  const s = parseTime12(start);
  const e = parseTime12(end);
  if (s === null || e === null) return 0;
  const diff = e - s;
  if (diff > 0) return diff;
  if (diff < 0) return diff + 24 * 60; // overnight
  return 0; // same time
}

function isOvernight(start: string, end: string): boolean {
  const s = parseTime12(start);
  const e = parseTime12(end);
  if (s === null || e === null) return false;
  return e < s;
}

// Build an ISO datetime from a Date + time string
function buildIso(date: Date, timeStr: string): string | null {
  const mins = parseTime12(timeStr);
  if (mins === null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0);
  return d.toISOString();
}

// Generate 15-min interval slots
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(formatTime12(new Date(2000, 0, 1, h, m)));
    }
  }
  return slots;
}
const TIME_SLOTS = generateTimeSlots();

interface TrackTimePanelProps {
  taskId: string;
  totalTimeLogged: number;
  userName: string;
  userId: string;
  onUpdate: () => void;
}

export default function TrackTimePanel({ taskId, totalTimeLogged, userName, userId, onUpdate }: TrackTimePanelProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [localTimeLogged, setLocalTimeLogged] = useState(totalTimeLogged);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const now = new Date();
  const snappedNow = new Date(now);
  snappedNow.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  const snappedEnd = new Date(snappedNow);
  snappedEnd.setMinutes(snappedEnd.getMinutes() + 15);
  const [entryDate, setEntryDate] = useState<Date>(now);
  const [startTime, setStartTime] = useState<string>(formatTime12(snappedNow));
  const [endTime, setEndTime] = useState<string>(formatTime12(snappedEnd));
  const [notes, setNotes] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  function buildCal(y: number, m: number): (number | null)[][] {
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const cells: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }

  // Fetch last entry description when panel opens
  useEffect(() => {
    if (!open) return;
    timeEntryService.list(taskId).then(entries => {
      if (entries.length > 0) {
        const last = entries[entries.length - 1];
        if (last.description) setNotes(last.description);
      }
    }).catch(() => {});
  }, [open, taskId]);

  // Check for active timer on mount
  useEffect(() => {
    timeEntryService.getActive().then(entry => {
      if (entry && entry.taskId === taskId) {
        setActiveEntry(entry);
        setElapsed(Math.floor((Date.now() - new Date(entry.startTime).getTime()) / 1000));
      }
    }).catch(() => {});
  }, [taskId]);

  // Tick
  useEffect(() => {
    if (activeEntry) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeEntry]);

  // Outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
        setShowDatePicker(false);
        setShowStartPicker(false);
        setShowEndPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.max(8, rect.left - 340) });
    }
    setOpen(v => !v);
  };

  const handleStartTimer = async () => {
    try {
      const result = await timeEntryService.startTimer(taskId);
      setActiveEntry(result.activeEntry);
      setElapsed(Math.floor((Date.now() - new Date(result.activeEntry.startTime).getTime()) / 1000));
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleStopTimer = async () => {
    try {
      await timeEntryService.stopTimer(taskId);
      setActiveEntry(null);
      setElapsed(0);
      toast.success("Timer stopped");
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleSave = async () => {
    const startIso = buildIso(entryDate, startTime);
    const endIso = buildIso(entryDate, endTime);
    if (!startIso || !endIso) {
      toast.error("Invalid time selection");
      return;
    }
    const durationMinutes = computeDurationMinutes(startTime, endTime);
    if (durationMinutes <= 0) {
      toast.error("End time must be after start time");
      return;
    }
    setSaving(true);
    try {
      await timeEntryService.logManual(taskId, {
        description: notes.trim() || undefined,
        durationMinutes,
      });
      setLocalTimeLogged(t => t + durationMinutes * 60);
      setOpen(false);
      toast.success("Time logged");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const isTimerRunning = !!activeEntry;
  const displayTime = isTimerRunning ? formatTimer(elapsed) : (localTimeLogged > 0 ? formatDuration(localTimeLogged) : null);
  const durationMinutes = computeDurationMinutes(startTime, endTime);

  return (
    <div ref={triggerRef} className="relative inline-flex items-center gap-1">
      {/* Play/stop — toggles timer directly, no dropdown */}
      <button
        type="button"
        onClick={isTimerRunning ? handleStopTimer : handleStartTimer}
        title={isTimerRunning ? "Stop timer" : "Start timer"}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {isTimerRunning
          ? <LuSquare className="h-3.5 w-3.5 text-red-500" />
          : <LuPlay className="h-3.5 w-3.5" />
        }
      </button>

      {/* Time display — opens the log panel */}
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="rounded px-1 py-1 text-sm hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-gray-800"
      >
        {isTimerRunning ? (
          <span className="font-mono text-red-500">{displayTime}</span>
        ) : displayTime ? (
          <span className="text-gray-600 dark:text-gray-300">{displayTime}</span>
        ) : (
          <span className="text-gray-400">Add time</span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width: 400 }}
          className="rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <span className="text-sm font-semibold text-gray-800 dark:text-white">Time on all tasks</span>
            <span className="text-sm font-semibold text-gray-800 dark:text-white">{formatDuration(localTimeLogged)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 dark:border-gray-800">
            <span className="text-xs text-gray-400">Without Subtasks</span>
            <span className="text-xs text-gray-400">{formatDuration(localTimeLogged)}</span>
          </div>

          {/* Entry card */}
          <div className="p-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700">

              {/* User row */}
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
                <span
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
                  style={{ backgroundColor: avatarBg(userId) }}
                >
                  {getInitials(userName)}
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-white">{userName}</span>
              </div>

              {/* Date + start/end time row */}
              <div className="relative border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>

                  {/* Date */}
                  <button
                    type="button"
                    onClick={() => { setShowDatePicker(v => !v); setShowStartPicker(false); setShowEndPicker(false); }}
                    className={`rounded px-1 py-0.5 text-sm ${showDatePicker ? "bg-brand-50 text-brand-600 ring-1 ring-brand-400" : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                  >
                    {formatDateLabel(entryDate)}
                  </button>

                  {/* Start time */}
                  <button
                    type="button"
                    onClick={() => { setShowStartPicker(v => !v); setShowDatePicker(false); setShowEndPicker(false); }}
                    className={`rounded px-1 py-0.5 text-sm ${showStartPicker ? "bg-brand-50 text-brand-600 ring-1 ring-brand-400" : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                  >
                    {startTime}
                  </button>

                  <span className="text-gray-400">–</span>

                  {/* End time */}
                  <button
                    type="button"
                    onClick={() => { setShowEndPicker(v => !v); setShowDatePicker(false); setShowStartPicker(false); }}
                    className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-sm ${showEndPicker ? "bg-brand-50 text-brand-600 ring-1 ring-brand-400" : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                  >
                    {endTime}
                    {isOvernight(startTime, endTime) && (
                      <span className="text-[10px] font-medium text-brand-500">+1</span>
                    )}
                  </button>

                  {/* Duration preview */}
                  {durationMinutes > 0 && (
                    <span className="ml-auto text-xs text-gray-400">{formatDuration(durationMinutes * 60)}</span>
                  )}
                </div>

                {/* Date calendar */}
                {showDatePicker && (
                  <div className="absolute left-2 top-full z-10 mt-1 w-60 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-2 flex items-center justify-between">
                      <button type="button" onClick={() => { const d = new Date(calYear, calMonth - 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}>
                        <LuChevronLeft className="h-4 w-4 text-gray-400" />
                      </button>
                      <span className="text-sm font-medium text-gray-800 dark:text-white">{MONTHS[calMonth]} {calYear}</span>
                      <button type="button" onClick={() => { const d = new Date(calYear, calMonth + 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}>
                        <LuChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 text-center">
                      {DAYS.map(d => <span key={d} className="py-0.5 text-[10px] text-gray-400">{d}</span>)}
                      {buildCal(calYear, calMonth).map((week, wi) =>
                        week.map((day, di) => {
                          if (!day) return <span key={`${wi}-${di}`} />;
                          const selected = entryDate.getFullYear() === calYear && entryDate.getMonth() === calMonth && entryDate.getDate() === day;
                          return (
                            <button key={`${wi}-${di}`} type="button"
                              onClick={() => { setEntryDate(new Date(calYear, calMonth, day)); setShowDatePicker(false); }}
                              className={`rounded py-0.5 text-xs ${selected ? "bg-brand-500 text-white" : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                            >{day}</button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Time slot list */}
                {(showStartPicker || showEndPicker) && (
                  <div className="absolute left-2 top-full z-10 mt-1 max-h-48 w-44 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    {TIME_SLOTS.map(slot => {
                      const slotMins = parseTime12(slot);
                      const baseMins = showEndPicker ? parseTime12(startTime) : null;
                      let diff: number | null = null;
                      let overnight = false;
                      if (slotMins !== null && baseMins !== null) {
                        const raw = slotMins - baseMins;
                        if (raw > 0) { diff = raw; }
                        else if (raw < 0) { diff = raw + 24 * 60; overnight = true; }
                        // raw === 0 → same time, diff stays null
                      }
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            if (showStartPicker) setStartTime(slot);
                            else setEndTime(slot);
                            setShowStartPicker(false);
                            setShowEndPicker(false);
                          }}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <span className="flex items-center gap-0.5">
                            {slot}
                            {overnight && <span className="text-[9px] font-medium text-brand-500">+1</span>}
                          </span>
                          {diff !== null && (
                            <span className="text-gray-400">{formatDuration(diff * 60)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notes / description */}
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
                <LuAlignLeft className="h-4 w-4 shrink-0 text-gray-400" />
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Description"
                  className="min-w-0 flex-1 bg-transparent text-sm text-gray-600 outline-none placeholder:text-gray-400 dark:text-gray-300"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end border-t border-gray-100 px-3 py-2.5 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || durationMinutes <= 0}
                  className="rounded-xl bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
                >
                  {saving ? "..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
