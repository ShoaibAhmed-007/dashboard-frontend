"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { LuCornerDownRight, LuEye, LuExternalLink, LuTrash2 } from "react-icons/lu";
import { toast } from "sonner";
import { LuPlus } from "react-icons/lu";
import AssigneePicker from "@/components/projects/AssigneePicker";
import { SingleDateField } from "@/components/accounts/accountingFilters";
import { EditMomSubtaskRow } from "./EditMomSubtaskRow";
import { SubtaskRows } from "./MomTaskFields";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { taskService } from "@/services/task.service";
import { useTaskStore } from "@/stores/task.store";
import { parseApiError } from "@/lib/api";
import { dateLabelClass, fieldClass, labelClass } from "./momFormStyles";
import { formatTaskNumber, newSubtaskDraft, type SubtaskDraft } from "./momTaskDraft";
import type { WorkspaceMember } from "@/services/workspace.service";
import type { TaskAssignee } from "@/services/task.service";
import type { MeetingTask } from "@/types/mom";

const subtasksKey = (taskId: string) => ["task-subtasks", taskId] as const;

/** yyyy-mm-dd, or "" for null — what `SingleDateField` and the form both use. */
function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

/** Noon, so a local-midnight value cannot land on the previous day in UTC. */
function toIsoDateTime(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

/**
 * One existing follow-up task, editable in place — same layout as the Create
 * screen's task row, minus the project field.
 *
 * Unlike Create, which batches everything into one `POST /meetings`, this task
 * already exists: every field change here calls its own endpoint —
 * `PATCH /tasks/:id` for title/dates, `POST`/`DELETE /tasks/:id/assignees` for
 * assignees, `DELETE /tasks/:id` to remove it entirely. Title and dates are
 * saved on blur rather than per keystroke, so "still typing" is never
 * mistaken for "done editing"; assignee changes save immediately, matching
 * how the picker behaves everywhere else it's used.
 *
 * A new top-level task is a separate flow (`EditMomAddTaskForm`, via
 * `POST /meetings/:meetingId/tasks`) rather than a row here — this component
 * only ever renders a task that already exists.
 */
export function EditMomTaskRow({
  task,
  index,
  members,
  pendingSubtasksByParent,
  onPendingSubtasksChange,
  onChanged,
}: {
  task: MeetingTask;
  /** Zero-based position among the meeting's top-level tasks; shown as "01". */
  index: number;
  members: WorkspaceMember[];
  /** New subtasks staged under any task/subtask in the whole tree, keyed by
   *  that row's id, each entry carrying the parent's own `statusId` (a fresh
   *  subtask files into that same column) alongside its drafts — not yet
   *  created, created only when "Save changes" is clicked, exactly like
   *  Create MOM's own subtask tree. Existing subtasks below are unrelated to
   *  this and keep saving instantly. The whole map is threaded through
   *  (rather than pre-sliced) so a subtask row can recurse into its own
   *  sub-subtasks using the same map. */
  pendingSubtasksByParent: Record<string, { statusId: string; drafts: SubtaskDraft[] }>;
  onPendingSubtasksChange: (
    parentId: string,
    statusId: string,
    next: SubtaskDraft[]
  ) => void;
  /** Refetches the meeting — called after any save that could move numbers
   *  the parent shows (progress, taskStats), including a delete: the task
   *  disappears from `meeting.tasks` the moment the meeting is refetched,
   *  same as it would after being deleted from the project board directly. */
  onChanged: () => void;
}) {
  const router = useRouter();
  const openTaskDetail = useTaskStore((state) => state.openTaskDetail);

  const queryClient = useQueryClient();

  const [title, setTitle] = useState(task.title);
  const [startDate, setStartDate] = useState(toDateInput(task.startDate));
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate));
  const [savingTitle, setSavingTitle] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  /* The task can change under this row (another tab, a teammate) without this
     component remounting — `useState` alone would go stale. */
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setStartDate(toDateInput(task.startDate)), [task.startDate]);
  useEffect(() => setDueDate(toDateInput(task.dueDate)), [task.dueDate]);

  /* `task.children` (from the meeting response) is the thin shape the
     timeline uses — id/title/status.isClosed only, no assignees or dates. An
     editable row needs the full `TaskListItem`, so subtasks are fetched
     separately here, on expand, same as `EditMomSubtaskRow` fetches its own
     children one level down. */
  const subtasks = useQuery({
    queryKey: subtasksKey(task.id),
    queryFn: () => taskService.getSubtasks(task.id),
    enabled: expanded,
    staleTime: 30_000,
  });

  const refetchSubtasks = () =>
    queryClient.invalidateQueries({ queryKey: subtasksKey(task.id) });

  const pendingSubtasks = pendingSubtasksByParent[task.id]?.drafts ?? [];

  const assignees: TaskAssignee[] = useMemo(
    () =>
      task.assignees.map((entry) => ({
        user: entry.user,
        // Display-only adapter: the picker never reads this field.
        assignedBy: "",
      })),
    [task.assignees]
  );

  const saveTitle = async () => {
    const trimmed = title.trim();
    if (trimmed === task.title) return; // No-op: nothing changed on blur.
    if (!trimmed) {
      setTitle(task.title); // A blanked-out title is not a valid task name.
      return;
    }
    setSavingTitle(true);
    try {
      await taskService.update(task.id, { title: trimmed });
      onChanged();
    } catch (err) {
      setTitle(task.title);
      toast.error(parseApiError(err).message || "Couldn't rename the task.");
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
      await taskService.update(task.id, {
        [field]: value ? toIsoDateTime(value) : null,
      });
      /* A date change can move `progress`/`isLate` — both live on the meeting
         response, not this row's own state — so the parent refetches. */
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
      await taskService.addAssignee(task.id, [userId]);
      onChanged();
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't add that assignee.");
    }
  };

  const removeAssignee = async (userId: string) => {
    try {
      await taskService.removeAssignee(task.id, userId);
      onChanged();
    } catch (err) {
      toast.error(
        parseApiError(err).message || "Couldn't remove that assignee."
      );
    }
  };

  const deleteTask = async () => {
    setDeleting(true);
    try {
      await taskService.delete(task.id);
      /* The server itself deletes a task's whole subtask tree in one
         transaction (cascade soft-delete) — nothing separate to clean up
         here. Refetching the meeting is what makes this row disappear. */
      toast.success(
        task.children.length > 0
          ? `"${task.title}" and its subtasks were deleted.`
          : `"${task.title}" was deleted.`
      );
      setConfirmingDelete(false);
      onChanged();
    } catch (err) {
      /* Delete is gated server-side on the TASK's own creator (or workspace
         OWNER) — a different rule from the meeting's creator-only edit gate,
         and the API exposes no field that would let this row know in advance
         which one applies to it. So the button is always offered here, and a
         403 is reported rather than silently guessed at. */
      toast.error(parseApiError(err).message || "Couldn't delete the task.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-905">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-md bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-gray-100 dark:text-gray-900">
            {formatTaskNumber([index + 1])}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Task
          </span>
          <span className="flex min-w-0 items-center gap-1 truncate text-xs text-gray-400">
            <LuCornerDownRight className="h-3 w-3 shrink-0" />
            {task.list.project.taskIdPrefix}-{task.taskNumber} ·{" "}
            {task.list.project.name}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={`View ${task.title}`}
            title="View this task"
            onClick={() => void openTaskDetail(task.id)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <LuEye className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Go to ${task.title} in its project`}
            title="Go to this task in its project"
            onClick={() =>
              router.push(
                `/projects?projectId=${task.list.project.id}&highlightTaskId=${task.id}`
              )
            }
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <LuExternalLink className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${task.title}`}
            title="Delete this task"
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
        placeholder="What needs to happen?"
        aria-label={`Task ${index + 1} title`}
        className={`mt-3 ${fieldClass} disabled:opacity-60`}
      />

      {/* No Project field here, unlike Create: a task's project is where the
          rest of it — status, list, board position — already lives, and
          moving it is a bigger operation than this form is for. */}
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

      {/* Subtasks — same editable card as Create's, one per row, nested to
          the depth the task system allows. Nothing to show or hide yet when
          there are no subtasks at all (existing or staged), so the row skips
          straight to "Add subtask" instead of a toggle with nothing behind
          it; the toggle only appears once there is something it would
          actually show or hide. */}
      {task.children.length > 0 || pendingSubtasks.length > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {expanded
            ? "Hide subtasks"
            : `Show ${task.children.length + pendingSubtasks.length} subtask${
                task.children.length + pendingSubtasks.length === 1 ? "" : "s"
              }`}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            onPendingSubtasksChange(task.id, task.status.id, [
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
          {subtasks.isLoading && (
            <p className="text-xs text-gray-400">Loading…</p>
          )}
          {subtasks.data?.map((subtask, subIndex) => (
            <EditMomSubtaskRow
              key={subtask.id}
              subtask={subtask}
              path={[index + 1, subIndex + 1]}
              depth={1}
              projectId={task.list.project.id}
              members={members}
              pendingSubtasksByParent={pendingSubtasksByParent}
              onPendingSubtasksChange={onPendingSubtasksChange}
              onChanged={() => {
                refetchSubtasks();
                onChanged();
              }}
            />
          ))}

          {/* New subtasks — staged locally, created only on "Save changes",
              exactly like Create MOM's own subtask tree. */}
          <SubtaskRows
            subtasks={pendingSubtasks}
            path={[index + 1]}
            depth={1}
            members={members}
            onChange={(next) =>
              onPendingSubtasksChange(task.id, task.status.id, next)
            }
          />

          <button
            type="button"
            onClick={() =>
              onPendingSubtasksChange(task.id, task.status.id, [
                ...pendingSubtasks,
                newSubtaskDraft(),
              ])
            }
            className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-500 transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10"
          >
            <LuPlus className="h-3.5 w-3.5" />
            Add subtask
          </button>
        </div>
      )}

      <ConfirmActionModal
        isOpen={confirmingDelete}
        title={`Delete "${task.title}"?`}
        description={
          task.children.length > 0
            ? `This will also delete its ${task.children.length} subtask${
                task.children.length === 1 ? "" : "s"
              }. This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete task"
        isLoading={deleting}
        onConfirm={() => void deleteTask()}
        onClose={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

/**
 * Every follow-up task on the meeting, each editable in place — title,
 * assignees, dates and subtasks — laid out exactly like Create's task list.
 */
export default function EditMomTaskList({
  tasks,
  members,
  pendingSubtasksByParent,
  onPendingSubtasksChange,
  onChanged,
}: {
  tasks: MeetingTask[];
  members: WorkspaceMember[];
  /** New subtasks staged under each task, keyed by that task's id — owned by
   *  the page so "Save changes" can read every pending draft in one place. */
  pendingSubtasksByParent: Record<string, { statusId: string; drafts: SubtaskDraft[] }>;
  onPendingSubtasksChange: (
    parentId: string,
    statusId: string,
    next: SubtaskDraft[]
  ) => void;
  onChanged: () => void;
}) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400 dark:bg-gray-905">
        This meeting has no follow-up tasks.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task, index) => (
        <EditMomTaskRow
          key={task.id}
          task={task}
          index={index}
          members={members}
          pendingSubtasksByParent={pendingSubtasksByParent}
          onPendingSubtasksChange={onPendingSubtasksChange}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}
