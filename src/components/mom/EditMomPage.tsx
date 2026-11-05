"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LuArrowLeft,
  LuCircleCheck,
  LuInfo,
  LuSparkles,
} from "react-icons/lu";
import { LuPlus } from "react-icons/lu";
import MomSectionCard from "./MomSectionCard";
import ParticipantsPicker from "./ParticipantsPicker";
import EditMomTaskList from "./EditMomTaskRow";
import MomTaskEditor, { DraftErrorsProvider } from "./MomTaskFields";
import DecisionsInput, { type Decision } from "./DecisionsInput";
import { SingleDateField } from "@/components/accounts/accountingFilters";
import { dateLabelClass, fieldClass, labelClass } from "./momFormStyles";
import { momService } from "@/services/mom.service";
import { queryKeys } from "@/queries/keys";
import { departmentService } from "@/services/department.service";
import { parseApiError } from "@/lib/api";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useProjects } from "@/context/ProjectContext";
import {
  newTaskDraft,
  collectDraftProblems,
  collectSubtaskProblems,
  scrollToDraftRow,
  toDraftErrors,
  type DraftErrors,
  type SubtaskDraft,
  type TaskDraft,
} from "./momTaskDraft";
import { applyTaskExtras } from "./momTaskSave";
import type { Meeting, UpdateMeetingPayload } from "@/types/mom";

