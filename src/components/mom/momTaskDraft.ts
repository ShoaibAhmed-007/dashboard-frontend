/**
 * Form-side model for the Follow-up tasks section.
 *
 * The API's `POST /meetings` takes a flat task list with one assignee and no
 * dates beyond `dueDate`. Everything richer here — extra assignees, a start
 * date, the subtask tree — is applied *after* the meeting exists, through the
 * ordinary task endpoints (`/tasks/:id/subtasks`, `/tasks/:id/assignees`,
 * `PATCH /tasks/:id`). The draft therefore carries more than the create call
 * accepts, and `CreateMomPage` orchestrates the follow-up calls.
 */

/**
 * A task has subtasks, but a subtask can't have its own: `POST /tasks/:id/subtasks`
 * on a subtask is rejected, so the form never offers "Add subtask" below the
 * first level. Re-exported from the shared task-hierarchy rule.
 */
export { MAX_SUBTASK_DEPTH } from "@/lib/taskHierarchy";

export type SubtaskDraft = {
  id: string;
  title: string;
  /** Every assignee is added via `POST /tasks/:id/assignees` after creation —
   *  the subtask endpoint itself takes none. */
  assigneeIds: string[];
  /** yyyy-mm-dd, as `SingleDateField` works in; converted on save. */
  startDate: string;
  dueDate: string;
  subtasks: SubtaskDraft[];
};

export type TaskDraft = {
  id: string;
  title: string;
  /** Required by the API. */
  projectId: string;
  /** Which of the project's lists the task is filed in. Required — cleared
   *  whenever `projectId` changes, since a list only makes sense for the
   *  project it belongs to. */
  listId: string;
  /**
   * The first id is sent as the meeting API's single `assigneeId`; the rest
   * are added afterwards. Order therefore matters slightly: whoever is picked
   * first is the one the meeting itself records.
   */
  assigneeIds: string[];
  startDate: string;
  dueDate: string;
  subtasks: SubtaskDraft[];
};

let seq = 0;
/** Unique within a session; these ids never reach the server. */
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

export function newTaskDraft(): TaskDraft {
  return {
    id: nextId("task"),
    title: "",
    projectId: "",
    listId: "",
    assigneeIds: [],
    startDate: "",
    dueDate: "",
    subtasks: [],
  };
}

export function newSubtaskDraft(): SubtaskDraft {
  return {
    id: nextId("subtask"),
    title: "",
    assigneeIds: [],
    startDate: "",
    dueDate: "",
    subtasks: [],
  };
}

/**
 * Immutable update of one subtask anywhere in a task's tree.
 *
 * Returns the same array reference when nothing matched, so a no-op does not
 * force a re-render of every row.
 */
export function updateSubtaskTree(
  subtasks: SubtaskDraft[],
  targetId: string,
  fn: (subtask: SubtaskDraft) => SubtaskDraft | null
): SubtaskDraft[] {
  let changed = false;
  const next: SubtaskDraft[] = [];
  for (const subtask of subtasks) {
    if (subtask.id === targetId) {
      changed = true;
      const result = fn(subtask);
      if (result) next.push(result); // null = remove
      continue;
    }
    const children = updateSubtaskTree(subtask.subtasks, targetId, fn);
    if (children !== subtask.subtasks) {
      changed = true;
      next.push({ ...subtask, subtasks: children });
    } else {
      next.push(subtask);
    }
  }
  return changed ? next : subtasks;
}

/**
 * Drops any assignee (task or subtask, anywhere in the tree) no longer in
 * `allowedIds` — used when the effective department changes and narrows who
 * can be assigned, so a stale pick can't be silently submitted.
 */
export function filterTaskAssignees(
  tasks: TaskDraft[],
  allowedIds: Set<string>
): TaskDraft[] {
  return tasks.map((task) => ({
    ...task,
    assigneeIds: task.assigneeIds.filter((id) => allowedIds.has(id)),
    subtasks: filterSubtaskAssignees(task.subtasks, allowedIds),
  }));
}

function filterSubtaskAssignees(
  subtasks: SubtaskDraft[],
  allowedIds: Set<string>
): SubtaskDraft[] {
  return subtasks.map((subtask) => ({
    ...subtask,
    assigneeIds: subtask.assigneeIds.filter((id) => allowedIds.has(id)),
    subtasks: filterSubtaskAssignees(subtask.subtasks, allowedIds),
  }));
}

