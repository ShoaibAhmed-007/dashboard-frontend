import type { WorkspaceMemberRole } from "@/services/workspace.service";

/** Workspace roles that can edit any task's title and description. Mirrors the
 *  backend's `TASK_CONTENT_EDITOR_ROLES` (task.constants.ts). */
const CONTENT_EDITOR_ROLES: readonly WorkspaceMemberRole[] = ["OWNER", "MANAGER"];

/**
 * Whether the viewer may change a task's title or description: its creator, or
 * a workspace owner/manager. Being assigned to the task is not enough.
 * Everything else on a task (status, priority, dates, assignees, tags) is open
 * to every member. The server enforces the same rule; this only decides whether
 * to offer the editing controls at all.
 */
export function canEditTaskContent(
  task: { creator: { id: string } },
  userId: string | undefined,
  role: WorkspaceMemberRole | null
): boolean {
  if (!userId) return false;
  if (task.creator.id === userId) return true;
  return role !== null && CONTENT_EDITOR_ROLES.includes(role);
}
