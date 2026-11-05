"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LuArrowLeft, LuPlus, LuSparkles, LuCircleCheck } from "react-icons/lu";
import MomSectionCard from "./MomSectionCard";
import MomCreatedModal from "./MomCreatedModal";
import MomTaskEditor, { DraftErrorsProvider } from "./MomTaskFields";
import ParticipantsPicker from "./ParticipantsPicker";
import DecisionsInput, { type Decision } from "./DecisionsInput";
import { useMomAccessGuard } from "./useMomAccessGuard";
import { useMomCreateAccessGuard } from "./useMomCreateAccess";
import { SingleDateField } from "@/components/accounts/accountingFilters";
import { momService } from "@/services/mom.service";
import { departmentService } from "@/services/department.service";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspaceManageAccess } from "@/hooks/useWorkspaceManageAccess";
import { useMyDepartment } from "@/hooks/useMyDepartment";
import { useDepartments } from "@/hooks/useDepartments";
import { useProjects } from "@/context/ProjectContext";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { dateLabelClass, fieldClass, labelClass } from "./momFormStyles";
import {
  newTaskDraft,
  collectDraftProblems,
  collectSubtaskProblems,
  scrollToDraftRow,
  toDraftErrors,
  type DraftErrors,
  filterTaskAssignees,
  type TaskDraft,
} from "./momTaskDraft";
import { applyTaskExtras, toIsoDateTime } from "./momTaskSave";
import type { MeetingTask } from "@/types/mom";
import { meetingsListHref } from "./momRoutes";

