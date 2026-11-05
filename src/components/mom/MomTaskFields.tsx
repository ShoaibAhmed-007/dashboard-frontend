"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { LuCornerDownRight, LuPlus, LuTrash2 } from "react-icons/lu";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import AssigneePicker from "@/components/projects/AssigneePicker";
import { SingleDateField } from "@/components/accounts/accountingFilters";
import { useTaskLists } from "@/context/TaskListContext";
import type { WorkspaceMember } from "@/services/workspace.service";
import type { TaskAssignee } from "@/services/task.service";
import { cn } from "@/lib/utils";
import { dateLabelClass, fieldClass, labelClass } from "./momFormStyles";
import {
  MAX_SUBTASK_DEPTH,
  formatTaskNumber,
  newSubtaskDraft,
  updateSubtaskTree,
  type DraftErrors,
  type DraftField,
  type SubtaskDraft,
  type TaskDraft,
} from "./momTaskDraft";

type ProjectOption = { id: string; name: string };

/**
 * Rows that failed validation on the last save attempt. Provided by the page
 * and read by each row, so the error reaches a deeply nested subtask without
 * threading a prop through every level. A flag only shows while the field is
 * still invalid, so fixing it clears the highlight with no extra state.
 */
const DraftErrorsContext = createContext<DraftErrors>({});
export const DraftErrorsProvider = DraftErrorsContext.Provider;

const invalidRing = "rounded-lg ring-1 ring-red-500";

/**
 * Adapts a list of user ids to the shape `AssigneePicker` renders — it shows
 * avatars for `TaskAssignee`s, and the form only holds ids.
 */
function toAssignees(
  ids: string[],
  byId: Map<string, WorkspaceMember>
): TaskAssignee[] {
  return ids.flatMap((id) => {
    const member = byId.get(id);
    return member
      ? [
          {
            user: {
              id: member.id,
              fullName: member.fullName,
              avatarUrl: member.avatarUrl,
              avatarColor: member.avatarColor,
            },
            /* Display-only adapter: nothing has been assigned yet, so there
               is no assigner. The picker never reads this field. */
            assignedBy: "",
          },
        ]
      : [];
  });
}

/**
 * The editable fields one task or subtask row shares.
 *
 * Assignees are picked with the same avatar control tasks use elsewhere in
 * the app, so a MOM follow-up looks like what it becomes — an ordinary task.
 * Project only appears at the top level: a subtask always lives in its
 * parent's project, so asking again would only invite a mismatch.
 */