/** "01", "01.2", "01.2.1" — the label a row shows for its place in the tree. */
export function formatTaskNumber(path: number[]): string {
  return path
    .map((n, index) => (index === 0 ? String(n).padStart(2, "0") : String(n)))
    .join(".");
}

/**
 * `null` if the row is complete enough to save; otherwise the reason it
 * isn't. Clicking "Add task"/"Add subtask" commits to that row existing —
 * there is no "leave it blank and it quietly disappears" exception, since
 * that silently discarded whatever the user meant to add with no feedback
 * at all. The only way to back out of an added row is to remove it
 * explicitly. A top-level task needs a title, a project, a list within it,
 * and at least one assignee.
 */
export function taskDraftError(task: TaskDraft): string | null {
  return taskDraftIssues(task)[0]?.message ?? null;
}

/** Which field of a draft row is the problem — drives the red highlight. */
export type DraftField = "title" | "project" | "list" | "assignee";
export type DraftIssue = { field: DraftField; message: string };

/** Every problem with one top-level task row, in field order. */
export function taskDraftIssues(task: TaskDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (!task.title.trim()) issues.push({ field: "title", message: "Give the task a title." });
  if (!task.projectId) issues.push({ field: "project", message: "Pick a project for the task." });
  if (!task.listId) issues.push({ field: "list", message: "Pick a list for the task." });
  if (task.assigneeIds.length === 0) issues.push({ field: "assignee", message: "Pick an assignee for the task." });
  return issues;
}

/**
 * Same idea for one subtask — but a subtask has no project of its own (it
 * always lives in its parent's), and no assignee requirement either, since
 * the subtask-creation endpoint doesn't accept one at creation time and
 * Create MOM has never required one. Only a title is non-negotiable.
 */
export function subtaskDraftError(subtask: SubtaskDraft): string | null {
  if (!subtask.title.trim()) return "Give the subtask a title.";
  return null;
}

/** One invalid row: which draft, which field, and a message that names the row. */
export type DraftProblem = DraftIssue & { id: string };
/** Draft id -> the fields still flagged on it. Read by `RowFields`. */
export type DraftErrors = Record<string, Partial<Record<DraftField, string>>>;

/**
 * Every invalid row among top-level tasks and their subtask trees, in the
 * order they appear on screen. `startIndex` offsets the numbering for Edit MOM,
 * where new tasks follow the meeting's existing ones.
 */
export function collectDraftProblems(
  tasks: TaskDraft[],
  startIndex = 0
): DraftProblem[] {
  const problems: DraftProblem[] = [];
  tasks.forEach((task, index) => {
    const path = [startIndex + index + 1];
    for (const issue of taskDraftIssues(task)) {
      problems.push({
        id: task.id,
        field: issue.field,
        message: `Task ${formatTaskNumber(path)}: ${issue.message}`,
      });
    }
    problems.push(...collectSubtaskProblems(task.subtasks, path));
  });
  return problems;
}

/** Subtask rows only. `path` is the parent's number; omit it when unknown. */
export function collectSubtaskProblems(
  subtasks: SubtaskDraft[],
  path?: number[]
): DraftProblem[] {
  const problems: DraftProblem[] = [];
  subtasks.forEach((subtask, index) => {
    const ownPath = path ? [...path, index + 1] : undefined;
    const message = subtaskDraftError(subtask);
    if (message) {
      problems.push({
        id: subtask.id,
        field: "title",
        message: ownPath ? `Subtask ${formatTaskNumber(ownPath)}: ${message}` : message,
      });
    }
    problems.push(...collectSubtaskProblems(subtask.subtasks, ownPath));
  });
  return problems;
}

export function toDraftErrors(problems: DraftProblem[]): DraftErrors {
  const errors: DraftErrors = {};
  for (const problem of problems) {
    (errors[problem.id] ??= {})[problem.field] = problem.message;
  }
  return errors;
}

/** Scrolls a draft row (task or subtask) into the middle of the viewport. */
export function scrollToDraftRow(id: string): void {
  requestAnimationFrame(() => {
    document
      .getElementById(`mom-draft-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/**
 * The first blank subtask anywhere in a tree (this level or nested), or
 * `null` if every one of them has a title. Depth-first, so a nested problem
 * is reported before a sibling later in the list — order the user would
 * actually scroll to first.
 */
export function findSubtaskDraftError(
  subtasks: SubtaskDraft[]
): string | null {
  for (const subtask of subtasks) {
    const error = subtaskDraftError(subtask);
    if (error) return error;
    const nested = findSubtaskDraftError(subtask.subtasks);
    if (nested) return nested;
  }
  return null;
}