/** `SingleDateField` works in yyyy-mm-dd; the API wants a full ISO datetime. */
function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** Noon, so a local-midnight value cannot land on the previous day in UTC. */
function toIsoDateTime(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

/**
 * Edit MOM — the same form as Create for everything the API will accept.
 *
 * Section 03 (Follow-up tasks) can't be part of that: `PATCH /meetings/:id`
 * has no `tasks` field and silently discards one if sent (verified — it
 * returns 200 and changes nothing). So existing tasks are edited directly
 * through their own endpoints instead — title and dates via
 * `PATCH /tasks/:id`, assignees via `POST`/`DELETE /tasks/:id/assignees` — one
 * field at a time, the moment it changes, rather than batched into the
 * meeting save. The row looks identical to Create's task editor; only the
 * Project field is gone, since a task's project isn't something this form
 * moves it between.
 */
export default function EditMomPage({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const { members } = useWorkspaceMembers();
  const { projects } = useProjects();

  const [title, setTitle] = useState(meeting.title);
  const [date, setDate] = useState(toDateInput(meeting.meetingDate));
  const [participantIds, setParticipantIds] = useState<string[]>(
    meeting.participants.map((entry) => entry.user.id)
  );
  const [summary, setSummary] = useState(meeting.summary ?? "");
  const [decisions, setDecisions] = useState<Decision[]>(
    meeting.decisions.map((text, index) => ({
      id: `decision-${index}`,
      text,
    }))
  );
  /* Brand-new follow-up tasks, staged exactly like Create MOM's own `tasks`
     state: nothing here touches the network until "Save changes" is clicked.
     Existing tasks (`EditMomTaskList` below) are unrelated to this — they
     keep saving each field instantly, as they always have. */
  const [newTasks, setNewTasks] = useState<TaskDraft[]>([]);
  /* Brand-new subtasks staged under an *existing* task/subtask, keyed by that
     row's real id. Same staged-until-save rule as `newTasks` above — an
     existing subtask's own title/assignees/dates are untouched by this and
     keep saving instantly, only the act of adding a new one is deferred.
     `statusId` is the parent's own status (captured by the row that owns the
     "Add subtask" button, since a fresh subtask files into that same
     column) — carried alongside the drafts so `handleSave` doesn't need to
     re-fetch every parent's status at save time. */
  const [pendingSubtasksByParent, setPendingSubtasksByParent] = useState<
    Record<string, { statusId: string; drafts: SubtaskDraft[] }>
  >({});
  const setPendingSubtasksFor = (
    parentId: string,
    statusId: string,
    drafts: SubtaskDraft[]
  ) =>
    setPendingSubtasksByParent((current) => ({
      ...current,
      [parentId]: { statusId, drafts },
    }));
  const [saving, setSaving] = useState(false);
  /* Rows that failed validation on the last save — highlighted red in place. */
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});

  /* A pending invite has no user account yet, so its id is an invite id the
     API would reject as a participant. */
  const assignable = useMemo(
    () => members.filter((member) => member.inviteStatus !== "PENDING"),
    [members]
  );

  /* A department-tagged meeting only accepts that department's members — as
     participants and as task assignees. The API rejects anyone else, and only
     after the meeting is already saved, which is what produced "task assignees
     are not members of this department". Narrow every picker to match. Until
     the roster loads (or for a workspace-general meeting) the full list stays
     open. */
  const departmentDetailQuery = useQuery({
    queryKey: queryKeys.department(meeting.departmentId ?? ""),
    queryFn: () => departmentService.getById(meeting.departmentId!),
    enabled: Boolean(meeting.departmentId),
    staleTime: 30_000,
  });
  const departmentAssignable = useMemo(() => {
    if (!meeting.departmentId || !departmentDetailQuery.data) return assignable;
    const allowedIds = new Set(
      departmentDetailQuery.data.members.map((m) => m.user.id)
    );
    return assignable.filter((member) => allowedIds.has(member.id));
  }, [assignable, meeting.departmentId, departmentDetailQuery.data]);

  /* Participants already on the meeting stay listed even if they have since
     left the department, so their chips don't silently disappear from the
     picker; only *new* picks are limited to the department. */
  const participantOptions = useMemo(() => {
    const current = new Set(meeting.participants.map((entry) => entry.user.id));
    const allowed = new Set(departmentAssignable.map((member) => member.id));
    return assignable.filter(
      (member) => allowed.has(member.id) || current.has(member.id)
    );
  }, [assignable, departmentAssignable, meeting.participants]);

  const projectOptions = useMemo(
    () => projects.map((project) => ({ id: project.id, name: project.name })),
    [projects]
  );

  const backToMeeting = () => router.push(`/meetings/${meeting.id}`);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Give the meeting a title.");
      return;
    }
    if (participantIds.length === 0) {
      toast.error("A meeting needs at least one participant.");
      return;
    }

    /* Clicking "Add another task"/"Add subtask" commits to that row
       existing — every one added is validated, none silently dropped for
       being left blank. That used to happen for a row nobody got around to
       filling in, and it discarded whatever the user meant to add with no
       feedback at all. The only way to back out of an added row is to
       remove it explicitly. */
    /* Pending subtasks under existing tasks aren't numbered here — their
       parent rows number them — so those messages carry no "Subtask 01.2". */
    const problems = [
      ...collectDraftProblems(newTasks, meeting.tasks.length),
      ...Object.values(pendingSubtasksByParent).flatMap((entry) =>
        collectSubtaskProblems(entry.drafts)
      ),
    ];
    setDraftErrors(toDraftErrors(problems));
    if (problems.length > 0) {
      const extra = problems.length > 1 ? ` (+${problems.length - 1} more)` : "";
      toast.error(`${problems[0].message}${extra}`);
      scrollToDraftRow(problems[0].id);
      return;
    }

    const filledNewTasks = newTasks;

    const hasPendingSubtasks = Object.values(pendingSubtasksByParent).some(
      (entry) => entry.drafts.length > 0
    );

    /* Only changed fields are sent. The endpoint rejects an empty body with
       422, and sending everything every time would replace the participant
       and decision arrays wholesale for no reason. */
    const patch: UpdateMeetingPayload = {};
    if (trimmedTitle !== meeting.title) patch.title = trimmedTitle;
    if (date !== toDateInput(meeting.meetingDate)) {
      patch.meetingDate = toIsoDateTime(date);
    }

    const nextSummary = summary.trim();
    const currentSummary = meeting.summary ?? "";
    if (nextSummary !== currentSummary) {
      // `null` is how the API clears it — an empty string is not accepted.
      patch.summary = nextSummary === "" ? null : nextSummary;
    }

    const nextDecisions = decisions.map((decision) => decision.text);
    if (
      nextDecisions.length !== meeting.decisions.length ||
      nextDecisions.some((text, index) => text !== meeting.decisions[index])
    ) {
      patch.decisions = nextDecisions;
    }

    const currentParticipants = meeting.participants.map(
      (entry) => entry.user.id
    );
    if (
      participantIds.length !== currentParticipants.length ||
      participantIds.some((id) => !currentParticipants.includes(id))
    ) {
      patch.participantIds = participantIds;
    }

    if (
      Object.keys(patch).length === 0 &&
      filledNewTasks.length === 0 &&
      !hasPendingSubtasks
    ) {
      toast.info(
        "Nothing to save — edits to existing follow-ups are already saved as you make them."
      );
      return;
    }

    setSaving(true);
    try {
      if (Object.keys(patch).length > 0) {
        const updated = await momService.update(meeting.id, patch);
        /* Seed the detail cache so navigating back shows the new values
           without a refetch, and drop the list so its row reflects them too. */
        queryClient.setQueryData(queryKeys.mom(meeting.id), updated);
        queryClient.invalidateQueries({ queryKey: queryKeys.moms(workspaceId) });
      }

      const failures: string[] = [];
      /* Identifies which task in addTask's response is the one just created.
         Title matching isn't safe here: a new task's title can collide with
         an existing one, or with another new task added earlier in this same
         loop (whose id is already in the response by the time this task is
         created) — either way `.find()` would silently apply this task's
         extras (assignees, start date, subtasks) to the wrong row. Excluding
         everything already known to exist, and growing that set as each new
         task lands, keeps every iteration unambiguous regardless of title. */
      const knownTaskIds = new Set(meeting.tasks.map((task) => task.id));
      for (const draft of filledNewTasks) {
        try {
          const created = await momService.addTask(meeting.id, {
            title: draft.title.trim(),
            projectId: draft.projectId,
            /* The API records exactly one assignee; whoever was picked first
               is that one, and the rest are added straight after. */
            assigneeId: draft.assigneeIds[0],
            dueDate: draft.dueDate ? toIsoDateTime(draft.dueDate) : undefined,
          });
          const createdTask = created.tasks.find(
            (task) => !knownTaskIds.has(task.id)
          );
          if (!createdTask) continue;
          knownTaskIds.add(createdTask.id);

          await applyTaskExtras(
            createdTask.id,
            createdTask.status.id,
            draft.assigneeIds.slice(1),
            draft.startDate,
            draft.subtasks,
            failures
          );
        } catch (err) {
          failures.push(
            parseApiError(err).message || `task "${draft.title.trim()}"`
          );
        }
      }

      /* New subtasks staged under an *existing* task/subtask — a bare pass
         through applyTaskExtras with no assignees/startDate of its own to
         apply, since the parent already exists and isn't being touched here;
         only its `subtasks` list (the pending drafts, already validated
         above) actually creates anything. */
      const pendingEntries = Object.entries(pendingSubtasksByParent).filter(
        ([, entry]) => entry.drafts.length > 0
      );
      for (const [parentId, { statusId, drafts }] of pendingEntries) {
        await applyTaskExtras(parentId, statusId, [], "", drafts, failures);
      }

      if (filledNewTasks.length > 0 || pendingEntries.length > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.mom(meeting.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.moms(workspaceId) });
      }

      if (failures.length > 0) {
        toast.warning(
          `Saved, but ${failures.length} ${
            failures.length === 1 ? "detail" : "details"
          } couldn't be applied: ${failures.slice(0, 3).join(", ")}${
            failures.length > 3 ? "…" : ""
          }`
        );
      } else {
        toast.success("Meeting updated.");
      }
      backToMeeting();
    } catch (err) {
      const { message, details } = parseApiError(err);
      toast.error(
        details?.[0]?.message ?? message ?? "Couldn't save the changes."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DraftErrorsProvider value={draftErrors}>
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-gray-900">
      <div className="shrink-0 px-8 pb-4 pt-6">
        <button
          type="button"
          onClick={backToMeeting}
          className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <LuArrowLeft className="h-4 w-4" />
          Back to meeting
        </button>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Edit MOM
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Update the record of this meeting.
            </p>
          </div>
        </div>
      </div>

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

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={dateLabelClass}>Date</label>
                <SingleDateField
                  value={date}
                  onChange={setDate}
                  placeholder="Pick a date"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>Participants</label>
              <p className="-mt-1 mb-2 text-xs text-gray-400">
                Select everyone in the room
              </p>
              <ParticipantsPicker
                members={participantOptions}
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
          </MomSectionCard>

          {/* 03 — Follow-up tasks */}
          <MomSectionCard
            step="03"
            title="Follow-up tasks"
            description="Edit an existing follow-up, or open it for its status and subtasks."
          >
            <p className="mb-4 flex items-start gap-2 rounded-xl bg-blue-50 px-3.5 py-3 text-xs text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <LuInfo className="mt-0.5 h-4 w-4 shrink-0" />
              Existing follow-ups save instantly as you edit them — title,
              assignees and dates aren&apos;t part of &quot;Save
              changes&quot; below. The project a task lives in can&apos;t be
              changed here; open the task to move it. A task or subtask you
              add below is different: it&apos;s only created once you click
              &quot;Save changes&quot;.
            </p>

            <div className="mb-4">
              <EditMomTaskList
                tasks={meeting.tasks}
                members={departmentAssignable}
                pendingSubtasksByParent={pendingSubtasksByParent}
                onPendingSubtasksChange={setPendingSubtasksFor}
                onChanged={() =>
                  queryClient.invalidateQueries({
                    queryKey: queryKeys.mom(meeting.id),
                  })
                }
              />
            </div>

            {newTasks.length > 0 && (
              <div className="mb-4 space-y-4">
                {newTasks.map((task, index) => (
                  <MomTaskEditor
                    key={task.id}
                    task={task}
                    index={meeting.tasks.length + index}
                    members={departmentAssignable}
                    projects={projectOptions}
                    onChange={(next) =>
                      setNewTasks((current) =>
                        current.map((item) =>
                          item.id === next.id ? next : item
                        )
                      )
                    }
                    onRemove={() =>
                      setNewTasks((current) =>
                        current.filter((item) => item.id !== task.id)
                      )
                    }
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setNewTasks((current) => [...current, newTaskDraft()])
              }
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-brand-500 transition-colors hover:bg-brand-50 dark:border-gray-700 dark:hover:bg-brand-500/10"
            >
              <LuPlus className="h-4 w-4" />
              {meeting.tasks.length > 0 || newTasks.length > 0
                ? "Add another task"
                : "Add task"}
            </button>
          </MomSectionCard>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={backToMeeting}
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
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        {/* Tips — mirrors the Create screen's aside */}
        <aside className="hidden w-[340px] shrink-0 xl:block">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500">
              <LuSparkles className="h-5 w-5 text-white" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">
              Keep it current
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              Correcting the record is fine — what people refer back to is the
              summary and the decisions, so keep those accurate.
            </p>

            <div className="my-5 h-px bg-gray-100 dark:bg-gray-800" />

            <ul className="space-y-3">
              {[
                "Only the creator can edit this meeting",
                "Follow-ups are edited as tasks",
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
    </div>
    </DraftErrorsProvider>
  );
}
