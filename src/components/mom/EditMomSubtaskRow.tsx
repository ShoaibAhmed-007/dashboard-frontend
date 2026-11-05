"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LuCornerDownRight, LuEye, LuExternalLink, LuPlus, LuTrash2 } from "react-icons/lu";
import AssigneePicker from "@/components/projects/AssigneePicker";
import { SingleDateField } from "@/components/accounts/accountingFilters";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { SubtaskRows } from "./MomTaskFields";
import { taskService } from "@/services/task.service";
import { useTaskStore } from "@/stores/task.store";
import { parseApiError } from "@/lib/api";
import { dateLabelClass, fieldClass, labelClass } from "./momFormStyles";
import {
  MAX_SUBTASK_DEPTH,
  formatTaskNumber,
  newSubtaskDraft,
  type SubtaskDraft,
} from "./momTaskDraft";
import type { WorkspaceMember } from "@/services/workspace.service";
import type { TaskAssignee, TaskListItem } from "@/services/task.service";

/** yyyy-mm-dd, or "" for null — what `SingleDateField` and the form both use. */
function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

/** Noon, so a local-midnight value cannot land on the previous day in UTC. */
function toIsoDateTime(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

const subtasksKey = (taskId: string) => ["task-subtasks", taskId] as const;

/**
 * One subtask, editable in place, with its own subtasks nested recursively
 * beneath it — the same card shape Create uses for every depth, so a subtask
 * in Edit looks and behaves like the one you'd have built when creating the
 * meeting.
 *
 * A subtask is a plain `Task` row server-side (only `parentId`/`depth`
 * distinguish it), so it takes the exact same endpoints as the top-level task
 * in `EditMomTaskRow`: `PATCH /tasks/:id` for title/dates,
 * `POST`/`DELETE /tasks/:id/assignees` for assignees, `DELETE /tasks/:id`
 * (which cascades to its own children) to remove it.
 */
function EditMomSubtaskRow({
  subtask,
  path,
  depth,
  projectId,
  members,
  pendingSubtasksByParent,
  onPendingSubtasksChange,
  onChanged,
}: {
  subtask: TaskListItem;
  /** This row's number path, e.g. [1, 2] for subtask 01.2. */
  path: number[];
  /** 1 for a direct child of a task, 2 for a child of that. */
  depth: number;
  projectId: string;
  members: WorkspaceMember[];
  /** New sub-subtasks staged under any task/subtask, keyed by its id, each
   *  entry carrying that parent's own `statusId` — the whole map is threaded
   *  down so this row can read its own slice and hand the same map to
   *  whatever it renders beneath it. */
  pendingSubtasksByParent: Record<string, { statusId: string; drafts: SubtaskDraft[] }>;
  onPendingSubtasksChange: (
    parentId: string,
    statusId: string,
    next: SubtaskDraft[]
  ) => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const openTaskDetail = useTaskStore((state) => state.openTaskDetail);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(subtask.title);
  const [dueDate, setDueDate] = useState(toDateInput(subtask.dueDate));
  const [startDate, setStartDate] = useState(toDateInput(subtask.startDate));
  const [savingTitle, setSavingTitle] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setTitle(subtask.title), [subtask.title]);
  useEffect(() => setDueDate(toDateInput(subtask.dueDate)), [subtask.dueDate]);
  useEffect(
    () => setStartDate(toDateInput(subtask.startDate)),
    [subtask.startDate]
  );

  /* A subtask can't take new subtasks, but nested ones that already exist
     (created before that rule) are left exactly as they are: still listed and
     editable here, just with no way to add more. */
  const canAddSubtasks = depth < MAX_SUBTASK_DEPTH;
  const hasExistingChildren = subtask._count.children > 0;
  const grandchildren = useQuery({
    queryKey: subtasksKey(subtask.id),
    queryFn: () => taskService.getSubtasks(subtask.id),
    enabled: expanded && (canAddSubtasks || hasExistingChildren),
    staleTime: 30_000,
  });

  const refetchChildren = () =>
    queryClient.invalidateQueries({ queryKey: subtasksKey(subtask.id) });

  const pendingSubtasks = pendingSubtasksByParent[subtask.id]?.drafts ?? [];

  const assignees: TaskAssignee[] = useMemo(
    () =>
      subtask.assignees.map((entry) => ({
        user: entry.user,
        assignedBy: "", // Display-only adapter; the picker never reads it.
      })),
    [subtask.assignees]
  );

  const saveTitle = async () => {
    const trimmed = title.trim();
    if (trimmed === subtask.title) return;
    if (!trimmed) {
      setTitle(subtask.title);
      return;
    }
    setSavingTitle(true);
    try {
      await taskService.update(subtask.id, { title: trimmed });
      onChanged();
    } catch (err) {
      setTitle(subtask.title);
      toast.error(parseApiError(err).message || "Couldn't rename the subtask.");
    } finally {
      setSavingTitle(false);
    }
  };

  const saveDate = async (field: "startDate" | "dueDate", value: string) => {
    const current = field === "startDate" ? startDate : dueDate;
    const setValue = field === "startDate" ? setStartDate : setDueDate;
    if (value === current) return;

    setValue(value);
    try {
      await taskService.update(subtask.id, {
        [field]: value ? toIsoDateTime(value) : null,
      });
      onChanged();
      toast.success(
        `${field === "startDate" ? "Start" : "Due"} date ${value ? "updated" : "cleared"}.`
      );
    } catch (err) {
      setValue(current);
      toast.error(parseApiError(err).message || "Couldn't update the date.");
    }
  };

  const addAssignee = async (userId: string) => {
    try {
      await taskService.addAssignee(subtask.id, [userId]);
      onChanged();
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't add that assignee.");
    }
  };

  const removeAssignee = async (userId: string) => {
    try {
      await taskService.removeAssignee(subtask.id, userId);
      onChanged();
    } catch (err) {
      toast.error(
        parseApiError(err).message || "Couldn't remove that assignee."
      );
    }
  };

  const deleteSubtask = async () => {
    setDeleting(true);
    try {
      await taskService.delete(subtask.id);
      toast.success(`"${subtask.title}" was deleted.`);
      setConfirmingDelete(false);
      onChanged();
    } catch (err) {
      /* Same creator-or-OWNER gate as any task delete — the row cannot know
         in advance whether it applies, so the button is always shown and a
         403 is reported if it does. */
      toast.error(parseApiError(err).message || "Couldn't delete the subtask.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-4 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-md bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-gray-100 dark:text-gray-900">
            {formatTaskNumber(path)}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Subtask
          </span>
          <span className="flex min-w-0 items-center gap-1 truncate text-xs text-gray-400">
            <LuCornerDownRight className="h-3 w-3 shrink-0" />
            Subtask of {formatTaskNumber(path.slice(0, -1))}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={`View ${subtask.title}`}
            title="View this task"
            onClick={() => void openTaskDetail(subtask.id)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <LuEye className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Go to ${subtask.title} in its project`}
            title="Go to this task in its project"
            onClick={() =>
              router.push(
                `/projects?projectId=${projectId}&highlightTaskId=${subtask.id}`
              )
            }
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <LuExternalLink className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${subtask.title}`}
            title="Delete this subtask"
            onClick={() => setConfirmingDelete(true)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
          >
            <LuTrash2 className="h-4 w-4" />
          </button>
        </span>
      </div>

      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => void saveTitle()}
        disabled={savingTitle}
        placeholder="What is this step?"
        aria-label={`Subtask ${formatTaskNumber(path)} title`}
        className={`mt-3 ${fieldClass} disabled:opacity-60`}
      />

      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Assigned to</label>
          <div className="h-10 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <AssigneePicker
              fillContainer
              assignees={assignees}
              members={members}
              showLabel
              onAdd={(userId) => void addAssignee(userId)}
              onRemove={(userId) => void removeAssignee(userId)}
            />
          </div>
        </div>

        <div>
          <label className={dateLabelClass}>Start date</label>
          <SingleDateField
            value={startDate}
            max={dueDate || undefined}
            onChange={(iso) => void saveDate("startDate", iso)}
            placeholder="Pick a date"
            clearable
          />
        </div>

        <div>
          <label className={dateLabelClass}>Due date</label>
          <SingleDateField
            value={dueDate}
            min={startDate || undefined}
            onChange={(iso) => void saveDate("dueDate", iso)}
            placeholder="Pick a date"
            clearable
          />
        </div>
      </div>

      {/* Only a top-level task takes subtasks — the task system rejects them
          under a subtask, so no "Add subtask" is offered here; a subtask that
          already has nested ones (legacy) still gets its show/hide toggle.
          Nothing to show or hide yet when there are no subtasks at all
          (existing or staged), so the row skips straight to "Add subtask"
          instead of a toggle with nothing behind it. */}
      {(canAddSubtasks || hasExistingChildren) && (
        <>
          {subtask._count.children > 0 || pendingSubtasks.length > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {expanded
                ? "Hide subtasks"
                : `Show ${subtask._count.children + pendingSubtasks.length} subtask${
                    subtask._count.children + pendingSubtasks.length === 1
                      ? ""
                      : "s"
                  }`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setExpanded(true);
                onPendingSubtasksChange(subtask.id, subtask.status.id, [
                  newSubtaskDraft(),
                ]);
              }}
              className="mt-3 flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-medium text-brand-500 transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10"
            >
              <LuPlus className="h-3.5 w-3.5" />
              Add subtask
            </button>
          )}

          {expanded && (
            <div className="mt-3 space-y-3 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
              {grandchildren.isLoading && (
                <p className="text-xs text-gray-400">Loading…</p>
              )}
              {grandchildren.data?.map((grandchild, index) => (
                <EditMomSubtaskRow
                  key={grandchild.id}
                  subtask={grandchild}
                  path={[...path, index + 1]}
                  depth={depth + 1}
                  projectId={projectId}
                  members={members}
                  pendingSubtasksByParent={pendingSubtasksByParent}
                  onPendingSubtasksChange={onPendingSubtasksChange}
                  onChanged={() => {
                    refetchChildren();
                    onChanged();
                  }}
                />
              ))}

              {canAddSubtasks && (
                <>
                  {/* New sub-subtasks — staged locally, created only on "Save
                      changes", exactly like Create MOM's own subtask tree. */}
                  <SubtaskRows
                    subtasks={pendingSubtasks}
                    path={path}
                    depth={depth + 1}
                    members={members}
                    onChange={(next) =>
                      onPendingSubtasksChange(subtask.id, subtask.status.id, next)
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      onPendingSubtasksChange(subtask.id, subtask.status.id, [
                        ...pendingSubtasks,
                        newSubtaskDraft(),
                      ])
                    }
                    className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-500 transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10"
                  >
                    <LuPlus className="h-3.5 w-3.5" />
                    Add subtask
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmActionModal
        isOpen={confirmingDelete}
        title={`Delete "${subtask.title}"?`}
        description={
          subtask._count.children > 0
            ? `This will also delete its ${subtask._count.children} subtask${
                subtask._count.children === 1 ? "" : "s"
              }. This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete subtask"
        isLoading={deleting}
        onConfirm={() => void deleteSubtask()}
        onClose={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

export { EditMomSubtaskRow };