export function RowFields({
  draftId,
  numberLabel,
  parentLabel,
  title,
  projectId,
  projects,
  listId,
  assigneeIds,
  startDate,
  dueDate,
  members,
  onChange,
  onRemove,
  canAddSubtask,
  onAddSubtask,
}: {
  /** Id of the draft this row edits — looks up its validation errors. */
  draftId: string;
  numberLabel: string;
  /** "Subtask of 01" — absent on a top-level task. */
  parentLabel?: string;
  title: string;
  /** Present only on a top-level task. */
  projectId?: string;
  projects?: ProjectOption[];
  /** Present only on a top-level task — a subtask files under its parent's. */
  listId?: string;
  assigneeIds: string[];
  startDate: string;
  dueDate: string;
  members: WorkspaceMember[];
  onChange: (patch: {
    title?: string;
    projectId?: string;
    listId?: string;
    assigneeIds?: string[];
    startDate?: string;
    dueDate?: string;
  }) => void;
  /** Absent when this is the only row and removing it would strand the user. */
  onRemove?: () => void;
  canAddSubtask: boolean;
  onAddSubtask: () => void;
}) {
  const byId = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );
  const assignees = useMemo(
    () => toAssignees(assigneeIds, byId),
    [assigneeIds, byId]
  );

  const isTopLevel = projects !== undefined;

  const rowErrors = useContext(DraftErrorsContext)[draftId] ?? {};
  /* Flagged only while still invalid — fixing the field clears it. */
  const flagged = (field: DraftField, stillInvalid: boolean) =>
    Boolean(rowErrors[field]) && stillInvalid;
  const titleFlagged = flagged("title", !title.trim());
  const projectFlagged = flagged("project", !projectId);
  const listFlagged = flagged("list", !listId);
  const assigneeFlagged = flagged("assignee", assigneeIds.length === 0);

  const { getLists, getProjectLists } = useTaskLists();
  useEffect(() => {
    if (isTopLevel && projectId) void getLists(projectId);
  }, [isTopLevel, projectId, getLists]);
  const lists = isTopLevel && projectId ? getProjectLists(projectId) : [];

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-md bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-gray-100 dark:text-gray-900">
            {numberLabel}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isTopLevel ? "Task" : "Subtask"}
          </span>
          {parentLabel && (
            <span className="flex min-w-0 items-center gap-1 truncate text-xs text-gray-400">
              <LuCornerDownRight className="h-3 w-3 shrink-0" />
              {parentLabel}
            </span>
          )}
        </span>

        {onRemove && (
          <button
            type="button"
            aria-label={`Remove ${isTopLevel ? "task" : "subtask"} ${numberLabel}`}
            onClick={onRemove}
            className="rounded p-1.5 text-gray-400 transition-colors hover:text-red-500"
          >
            <LuTrash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <input
        type="text"
        value={title}
        onChange={(event) => onChange({ title: event.target.value })}
        placeholder={isTopLevel ? "What needs to happen?" : "What is this step?"}
        aria-label={`${isTopLevel ? "Task" : "Subtask"} ${numberLabel} title`}
        aria-invalid={titleFlagged}
        className={cn("mt-3", fieldClass, titleFlagged && "border-red-500 ring-1 ring-red-500")}
      />
      {titleFlagged && (
        <p role="alert" className="mt-1.5 text-xs text-red-500">
          {isTopLevel ? "Give the task a title." : "Give the subtask a title."}
        </p>
      )}

      <div
        className={`mt-3 grid gap-4 ${
          isTopLevel ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-3"
        }`}
      >
        {isTopLevel && (
          <>
            <div>
              {/* Same self-margin quirk as SingleDateField, hence dateLabelClass. */}
              <label className={dateLabelClass}>Project</label>
              <div className={cn(projectFlagged && invalidRing)}>
              <AccountingSelect
                value={projectId ?? ""}
                label="Project"
                onChange={(value) => onChange({ projectId: value, listId: "" })}
                options={[
                  { value: "", label: "Select a project" },
                  ...(projects ?? []).map((project) => ({
                    value: project.id,
                    label: project.name,
                  })),
                ]}
              />
              </div>
            </div>

            <div>
              <label className={dateLabelClass}>List</label>
              <div className={cn(listFlagged && invalidRing)}>
              <AccountingSelect
                value={listId ?? ""}
                label="List"
                disabled={!projectId}
                onChange={(value) => onChange({ listId: value })}
                options={[
                  { value: "", label: projectId ? "Select a list" : "Pick a project first" },
                  ...lists.map((list) => ({ value: list.id, label: list.name })),
                ]}
              />
              </div>
            </div>
          </>
        )}

        <div>
          <label className={labelClass}>Assigned to</label>
          {/* Avatars, not a <select>: several people can own one follow-up,
              and this is the control every other task in the app uses. */}
          <div className={cn("h-10 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800", assigneeFlagged && "border-red-500 ring-1 ring-red-500")}>
            <AssigneePicker
              fillContainer
              assignees={assignees}
              members={members}
              showLabel
              onAdd={(userId) =>
                onChange({ assigneeIds: [...assigneeIds, userId] })
              }
              onRemove={(userId) =>
                onChange({
                  assigneeIds: assigneeIds.filter((id) => id !== userId),
                })
              }
            />
          </div>
        </div>

        <div>
          <label className={dateLabelClass}>Start date</label>
          <SingleDateField
            value={startDate}
            max={dueDate || undefined}
            onChange={(iso) => onChange({ startDate: iso })}
            placeholder="Pick a date"
            clearable
          />
        </div>

        <div>
          <label className={dateLabelClass}>Due date</label>
          {/* Without a due date the server reports 0% and can never flag the
              task late — so this is optional, but not free. */}
          <SingleDateField
            value={dueDate}
            min={startDate || undefined}
            onChange={(iso) => onChange({ dueDate: iso })}
            placeholder="Pick a date"
            clearable
          />
        </div>
      </div>

      {canAddSubtask && (
        <button
          type="button"
          onClick={onAddSubtask}
          className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-500 transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10"
        >
          <LuPlus className="h-3.5 w-3.5" />
          Add subtask
        </button>
      )}
    </>
  );
}

