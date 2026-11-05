"use client";

import { Fragment, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LuEye, LuExternalLink } from "react-icons/lu";
import UserAvatar from "@/components/ui/UserAvatar";
import { useTaskStore } from "@/stores/task.store";
import type { MeetingTask } from "@/types/mom";

const MS_PER_DAY = 86_400_000;


/** Wide enough for a title, its ID line and a percentage without wrapping. */
const LABEL_COLUMN_PX = 280;

/** Up to this many days the axis is one labelled column per day; past it that
 *  turns into an unreadable smear of overlapping numbers, so the axis switches
 *  to a handful of start/end/month labels instead. */
const DAILY_AXIS_MAX_DAYS = 21;

/** Same width as the bar's `min-w-[150px]` — used to keep a bar on-screen. */
const BAR_MIN_WIDTH_PX = 150;

type AxisTick = { index: number; label: string; kind: "edge" | "today" | "month" };

function formatTick(date: Date, withYear: boolean): string {
  const text = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return withYear ? `${text} ${String(date.getFullYear()).slice(2)}` : text;
}

/**
 * The few labels shown on a long axis: the first and last day, "Today" when it
 * falls inside the range, and the 1st of each month in between. Added in that
 * priority order and skipped when too close to one already placed, so labels
 * never overlap however long the range is.
 */
function buildAxisTicks(days: Date[], todayIndex: number | null): AxisTick[] {
  if (days.length === 0) return [];
  const last = days.length - 1;
  const withYear = days[0].getFullYear() !== days[last].getFullYear();
  const minGap = Math.max(4, Math.ceil(days.length * 0.09));

  const candidates: AxisTick[] = [
    { index: 0, label: formatTick(days[0], withYear), kind: "edge" },
    { index: last, label: formatTick(days[last], withYear), kind: "edge" },
  ];
  if (todayIndex !== null) candidates.push({ index: todayIndex, label: "Today", kind: "today" });
  days.forEach((day, index) => {
    if (day.getDate() === 1 && index > 0 && index < last) {
      candidates.push({ index, label: formatTick(day, withYear), kind: "month" });
    }
  });

  const placed: AxisTick[] = [];
  for (const tick of candidates) {
    if (placed.every((other) => Math.abs(other.index - tick.index) >= minGap)) placed.push(tick);
  }
  return placed.sort((a, b) => a.index - b.index);
}

