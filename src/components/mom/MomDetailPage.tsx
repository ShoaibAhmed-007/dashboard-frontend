"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LuArrowLeft,
  LuCheck,
  LuClipboardList,
  LuPencil,
  LuSparkles,
  LuX,
} from "react-icons/lu";
import UserAvatar from "@/components/ui/UserAvatar";
import { useAuthStore } from "@/stores/auth.store";
import MomTimeline from "./MomTimeline";
import { meetingsListHref } from "./momRoutes";
import type { Meeting } from "@/types/mom";

/** Faces shown in the Participants card before the rest collapse. */
const MAX_FACES = 3;

/**
 * A single MOM, read-only.
 *
 * The action-items panel is the point of the screen: everything above it is
 * context, and the timeline is what tells you whether the meeting actually
 * went anywhere.
 */
export default function MomDetailPage({ mom }: { mom: Meeting }) {
  const router = useRouter();

  /* Counts come from the server's own `taskStats` rather than being derived
     here: "completed" means the task sits in its project's closed column, a
     fact only the API knows. */
  const { completed, total, percent } = useMemo(() => {
    const { total: all, completed: done } = mom.taskStats;
    return {
      completed: done,
      total: all,
      // Guarded: a meeting with no follow-ups has nothing to be a % of.
      percent: all === 0 ? 0 : Math.round((done / all) * 100),
    };
  }, [mom.taskStats]);

  /* `createdBy` is the creator's user id — the same field the server checks
     before allowing an update or delete. */
  const selfId = useAuthStore((state) => state.user?.id);
  const isCreator = mom.createdBy === selfId;

  const attendees = mom.participants.map((entry) => entry.user);
  const faces = attendees.slice(0, MAX_FACES);
  const overflow = attendees.length - faces.length;

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-900">
      <div className="px-8 py-6">
        <button
          type="button"
          onClick={() => router.push(meetingsListHref(mom.departmentId))}
          className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <LuArrowLeft className="h-4 w-4" />
          All meetings
        </button>

        <div className="mt-3 flex gap-6">
          {/* Main column */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {mom.title}
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Document discussion points and assign actionable tasks.
                </p>
              </div>

              {/* Update is creator-only server-side, so a manager who did not
                  create this meeting is shown no button rather than one that
                  would 403 on save. */}
              {isCreator && (
                <button
                  type="button"
                  onClick={() => router.push(`/meetings/${mom.id}/edit`)}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
                >
                  <LuPencil className="h-4 w-4" />
                  Edit MOM
                </button>
              )}
            </div>

            {/* Discussion + Decisions, side by side */}
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="flex max-h-80 flex-col rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                <div className="flex shrink-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500">
                    <LuClipboardList className="h-5 w-5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      Discussion
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      What was discussed in this meeting
                    </p>
                  </div>
                </div>

                {/* The API stores one free-text summary, not a bullet list.
                    Newlines are preserved so a typed-out list still reads as
                    one. A long summary scrolls within the card instead of
                    pushing it — and everything beside it — taller. */}
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                  {mom.summary?.trim() ? (
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">
                      {mom.summary}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Nothing was recorded.
                    </p>
                  )}
                </div>
              </section>

              <section className="flex max-h-80 flex-col rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
                <div className="flex shrink-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500">
                    <LuSparkles className="h-5 w-5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      Decisions made
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Important outcomes to keep visible
                    </p>
                  </div>
                </div>

                {/* Long lists scroll within the card rather than stretching
                    it (and the Discussion card beside it) to match. */}
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                  {mom.decisions.length > 0 ? (
                    <ul className="space-y-2">
                      {mom.decisions.map((decision) => (
                        <li
                          key={decision}
                          className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
                        >
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-emerald-500 text-emerald-500"
                          >
                            <LuCheck className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                          <span className="min-w-0 flex-1 break-words">
                            {decision}
                          </span>
                          {/* Read-only screen: shown for parity with the
                              design, but removing a decision belongs to Edit. */}
                          <LuX
                            aria-hidden="true"
                            className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600"
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">
                      No decisions were recorded.
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* Action items */}
            <section className="mt-5 rounded-2xl bg-gray-50 p-7 dark:bg-gray-905">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Action items
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    {completed} of {total}{" "}
                    {total === 1 ? "task" : "tasks"} completed
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {percent}%
                  </p>
                  <p className="text-xs text-gray-400">complete</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-white p-6 dark:bg-gray-900">
                {/* Tasks on the y-axis, dates on the x-axis: each row is one
                    task with its own percentage beside its name, so a number
                    can never be read against the wrong bar. */}
                <MomTimeline tasks={mom.tasks} />
              </div>
            </section>
          </div>

          {/* Participants */}
          <aside className="hidden w-[280px] shrink-0 lg:block">
            <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500">
                  <LuSparkles className="h-5 w-5 text-white" />
                </span>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Participants
                </h2>
              </div>

              <div className="my-4 h-px bg-gray-100 dark:bg-gray-800" />

              <div className="flex items-center gap-3">
                <UserAvatar
                  name={mom.creator.fullName}
                  avatarUrl={mom.creator.avatarUrl}
                  color={mom.creator.avatarColor}
                  size={38}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {mom.creator.fullName}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    Meeting Owner
                  </span>
                </span>
              </div>

              <div className="mt-4 flex items-center -space-x-2">
                {faces.map((person) => (
                  <UserAvatar
                    key={person.id}
                    name={person.fullName}
                    avatarUrl={person.avatarUrl}
                    color={person.avatarColor}
                    size={38}
                    className="ring-2 ring-white dark:ring-gray-900"
                  />
                ))}
                {overflow > 0 && (
                  <span className="flex h-[38px] items-center justify-center rounded-full bg-gray-100 px-2.5 text-[11px] font-semibold text-gray-500 ring-2 ring-white dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-900">
                    {overflow}+
                  </span>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
