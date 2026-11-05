/**
 * Minutes of Meeting.
 *
 * These mirror what `/api/v1/meetings` actually returns, verified against the
 * running API rather than transcribed from the integration doc. The backend
 * calls the entity a "Meeting"; the product calls it a MOM. The types use the
 * API's own vocabulary so a field can be traced straight to a response.
 */

/** The user shape every meeting endpoint embeds. */
export type UserBrief = {
  id: string;
  fullName: string;
  /** A URL or an `initials:AB` token — same convention as the chat/user APIs. */
  avatarUrl: string | null;
  avatarColor: string;
};

/**
 * Follow-up counts. `completed` means the task sits in its project's terminal
 * (`isClosed`) status column — **not** the separate "mark complete" checkbox,
 * which has no effect on these numbers.
 */
export type MeetingTaskStats = {
  total: number;
  completed: number;
  pending: number;
};

/** A status column, as the task system defines it. */
export type MeetingTaskStatus = {
  id: string;
  name: string;
  /** Hex, authored per project — the timeline bar tints from this. */
  color: string;
  group: "NOT_STARTED" | "ACTIVE" | "DONE" | "CLOSED";
  /** The real "is it finished" flag; drives `taskStats.completed`. */
  isClosed: boolean;
};

/**
 * A follow-up task created from a meeting. It is an ordinary task — editing it
 * goes through `/tasks/:id`, never through the meeting.
 */
export type MeetingTask = {
  id: string;
  taskNumber: number;
  title: string;
  createdAt: string;
  /**
   * Always `null` for meeting-created tasks: the create DTO has no field for
   * it.
   */
  startDate: string | null;
  dueDate: string | null;
  status: MeetingTaskStatus;
  list: { project: { id: string; name: string; taskIdPrefix: string } };
  assignees: Array<{ user: UserBrief }>;
  /** Raw subtasks. Returned so `progress`/`subtaskStats` are auditable — read
   *  those directly rather than re-deriving from this. */
  children: Array<{ id: string; title: string; status: { isClosed: boolean } }>;
  /**
   * 0-100, computed fresh per response — never date-derived. Subtask-based
   * (real completion ratio) when the task has children; otherwise 0 while
   * open, since there is nothing else to measure it by. A task in a
   * finished-but-not-closed column (group DONE, e.g. "Review") reads 90 and is
   * never `isLate`. Always 100 once `status.isClosed`. Lateness is reported separately via `isLate`, never
   * folded into this number.
   */
  progress: number;
  /** `dueDate` has passed and the task is not closed. Never true when closed. */
  isLate: boolean;
  /** Non-null only when the task has subtasks. */
  subtaskStats: { total: number; completed: number } | null;
};

/** A meeting's Department tag, as embedded on both Meeting and
 *  MeetingListItem — null means workspace-general (no department). */
export type MeetingDepartment = {
  id: string;
  name: string;
  color: string;
};

/** Full detail — `GET /meetings/:meetingId`, and what create/update return. */
export type Meeting = {
  id: string;
  workspaceId: string;
  title: string;
  meetingDate: string;
  summary: string | null;
  decisions: string[];
  /** The creator's user id. Update and delete are creator-only. */
  createdBy: string;
  /** Null = workspace-general. Auto-applied to the creator's own department
   *  for a non-OWNER/MANAGER creator; optionally chosen by OWNER/MANAGER;
   *  not editable after creation. */
  departmentId: string | null;
  department: MeetingDepartment | null;
  createdAt: string;
  updatedAt: string;
  creator: UserBrief;
  /** Wrapped, not a flat user array — the API nests under `user`. */
  participants: Array<{ user: UserBrief }>;
  tasks: MeetingTask[];
  taskStats: MeetingTaskStats;
};

/**
 * A row from `GET /meetings`. Deliberately lighter than {@link Meeting}: no
 * `summary`, `decisions`, `tasks`, `workspaceId` or `updatedAt` — fetch the
 * detail endpoint for those.
 */
export type MeetingListItem = {
  id: string;
  title: string;
  meetingDate: string;
  createdAt: string;
  departmentId: string | null;
  department: MeetingDepartment | null;
  creator: UserBrief;
  participants: Array<{ user: UserBrief }>;
  taskStats: MeetingTaskStats;
};

/** The app's standard paginated envelope. */
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

export type CreateMeetingTaskPayload = {
  /** 1-500 chars. */
  title: string;
  /** Required. */
  projectId: string;
  /** Which of the project's lists to file the task in. Omit to fall back to
   *  the project's first (non-archived) list. */
  listId?: string;
  /** Required, single. Must be able to access `projectId`. */
  assigneeId: string;
  /** ISO datetime. Used for `isLate` (overdue-and-open), not for `progress`. */
  dueDate?: string;
};

export type CreateMeetingPayload = {
  /** 1-300 chars. */
  title: string;
  /** ISO datetime. */
  meetingDate: string;
  /** At least one, all workspace members. */
  participantIds: string[];
  /** OWNER/MANAGER only — ignored server-side for anyone else, whose own
   *  department is auto-applied instead. Omit for a workspace-general
   *  meeting. */
  departmentId?: string;
  /** Up to 20000 chars. */
  summary?: string;
  /** Each 1-1000 chars. */
  decisions?: string[];
  tasks?: CreateMeetingTaskPayload[];
};

/**
 * Every field optional, but at least one is required — an empty body is
 * rejected with 422. `decisions` and `participantIds` **replace** their arrays
 * wholesale rather than merging.
 */
export type UpdateMeetingPayload = {
  title?: string;
  meetingDate?: string;
  /** `null` explicitly clears it. */
  summary?: string | null;
  decisions?: string[];
  participantIds?: string[];
};

/**
 * Which slice of the list is shown.
 *
 * `pending` is "has open follow-ups", not "assigned to me": the list endpoint
 * returns only `taskStats`, with no per-task assignee to filter on.
 */
export type MomFilter = "all" | "mine" | "pending";