/** Midnight-normalised, so a time-of-day difference cannot shift a column. */
function startOfDay(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * A bar's window — purely where it's drawn on the date axis. Meeting-created
 * tasks often have `startDate: null`, so this falls back to `createdAt`.
 * Unrelated to `progress`, which is never date-derived: it comes straight
 * from the server (subtask completion ratio, or 100 once closed).
 */
function windowStart(task: MeetingTask): string {
  return task.startDate ?? task.createdAt;
}

/**
 * How a task's bar reads: its colour, and the words on its chip.
 *
 * Colour comes from the project's own status palette rather than a hardcoded
 * map, so a renamed or recoloured column stays correct here. Lateness is
 * overlaid on top, because "overdue" is the one thing worth seeing at a glance
 * that no status column expresses.
 */
function barAppearance(task: MeetingTask): { color: string; label: string } {
  if (task.status.isClosed) return { color: "#22c55e", label: "Completed" };
  if (task.isLate) return { color: "#ef4444", label: "Delayed" };
  return { color: task.status.color, label: task.status.name };
}

/**
 * Gantt view of a meeting's follow-up tasks.
 *
 * Tasks run down the y-axis, dates across the x-axis. Each bar carries its own
 * percentage at its right end and its status chip in its centre, on the same
 * row as the task name — so a number can never be read against the wrong
 * task. A minimum bar width keeps the number from ever being clipped.
 *
 * The task column is sticky, so when a long schedule scrolls sideways the
 * names stay put and every bar remains identifiable. Tasks with no due date
 * get a row too — with an empty track — because leaving them out silently
 * made the chart lie about how many follow-ups there were.
 */
export default function MomTimeline({ tasks }: { tasks: MeetingTask[] }) {
  const router = useRouter();
  const openTaskDetail = useTaskStore((state) => state.openTaskDetail);

  const days = useMemo(() => {
    const plottable = tasks.filter((task) => task.dueDate);
    if (plottable.length === 0) return [] as Date[];

    const starts = plottable.map((task) => startOfDay(windowStart(task)));
    const ends = plottable.map((task) => startOfDay(task.dueDate!));
    const min = Math.min(...starts);
    const max = Math.max(...ends);

    /* Inclusive of both ends: a task starting and ending the same day still
       occupies one column, not zero. */
    const dayCount = Math.max(1, Math.round((max - min) / MS_PER_DAY) + 1);
    return Array.from(
      { length: dayCount },
      (_, index) => new Date(min + index * MS_PER_DAY)
    );
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-gray-400">
        No follow-up tasks yet.
      </p>
    );
  }

  const totalDays = Math.max(1, days.length);
  const axisStart = days.length ? startOfDay(days[0].toISOString()) : 0;
  const dayColumns = { gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` };

  const isDense = totalDays > DAILY_AXIS_MAX_DAYS;
  const todayIndexRaw = days.length
    ? Math.round((startOfDay(new Date().toISOString()) - axisStart) / MS_PER_DAY)
    : -1;
  const todayIndex =
    todayIndexRaw >= 0 && todayIndexRaw < totalDays ? todayIndexRaw : null;
  const axisTicks = isDense ? buildAxisTicks(days, todayIndex) : [];
  const columnCenter = (index: number) => `${((index + 0.5) / totalDays) * 100}%`;

  /* The sticky column needs an opaque background of its own — otherwise the
     bars scroll visibly underneath the names. */
  const stickyCell =
    "sticky left-0 z-10 bg-white dark:bg-gray-900";

  return (
    <div className="overflow-x-auto">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${LABEL_COLUMN_PX}px minmax(560px, 1fr)`,
        }}
      >
        {/* ── Header row: "Task" over the label column, day numbers over the axis ── */}
        <div
          className={`${stickyCell} border-b border-gray-100 pb-3 pr-4 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:text-gray-400`}
        >
          Task
        </div>
        {days.length === 0 ? (
          <div className="grid border-b border-gray-100 pb-3 dark:border-gray-800">
            <span className="text-center text-xs text-gray-300 dark:text-gray-600">
              No dates set
            </span>
          </div>
        ) : isDense ? (
          /* Long range: a few labels at their real positions, not one per day. */
          <div className="relative h-4 border-b border-gray-100 pb-3 dark:border-gray-800">
            {axisTicks.map((tick) => {
              const isFirst = tick.index === 0;
              const isLast = tick.index === totalDays - 1;
              return (
                <span
                  key={`${tick.kind}-${tick.index}`}
                  className={`absolute top-0 whitespace-nowrap text-xs ${
                    tick.kind === "today"
                      ? "font-semibold text-brand-500"
                      : "font-medium text-gray-400"
                  }`}
                  style={{
                    left: isFirst ? 0 : isLast ? undefined : columnCenter(tick.index),
                    right: isLast ? 0 : undefined,
                    transform: isFirst || isLast ? undefined : "translateX(-50%)",
                  }}
                >
                  {tick.label}
                </span>
              );
            })}
          </div>
        ) : (
          <div
            className="grid border-b border-gray-100 pb-3 dark:border-gray-800"
            style={dayColumns}
          >
            {days.map((day) => (
              <span
                key={day.toISOString()}
                className="text-center text-xs font-medium text-gray-400"
              >
                {String(day.getDate()).padStart(2, "0")}
              </span>
            ))}
          </div>
        )}

        {/* ── One row per task ── */}
        {tasks.map((task) => {
          const { color, label } = barAppearance(task);
          /* Clamped: nothing in the response guarantees the 0-100 range, and
             an out-of-range value would overflow its own bar. */
          const progress = Math.max(0, Math.min(100, task.progress));
          const faces = task.assignees.map((entry) => entry.user);

          let bar: { left: number; width: number } | null = null;
          if (task.dueDate) {
            const start = startOfDay(windowStart(task));
            const end = startOfDay(task.dueDate);
            const offsetDays = Math.round((start - axisStart) / MS_PER_DAY);
            const spanDays = Math.max(
              1,
              Math.round((end - start) / MS_PER_DAY) + 1
            );
            bar = {
              left: (offsetDays / totalDays) * 100,
              width: (spanDays / totalDays) * 100,
            };
          } else if (task.subtaskStats !== null || task.status.isClosed) {
            /* No date to plot against, but `progress` is still a real,
               server-computed signal here (subtask ratio, or 100 once
               closed — see the field's own doc comment) — showing "nothing
               to plot" for these would hide genuine progress. Occupies the
               full row instead of a date-positioned span. */
            bar = { left: 0, width: 100 };
          }

          return (
            <Fragment key={task.id}>
              {/* y-axis: the task itself — title, its id/project, and a link
                  out. This is an overview, not an editor: subtasks belong to
                  the task board or the Edit MOM screen, not this row. */}
              <div
                className={`${stickyCell} border-b border-gray-100 py-3 pr-4 dark:border-gray-800`}
              >
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {task.title}
                  </span>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="truncate">
                      {task.list.project.taskIdPrefix}-{task.taskNumber} ·{" "}
                      {task.list.project.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`View ${task.title}`}
                      title="View this task"
                      onClick={() => void openTaskDetail(task.id)}
                      className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                    >
                      <LuEye className="h-3.5 w-3.5" />
                    </button>
                    {/* Unlike the eye button, this leaves MOM: it lands on the
                        task's own row in the project's task list and briefly
                        flashes it, so it's obvious which row is the one being
                        referenced from this meeting. */}
                    <button
                      type="button"
                      aria-label={`Go to ${task.title} in its project`}
                      title="Go to this task in its project"
                      onClick={() =>
                        router.push(
                          `/projects?projectId=${task.list.project.id}&highlightTaskId=${task.id}`
                        )
                      }
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                    >
                      <LuExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* x-axis: the bar, on its own day grid */}
              <div className="relative border-b border-gray-100 py-3 dark:border-gray-800">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 grid"
                  style={dayColumns}
                >
                  {Array.from({ length: totalDays }, (_, index) => {
                    /* Dense axis: a line per day would be a solid wall, so only
                       the 1st of each month gets one. */
                    const showLine =
                      index > 0 && (!isDense || days[index]?.getDate() === 1);
                    return (
                      <span
                        key={index}
                        className={
                          showLine
                            ? "border-l border-dashed border-gray-200 dark:border-gray-800"
                            : ""
                        }
                      />
                    );
                  })}
                </div>

                {todayIndex !== null && (
                  <div
                    aria-hidden="true"
                    title="Today"
                    className="pointer-events-none absolute inset-y-0 w-px bg-brand-400/70"
                    style={{ left: columnCenter(todayIndex) }}
                  />
                )}

                {bar ? (
                  <div className="relative h-14">
                  {/* `min-w` guarantees room for the avatars and the percentage
                      however short the date span; `@container` lets the chip
                      show only once the bar is wide enough to hold it too. */}
                  <div
                    role="img"
                    aria-label={`${task.title}: ${label}, ${progress}% complete`}
                    style={{
                      /* Clamped so a bar starting near the end of a long range
                         isn't pushed past the chart edge and clipped. */
                      left: `min(${bar.left}%, calc(100% - ${BAR_MIN_WIDTH_PX}px))`,
                      width: `${bar.width}%`,
                      /* The track itself is tinted by the task's own state —
                         otherwise a delayed task at 0% progress (nothing done
                         yet) rendered as a plain grey bar, with nothing on
                         screen to show it was late at all. */
                      backgroundColor: task.isLate ? `${color}4d` : `${color}33`,
                      /* A delayed task reads red whatever its progress: at 0%
                         there is no solid fill, so the pale track alone looked
                         like a different, weaker state from a delayed task
                         that happens to be part-done. The ring keeps them
                         visibly the same. */
                      boxShadow: task.isLate ? `inset 0 0 0 2px ${color}` : undefined,
                    }}
                    className="@container absolute top-0 flex h-14 min-w-[150px] max-w-full items-center overflow-hidden rounded-full"
                  >
                    {/* The full-strength portion is the progress fill, not the
                        bar — the tinted track behind it is the task's full
                        date window. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${progress}%`, backgroundColor: color }}
                    />
                    <span className="relative flex w-full items-center px-2.5">
                      <span className="flex shrink-0 items-center -space-x-2">
                        {faces.slice(0, 2).map((person) => (
                          <UserAvatar
                            key={person.id}
                            name={person.fullName}
                            avatarUrl={person.avatarUrl}
                            color={person.avatarColor}
                            size={34}
                            className="ring-2 ring-white dark:ring-gray-900"
                          />
                        ))}
                      </span>
                      {/* Centred on the bar, not on the space left after the
                          avatars — hidden until there is room beside them.
                          A solid fill in the task's own colour, not a
                          translucent white pill: that read fine over a
                          full-strength fill but vanished against the pale
                          tinted track at low progress, especially in light
                          mode. */}
                      <span
                        style={{ backgroundColor: color }}
                        className="absolute left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium text-white shadow-sm @[240px]:inline"
                      >
                        {label}
                      </span>
                      <span
                        className={`ml-auto shrink-0 pl-2 text-sm font-bold tabular-nums ${
                          progress >= 40
                            ? "text-white"
                            : "text-gray-700 dark:text-gray-100"
                        }`}
                        title={`${label}, ${progress}%`}
                      >
                        {progress}%
                      </span>
                    </span>
                  </div>
                  </div>
                ) : (
                  <div className="flex h-14 items-center px-3 text-xs italic text-gray-400">
                    No due date — nothing to plot
                  </div>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
