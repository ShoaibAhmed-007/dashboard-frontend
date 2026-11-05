import { taskService } from "@/services/task.service";
import type { SubtaskDraft } from "./momTaskDraft";

/**
 * A yyyy-mm-dd date as an ISO datetime.
 *
 * The API validates with `z.string().datetime()`, which rejects a bare date —
 * it has to carry a time and a `Z`. Noon avoids a local-midnight value landing
 * on the previous day once converted to UTC.
 */
export function toIsoDateTime(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

/**
 * Applies everything a task-creation call could not: extra assignees, a start
 * date, and the subtask tree. Each is an ordinary task-endpoint call on a task
 * that now exists. Shared by Create MOM (every task is new) and Edit MOM
 * (only newly-added tasks/subtasks go through this — existing ones save their
 * own fields instantly and never reach this function).
 *
 * Failures are collected rather than thrown: by the time this runs the parent
 * task already exists, and one subtask failing must not read as the whole
 * save having failed. The caller reports the tally.
 */
export async function applyTaskExtras(
  taskId: string,
  statusId: string,
  assigneeIds: string[],
  startDate: string,
  subtasks: SubtaskDraft[],
  failures: string[]
): Promise<void> {
  if (assigneeIds.length > 0) {
    try {
      await taskService.addAssignee(taskId, assigneeIds);
    } catch {
      failures.push("assignees");
    }
  }

  if (startDate) {
    try {
      await taskService.update(taskId, { startDate: toIsoDateTime(startDate) });
    } catch {
      failures.push("start date");
    }
  }

  for (const subtask of subtasks) {
    try {
      /* The subtask endpoint takes both dates directly, so unlike the top
         level nothing needs a follow-up PATCH. It inherits the parent's
         status — the project's first NOT_STARTED column — so a new subtask
         starts as "To Do" rather than whatever the parent has moved to. */
      const created = await taskService.createSubtask(taskId, {
        title: subtask.title.trim(),
        statusId,
        startDate: subtask.startDate ? toIsoDateTime(subtask.startDate) : null,
        dueDate: subtask.dueDate ? toIsoDateTime(subtask.dueDate) : null,
      });
      await applyTaskExtras(
        created.id,
        statusId,
        subtask.assigneeIds,
        "",
        subtask.subtasks,
        failures
      );
    } catch {
      failures.push(`subtask "${subtask.title.trim()}"`);
    }
  }
}