/**
 * A subtask row plus, recursively, its own subtasks — indented under the
 * parent and labelled with where they sit ("Subtask of 01.2"), so the tree
 * reads at a glance without anyone counting indents.
 *
 * Exported so Edit MOM can render a parent's *pending, not-yet-created*
 * subtask drafts with this exact component — the same local-draft tree Create
 * MOM uses, reused rather than reimplemented.
 */
export function SubtaskRows({
  subtasks,
  path,
  depth,
  members,
  onChange,
}: {
  subtasks: SubtaskDraft[];
  /** Numbering of the parent, e.g. [1] for task 01, [1, 2] for subtask 01.2. */
  path: number[];
  depth: number;
  members: WorkspaceMember[];
  onChange: (next: SubtaskDraft[]) => void;
}) {
  if (subtasks.length === 0) return null;
  const parentLabel = `Subtask of ${formatTaskNumber(path)}`;

  return (
    <div className="mt-3 space-y-3 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
      {subtasks.map((subtask, index) => {
        const ownPath = [...path, index + 1];
        return (
          <div
            key={subtask.id}
            id={`mom-draft-${subtask.id}`}
            className="rounded-xl bg-white p-4 dark:bg-gray-900"
          >
            <RowFields
              draftId={subtask.id}
              numberLabel={formatTaskNumber(ownPath)}
              parentLabel={parentLabel}
              title={subtask.title}
              assigneeIds={subtask.assigneeIds}
              startDate={subtask.startDate}
              dueDate={subtask.dueDate}
              members={members}
              onChange={(patch) =>
                onChange(
                  updateSubtaskTree(subtasks, subtask.id, (current) => ({
                    ...current,
                    ...patch,
                  }))
                )
              }
              onRemove={() =>
                onChange(updateSubtaskTree(subtasks, subtask.id, () => null))
              }
              canAddSubtask={depth < MAX_SUBTASK_DEPTH}
              onAddSubtask={() =>
                onChange(
                  updateSubtaskTree(subtasks, subtask.id, (current) => ({
                    ...current,
                    subtasks: [...current.subtasks, newSubtaskDraft()],
                  }))
                )
              }
            />
            <SubtaskRows
              subtasks={subtask.subtasks}
              path={ownPath}
              depth={depth + 1}
              members={members}
              onChange={(next) =>
                onChange(
                  updateSubtaskTree(subtasks, subtask.id, (current) => ({
                    ...current,
                    subtasks: next,
                  }))
                )
              }
            />
          </div>
        );
      })}
    </div>
  );
}

/** One top-level follow-up task with its whole subtask tree. */
export default function MomTaskEditor({
  task,
  index,
  members,
  projects,
  onChange,
  onRemove,
}: {
  task: TaskDraft;
  /** Zero-based position in the task list; shown as "01", "02", … */
  index: number;
  members: WorkspaceMember[];
  projects: ProjectOption[];
  onChange: (next: TaskDraft) => void;
  onRemove?: () => void;
}) {
  const path = [index + 1];
  return (
    <div
      id={`mom-draft-${task.id}`}
      className="rounded-xl bg-gray-50 p-4 dark:bg-gray-905"
    >
      <RowFields
        draftId={task.id}
        numberLabel={formatTaskNumber(path)}
        title={task.title}
        projectId={task.projectId}
        projects={projects}
        listId={task.listId}
        assigneeIds={task.assigneeIds}
        startDate={task.startDate}
        dueDate={task.dueDate}
        members={members}
        onChange={(patch) => onChange({ ...task, ...patch })}
        onRemove={onRemove}
        canAddSubtask
        onAddSubtask={() =>
          onChange({ ...task, subtasks: [...task.subtasks, newSubtaskDraft()] })
        }
      />
      <SubtaskRows
        subtasks={task.subtasks}
        path={path}
        depth={1}
        members={members}
        onChange={(next) => onChange({ ...task, subtasks: next })}
      />
    </div>
  );
}