/** `SingleDateField` works in yyyy-mm-dd, not an ISO timestamp. */
function todayForInput(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Create MOM.
 *
 * `POST /meetings` creates the meeting and its top-level tasks in one call,
 * but knows nothing about subtasks, start dates or second assignees. Those
 * are applied afterwards through the task endpoints — see `applyTaskExtras`.
 * The user sees a single "Save"; the orchestration is this component's job.
 */
export default function CreateMomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  // Two separate checks: no MoM access at all (redirects to "/") versus MoM
  // access but not create access — a view-only department member (redirects
  // to their department's meetings).
  const noAccess = useMomAccessGuard();
  const noCreateAccess = useMomCreateAccessGuard();
  const blocked = noAccess || noCreateAccess;

  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const { members } = useWorkspaceMembers();
  const { projects } = useProjects();
  const { canManageWorkspace } = useWorkspaceManageAccess();
  /* Only fetched for OWNER/MANAGER — a department-scoped MEMBER has their
     own department auto-applied server-side and never sees this picker, so
     there's nothing for this query to back for them. */
  const { departments } = useDepartments();
  const { departmentId: myDepartmentId } = useMyDepartment();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayForInput());
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  /* Preselects when arriving from a department's own page (still just a
     starting value — OWNER/MANAGER can change it via the picker below). */
  const [departmentId, setDepartmentId] = useState(
    () => searchParams.get("departmentId") ?? ""
  );

  // The department participants must actually belong to — OWNER/MANAGER's
  // own picker selection, or a department member's fixed one (auto-applied
  // server-side regardless of what's sent, so there's nothing to pick).
  const effectiveDepartmentId = canManageWorkspace ? departmentId || null : myDepartmentId;

  const departmentDetailQuery = useQuery({
    queryKey: queryKeys.department(effectiveDepartmentId ?? ""),
    queryFn: () => departmentService.getById(effectiveDepartmentId!),
    enabled: Boolean(effectiveDepartmentId),
    staleTime: 30_000,
  });
  const [summary, setSummary] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  /* Starts empty — clicking "Add another task" is what reveals the first
     editable row, same as every other "add" affordance in this module. No
     row is ever pre-opened for the user to either fill in or ignore. */
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [saving, setSaving] = useState(false);
  /* Rows that failed validation on the last save — highlighted red in place. */
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});
  const [created, setCreated] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [savedTaskCount, setSavedTaskCount] = useState(0);

  /* A pending invite has no user account yet, so its id is an invite id the
     API would reject as a participant or assignee. */
  const assignable = useMemo(
    () => members.filter((member) => member.inviteStatus !== "PENDING"),
    [members]
  );

  // A department-tagged meeting can only take that department's own members
  // as participants (enforced server-side too — see
  // MeetingService.assertUsersAreDepartmentMembers). No department selected
  // (OWNER/MANAGER's "workspace-general" choice) leaves the full roster open.
  const participantCandidates = useMemo(() => {
    if (!effectiveDepartmentId) return assignable;
    const allowedIds = new Set(
      departmentDetailQuery.data?.members.map((m) => m.user.id) ?? []
    );
    return assignable.filter((member) => allowedIds.has(member.id));
  }, [assignable, effectiveDepartmentId, departmentDetailQuery.data]);

  // Switching departments (or clearing it) can leave previously-picked
  // participants — and follow-up task/subtask assignees, same roster —
  // outside the new one. Drop them rather than silently submitting an
  // invalid list.
  useEffect(() => {
    if (!effectiveDepartmentId) return;
    const allowedIds = new Set(participantCandidates.map((m) => m.id));
    setParticipantIds((current) => current.filter((id) => allowedIds.has(id)));
    setTasks((current) => filterTaskAssignees(current, allowedIds));
  }, [effectiveDepartmentId, participantCandidates]);

  const projectOptions = useMemo(
    () => projects.map((project) => ({ id: project.id, name: project.name })),
    [projects]
  );

  const replaceTask = (next: TaskDraft) =>
    setTasks((current) =>
      current.map((task) => (task.id === next.id ? next : task))
    );

  const handleSave = async () => {
    const trimmedTitle = title.trim();

    /* Validated here rather than letting the API 400, so the message points at
       the field instead of reading as a server error. */
    if (!trimmedTitle) {
      toast.error("Give the meeting a title.");
      return;
    }
    if (participantIds.length === 0) {
      toast.error("Add at least one participant.");
      return;
    }

    /* Clicking "Add task"/"Add subtask" commits to that row existing — every
       one added is validated, none silently dropped for being left blank.
       That used to happen for a row nobody got around to filling in, and it
       discarded whatever the user meant to add with no feedback at all. */
    const problems = collectDraftProblems(tasks);
    setDraftErrors(toDraftErrors(problems));
    if (problems.length > 0) {
      const extra = problems.length > 1 ? ` (+${problems.length - 1} more)` : "";
      toast.error(`${problems[0].message}${extra}`);
      scrollToDraftRow(problems[0].id);
      return;
    }

    const filled = tasks;

    setSaving(true);
    try {
      const meeting = await momService.create({
        title: trimmedTitle,
        meetingDate: toIsoDateTime(date),
        participantIds,
        // Non-managers never send this — their own department is applied
        // server-side regardless of what (if anything) is sent here.
        departmentId: canManageWorkspace ? departmentId || undefined : undefined,
        summary: summary.trim() || undefined,
        decisions: decisions.length
          ? decisions.map((decision) => decision.text)
          : undefined,
        tasks: filled.length
          ? filled.map((task) => ({
              title: task.title.trim(),
              projectId: task.projectId,
              listId: task.listId,
              /* The API records exactly one assignee; whoever was picked first
                 is that one, and the rest are added straight after. */
              assigneeId: task.assigneeIds[0],
              dueDate: task.dueDate ? toIsoDateTime(task.dueDate) : undefined,
            }))
          : undefined,
      });

      /* Pair each draft with the task the server created for it. Titles are
         matched first because the response is ordered by creation time, which
         should mirror input order but is not a documented guarantee; position
         is the fallback for duplicate titles. */
      const unclaimed: MeetingTask[] = [...meeting.tasks];
      const failures: string[] = [];
      for (const draft of filled) {
        const byTitle = unclaimed.findIndex(
          (task) => task.title === draft.title.trim()
        );
        const [createdTask] = unclaimed.splice(byTitle >= 0 ? byTitle : 0, 1);
        if (!createdTask) continue;

        await applyTaskExtras(
          createdTask.id,
          createdTask.status.id,
          draft.assigneeIds.slice(1),
          draft.startDate,
          draft.subtasks,
          failures
        );
      }

      // Both are stale now: the list gains a row, the detail gains subtasks.
      queryClient.invalidateQueries({ queryKey: queryKeys.moms(workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mom(meeting.id) });

      if (failures.length > 0) {
        toast.warning(
          `Meeting saved, but ${failures.length} follow-up ${
            failures.length === 1 ? "detail" : "details"
          } couldn't be applied: ${failures.slice(0, 3).join(", ")}${
            failures.length > 3 ? "…" : ""
          }`
        );
      }

      setCreatedId(meeting.id);
      /* Counted from what the server actually created, not from the form —
         blank rows were dropped, so the two numbers can differ. */
      setSavedTaskCount(meeting.taskStats.total);
      setCreated(true);
    } catch (err) {
      const { message, details } = parseApiError(err);
      /* The API returns field-level errors for validation failures; the first
         one is more useful than the generic "Validation failed". */
      toast.error(details?.[0]?.message ?? message ?? "Couldn't save the MOM.");
    } finally {
      setSaving(false);
    }
  };

  // The guard is redirecting; render nothing rather than flashing the form.
  if (blocked) return null;

  return (
    /* The page itself does not scroll — only the form column does, so the
       header and the tips panel stay put. */
    <DraftErrorsProvider value={draftErrors}>
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="shrink-0 px-8 pb-4 pt-6">
        <button
          type="button"
          onClick={() => router.push(meetingsListHref(effectiveDepartmentId))}
          className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <LuArrowLeft className="h-4 w-4" />
          Back to meeting
        </button>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Create MOM
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Document discussion points and assign actionable tasks.
            </p>
          </div>

          {/* Same affordance as the list screen's header, so the primary
              action sits in the same place on both. */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            <LuPlus className="h-4 w-4" />
            Create MOM
          </button>
        </div>
      </div>

      {/* Body: scrolling form beside a sticky tips panel */}
      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden px-8 pb-6">
        <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto rounded-2xl bg-gray-50 p-5 dark:bg-gray-905">
          {/* 01 — Meeting information */}
          <MomSectionCard
            step="01"
            title="Meeting information"
            description="Set the context for everyone who needs it."
          >
            <label className={labelClass} htmlFor="mom-title">
              Meeting title
            </label>
            <input
              id="mom-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Weekly Marketing Meeting"
              className={fieldClass}
            />

            {/* No "Created by" picker: the API records the authenticated user
                as the creator, and update/delete are creator-only — offering a
                choice here would be fiction. */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={dateLabelClass}>Date</label>
                <SingleDateField
                  value={date}
                  onChange={setDate}
                  placeholder="Pick a date"
                />
              </div>

              {/* OWNER/MANAGER only — a department-scoped MEMBER's own
                  department is applied automatically and isn't a choice. */}
              {canManageWorkspace && (
                <div>
                  <label className={labelClass}>Department</label>
                  <select
                    value={departmentId}
                    onChange={(event) => setDepartmentId(event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">No department (workspace-general)</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className={labelClass}>Participants</label>
              <p className="-mt-1 mb-2 text-xs text-gray-400">
                {effectiveDepartmentId
                  ? "Select everyone in the room — scoped to this department"
                  : "Select everyone in the room"}
              </p>
              <ParticipantsPicker
                members={participantCandidates}
                value={participantIds}
                onChange={setParticipantIds}
              />
            </div>
          </MomSectionCard>

          {/* 02 — Meeting summary */}
          <MomSectionCard
            step="02"
            title="Meeting summary"
            description="What should the team remember from this conversation?"
          >
            <label className={labelClass} htmlFor="mom-summary">
              What was discussed?
            </label>
            <textarea
              id="mom-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={6}
              placeholder="Share the main topics, context and key updates..."
              className="w-full resize-y rounded-xl border border-gray-200 bg-white p-3.5 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />

            <div className="mt-4">
              <label className={labelClass}>Decisions made (Optional)</label>
              <DecisionsInput value={decisions} onChange={setDecisions} />
            </div>

            <p className="mt-4 flex items-center gap-2 rounded-xl bg-blue-50 px-3.5 py-3 text-xs text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <LuSparkles className="h-4 w-4 shrink-0" />
              Keep it focused on the context your team will need later.
            </p>
          </MomSectionCard>

          {/* 03 — Follow-up tasks */}
          <MomSectionCard
            step="03"
            title="Follow-up tasks"
            description="Turn the conversation into clear next steps."
          >
            {tasks.length > 0 && (
              <div className="space-y-4">
                {tasks.map((task, index) => (
                  <MomTaskEditor
                    key={task.id}
                    task={task}
                    index={index}
                    members={participantCandidates}
                    projects={projectOptions}
                    onChange={replaceTask}
                    onRemove={() =>
                      setTasks((current) =>
                        current.filter((t) => t.id !== task.id)
                      )
                    }
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setTasks((current) => [...current, newTaskDraft()])}
              className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-600 transition-colors hover:border-brand-500 hover:text-brand-500 dark:border-gray-700 dark:text-gray-300"
            >
              <LuPlus className="h-4 w-4" />
              {tasks.length > 0 ? "Add another task" : "Add task"}
            </button>
          </MomSectionCard>

          {/* Inside the panel and inside the scroll, so they read as the end
              of the form rather than a bar belonging to the page. */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => router.push(meetingsListHref(effectiveDepartmentId))}
              className="rounded-lg border border-gray-200 bg-white px-7 py-2.5 text-sm font-medium text-brand-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-500 px-7 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save MoM"}
            </button>
          </div>
        </div>

        {/* Tips — fixed beside the form, hidden where there is no room for it */}
        <aside className="hidden w-[340px] shrink-0 xl:block">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500">
              <LuSparkles className="h-5 w-5 text-white" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">
              Make it useful later
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              Great MOMs are short, specific and easy to scan. Add the decisions
              and tasks people will refer back to.
            </p>

            <div className="my-5 h-px bg-gray-100 dark:bg-gray-800" />

            <ul className="space-y-3">
              {[
                "Capture outcomes, not every word",
                "Give every task one clear owner",
                "Break big follow-ups into subtasks — progress is counted from them",
              ].map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300"
                >
                  <LuCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <MomCreatedModal
        isOpen={created}
        taskCount={savedTaskCount}
        onBackToList={() => router.push(meetingsListHref(effectiveDepartmentId))}
        onViewMom={() =>
          router.push(
            createdId
              ? `/meetings/${createdId}`
              : meetingsListHref(effectiveDepartmentId)
          )
        }
      />
    </div>
    </DraftErrorsProvider>
  );
}
