/**
 * Tasks have exactly two levels: a task (depth 0) and its subtasks (depth 1).
 * A subtask can't have subtasks of its own — the API rejects it, and the UI
 * doesn't offer it. This is the one place the number lives on the frontend
 * (the backend has the matching `MAX_SUBTASK_DEPTH` in task.constants.ts).
 */
export const MAX_SUBTASK_DEPTH = 1;

/** Whether a task at `depth` may have subtasks added under it. */
export function canHaveSubtasks(depth: number): boolean {
  return depth < MAX_SUBTASK_DEPTH;
}
