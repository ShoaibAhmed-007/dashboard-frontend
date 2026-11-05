"use client";

import { ChangeEvent, useCallback, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { TaskListItem } from "@/services/task.service";
import styles from "./task-calendar-ui.module.css";

interface TaskCalendarViewProps {
  tasks: TaskListItem[];
  onView: (taskId: string) => void;
}

type EventTone = "red" | "amber" | "blue" | "purple" | "slate";

type CalendarTaskEvent = EventInput;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function resolveEventTone(task: TaskListItem, index: number): EventTone {
  if (task.priority === "URGENT") return "red";
  if (task.priority === "HIGH") return "amber";
  if (task.status.group === "ACTIVE") return "blue";
  if (task.status.group === "DONE") return "purple";
  if (task.status.group === "CLOSED") return "slate";
  const fallbackTones: EventTone[] = ["red", "amber", "blue", "purple", "slate"];
  return fallbackTones[index % fallbackTones.length];
}

// Extract YYYY-MM-DD without timezone conversion — safe for both date-only and ISO strings
function toDateOnly(dateStr: string): string {
  return dateStr.slice(0, 10);
}

// FullCalendar end is exclusive — add 1 day so Apr 10 shows through Apr 10
function toExclusiveEnd(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

function renderEventContent(eventInfo: EventContentArg) {
  const { tone, isMultiDay } = eventInfo.event.extendedProps as {
    tone: EventTone;
    isMultiDay: boolean;
  };
  return (
    <>
      {!isMultiDay && <span className={`taskEventDot taskEventDot-${tone}`} />}
      <span className={`taskEventTitle taskEventTitle-${tone}`}>{eventInfo.event.title}</span>
    </>
  );
}

export default function TaskCalendarView({ tasks, onView }: TaskCalendarViewProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(new Date()));
  // Set of week ISO strings (Monday date) where the user expanded "more"
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  const taskById = useMemo(() => {
    const map = new Map<string, TaskListItem>();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const events = useMemo<CalendarTaskEvent[]>(() =>
    tasks.map((task, index) => {
      const start = toDateOnly(task.startDate ?? task.dueDate ?? task.createdAt);
      const dueDate = task.dueDate ? toDateOnly(task.dueDate) : null;
      const end = dueDate && start !== dueDate ? toExclusiveEnd(dueDate) : undefined;
      const isMultiDay = !!end;

      return {
        id: `task-${task.id}`,
        title: task.title,
        start,
        end,
        allDay: true,
        extendedProps: {
          taskId: task.id,
          tone: resolveEventTone(task, index),
          isMultiDay,
        },
      };
    }),
    [tasks]
  );

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let minYear = currentYear - 2;
    let maxYear = currentYear + 3;
    tasks.forEach((task) => {
      const sourceDate = task.startDate ?? task.dueDate ?? task.createdAt;
      const taskYear = Number.parseInt(sourceDate.slice(0, 4), 10);
      if (Number.isNaN(taskYear)) return;
      if (taskYear < minYear) minYear = taskYear;
      if (taskYear > maxYear) maxYear = taskYear;
    });
    const visibleYear = visibleMonth.getFullYear();
    if (visibleYear < minYear) minYear = visibleYear;
    if (visibleYear > maxYear) maxYear = visibleYear;
    return Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  }, [tasks, visibleMonth]);

  const syncVisibleMonth = (date: Date) => {
    setVisibleMonth(getMonthStart(date));
  };

  const moveMonth = (direction: "prev" | "next") => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (direction === "prev") api.prev();
    if (direction === "next") api.next();
    syncVisibleMonth(api.getDate());
    setExpandedWeeks(new Set());
  };

  const goToToday = () => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.today();
    syncVisibleMonth(api.getDate());
    setExpandedWeeks(new Set());
  };

  const handleMonthChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const month = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(month)) return;
    const nextDate = new Date(visibleMonth.getFullYear(), month, 1);
    api.gotoDate(nextDate);
    syncVisibleMonth(nextDate);
    setExpandedWeeks(new Set());
  };

  const handleYearChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const year = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(year)) return;
    const nextDate = new Date(year, visibleMonth.getMonth(), 1);
    api.gotoDate(nextDate);
    syncVisibleMonth(nextDate);
    setExpandedWeeks(new Set());
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    syncVisibleMonth(arg.view.currentStart);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const taskId = String(clickInfo.event.extendedProps.taskId || "");
    if (taskById.has(taskId)) onView(taskId);
  };

  // When user clicks "+ N more", expand that week to show all events inline
  const handleMoreLinkClick = useCallback((arg: { date: Date }) => {
    // arg.date is the day cell date — compute the Monday (week start) as the key
    const d = new Date(arg.date);
    d.setDate(d.getDate() - d.getDay()); // Sunday-based
    const weekKey = d.toISOString().slice(0, 10);
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      next.add(weekKey);
      return next;
    });
  }, []);

  // Compute dayMaxEventRows: if any expanded week contains this date, show all
  // FullCalendar doesn't support per-row limits, so we use a high number when any week is expanded
  const dayMaxEventRows = expandedWeeks.size > 0 ? false : 3;

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => moveMonth("prev")}
            aria-label="Go to previous month"
          >
            <LuChevronLeft />
          </button>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => moveMonth("next")}
            aria-label="Go to next month"
          >
            <LuChevronRight />
          </button>
          <button type="button" className={styles.todayButton} onClick={goToToday}>
            Today
          </button>
        </div>

        <div className={styles.selection}>
          <select
            className={styles.selectControl}
            value={visibleMonth.getMonth()}
            onChange={handleMonthChange}
            aria-label="Select month"
          >
            {MONTH_NAMES.map((month, index) => (
              <option key={month} value={index}>{month}</option>
            ))}
          </select>
          <select
            className={styles.selectControl}
            value={visibleMonth.getFullYear()}
            onChange={handleYearChange}
            aria-label="Select year"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="task-calendar-ui">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={visibleMonth}
          headerToolbar={false}
          events={events}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          eventClassNames={(arg) => {
            const tone = String(arg.event.extendedProps.tone ?? "slate");
            const isMultiDay = Boolean(arg.event.extendedProps.isMultiDay);
            return [`fc-task-tone-${tone}`, isMultiDay ? "fc-task-multi" : "fc-task-single"];
          }}
          dayMaxEventRows={dayMaxEventRows}
          fixedWeekCount={false}
          moreLinkClick={handleMoreLinkClick}
          moreLinkContent={(arg) => `+ ${arg.num} MORE`}
          showNonCurrentDates
          height="auto"
          displayEventTime={false}
          eventOrder="start,-duration,allDay,title"
          forceEventDuration
          defaultAllDayEventDuration={{ days: 1 }}
        />
      </div>
    </div>
  );
}
