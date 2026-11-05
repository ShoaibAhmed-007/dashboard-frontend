"use client";

import { LuTrash2 } from "react-icons/lu";
import UserAvatar from "@/components/ui/UserAvatar";
import type { MeetingListItem } from "@/types/mom";

/** "02 Sept 2026" — the design's long-ish month form. */
function formatMeetingDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    // en-GB gives "Sep"; the design shows "Sept".
    .replace(/\bSep\b/, "Sept");
}

/** Faces shown before the rest collapse into a "+N" chip. */
const MAX_FACES = 3;

/**
 * One meeting as a card.
 *
 * The card leads with *who* called the meeting and how much of it is still
 * outstanding, because that is what decides whether it needs opening — the
 * title alone rarely does.
 */
export default function MomCard({
  mom,
  onView,
  isCreator,
  onDelete,
}: {
  mom: MeetingListItem;
  onView: (mom: MeetingListItem) => void;
  /** Delete is creator-only server-side, so the icon only renders for them —
   *  same gate `MomDetailPage` uses for its Edit button. */
  isCreator?: boolean;
  onDelete?: (mom: MeetingListItem) => void;
}) {
  /* Straight from the server: "completed" means the task sits in its project's
     closed column, which only the API can know. */
  const { total, completed, pending } = mom.taskStats;

  /* Guard the divide: a meeting with no follow-ups has nothing to be a
     percentage of, and 0/0 would render NaN% as an invisible bar. */
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  const attendees = mom.participants.map((entry) => entry.user);
  const faces = attendees.slice(0, MAX_FACES);
  const overflow = attendees.length - faces.length;

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      {/* Author + outstanding count */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar
            name={mom.creator.fullName}
            avatarUrl={mom.creator.avatarUrl}
            color={mom.creator.avatarColor}
            size={36}
          />
          <span className="min-w-0">
            <span className="block text-[11px] text-gray-400">Created by</span>
            <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {mom.creator.fullName}
            </span>
          </span>
        </div>

        {pending > 0 && (
          <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            {pending} pending
          </span>
        )}
      </div>

      {/* Title + date */}
      <h3 className="mt-4 truncate text-lg font-bold text-gray-900 dark:text-gray-100">
        {mom.title}
      </h3>
      {/* Date only — the API records no meeting duration. */}
      <p className="mt-1 text-xs text-gray-400">
        {formatMeetingDate(mom.meetingDate)}
      </p>

      <p className="mt-4 text-xs font-semibold text-gray-900 dark:text-gray-100">
        Participants
      </p>
      <div className="mt-2 flex items-center -space-x-2">
        {faces.map((person) => (
          <UserAvatar
            key={person.id}
            name={person.fullName}
            avatarUrl={person.avatarUrl}
            color={person.avatarColor}
            size={34}
            className="ring-2 ring-white dark:ring-gray-900"
          />
        ))}
        {overflow > 0 && (
          <span className="flex h-[34px] items-center justify-center rounded-full bg-gray-100 px-2 text-[11px] font-semibold text-gray-500 ring-2 ring-white dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-900">
            {overflow}+
          </span>
        )}
      </div>

      {/* Progress — pushed to the card's foot so every card's button lines up
          regardless of how long its title wrapped. */}
      <div className="mt-5 flex-1" />

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${completed} of ${total} tasks completed`}
      >
        <span
          className="block h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-gray-400">
          {total} {total === 1 ? "task" : "tasks"}
        </span>
        <span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            {completed} completed
          </span>
          <span className="text-gray-300 dark:text-gray-600"> / </span>
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {pending} pending
          </span>
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onView(mom)}
          className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-brand-500 transition-colors hover:bg-brand-50 dark:border-gray-700 dark:hover:bg-brand-500/10"
        >
          View MOM
        </button>
        {isCreator && onDelete && (
          <button
            type="button"
            aria-label={`Delete ${mom.title}`}
            title="Delete this meeting"
            onClick={() => onDelete(mom)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:border-gray-700 dark:hover:border-red-500/30 dark:hover:bg-red-500/10"
          >
            <LuTrash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
