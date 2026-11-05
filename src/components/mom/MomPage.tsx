"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LuPlus, LuSearch, LuUserPlus, LuX } from "react-icons/lu";
import MomEmptyState from "./MomEmptyState";
import MomCard from "./MomCard";
import { useMomAccessGuard } from "./useMomAccessGuard";
import { useMomCreateAccess } from "./useMomCreateAccess";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import DepartmentMembersModal from "@/components/departments/DepartmentMembersModal";
import { momService } from "@/services/mom.service";
import { departmentService } from "@/services/department.service";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import type { DepartmentMember } from "@/types/department";
import type { MeetingListItem, MomFilter } from "@/types/mom";

/* "Pending Tasks" reads as "assigned to me", which the list endpoint cannot
   answer — it returns only `taskStats`, with no per-task assignee. The tab is
   named for what the data actually supports. */
const TABS: { key: MomFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "My Meetings" },
  { key: "pending", label: "Open Follow-ups" },
];

/** One page is plenty for a meeting list; `GET /meetings` caps `limit` at 100. */
const PAGE_SIZE = 50;

/**
 * Minutes of Meeting — the module's list screen.
 *
 * Search and tabs are applied to the fetched page rather than the server:
 * `GET /meetings` supports only `page`/`limit`/`departmentId`, with no other
 * filter or search param. The rest is derived during render rather than
 * stored, so what is on screen can never disagree with the controls above it.
 *
 * With a `departmentId`, this is OWNER/MANAGER's department-detail screen
 * (reached from a department card on `/departments`): the same list, scoped,
 * plus the department's own member roster and an "Add Member" entry point
 * (DepartmentMembersModal, reused as-is). Without one, it's the flat
 * `/meetings` list every MoM-access caller already had.
 */
export default function MomPage({ departmentId }: { departmentId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MomFilter>("all");
  const [deleting, setDeleting] = useState<MeetingListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [managingMembers, setManagingMembers] = useState(false);
  const [removing, setRemoving] = useState<DepartmentMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const blocked = useMomAccessGuard();
  const { canCreate } = useMomCreateAccess();
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const selfId = useAuthStore((state) => state.user?.id);

  const departmentQuery = useQuery({
    queryKey: queryKeys.department(departmentId ?? ""),
    queryFn: () => departmentService.getById(departmentId!),
    enabled: Boolean(departmentId),
    staleTime: 30_000,
  });
  const department = departmentQuery.data ?? null;

  const query = useQuery({
    queryKey: departmentId
      ? queryKeys.momsByDepartment(workspaceId, departmentId)
      : queryKeys.moms(workspaceId),
    queryFn: () => momService.list({ limit: PAGE_SIZE, departmentId }),
    // Anyone without MoM access would only get a 403; the guard is already
    // redirecting them (see useMomAccessGuard — OWNER/MANAGER or a
    // department member, same condition `blocked` already captures).
    enabled: Boolean(workspaceId) && !blocked,
    staleTime: 60_000,
    /* Progress and "late" are computed from the tasks' own statuses, which are
       changed on other screens (task panel, board) that never touch this
       cache. Refetch on every visit — the cached copy still paints instantly. */
    refetchOnMount: "always",
  });

  const moms = useMemo(() => query.data?.items ?? [], [query.data]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return moms.filter((mom) => {
      /* "My Meetings" is anything the user took part in, not just what they
         created — being in the room is what makes it theirs. Both fields are
         present on list rows, so this needs no extra fetch. */
      if (filter === "mine") {
        const isMine =
          mom.creator.id === selfId ||
          mom.participants.some((entry) => entry.user.id === selfId);
        if (!isMine) return false;
      }

      // Whether anything is still open, for anyone — see the TABS note.
      if (filter === "pending" && mom.taskStats.pending === 0) return false;

      if (!needle) return true;
      return (
        mom.title.toLowerCase().includes(needle) ||
        mom.participants.some((entry) =>
          entry.user.fullName.toLowerCase().includes(needle)
        )
      );
    });
  }, [moms, filter, search, selfId]);

  /* Distinguishes "nothing exists" from "nothing matched", which the empty
     state words differently. */
  const isFiltered = filter !== "all" || search.trim().length > 0;

  const handleCreate = () =>
    router.push(
      departmentId ? `/meetings/create?departmentId=${departmentId}` : "/meetings/create"
    );

  const invalidateMoms = () => {
    queryClient.invalidateQueries({
      queryKey: departmentId
        ? queryKeys.momsByDepartment(workspaceId, departmentId)
        : queryKeys.moms(workspaceId),
    });
  };

  /** Creator-only server-side; the card only shows this for the creator in
   *  the first place. Tasks that were linked to the meeting keep their
   *  status/assignee/history — they just lose the back-link. */
  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await momService.remove(deleting.id);
      invalidateMoms();
      toast.success(`"${deleting.title}" deleted.`);
      setDeleting(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't delete the meeting.");
    } finally {
      setIsDeleting(false);
    }
  };

  /** Same write DepartmentMembersModal uses — kept here too so the inline
   *  chip row can remove someone without opening that modal. */
  const handleRemoveMember = async () => {
    if (!removing || !departmentId) return;
    setIsRemoving(true);
    try {
      await departmentService.assignMember(removing.id, null);
      queryClient.invalidateQueries({ queryKey: queryKeys.department(departmentId) });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      // Same "who am I" cache DepartmentMembersModal's invalidate() clears —
      // see its comment.
      queryClient.invalidateQueries({ queryKey: queryKeys.accountingRole(workspaceId) });
      toast.success(`${removing.user.fullName} removed from ${department?.name}.`);
      setRemoving(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't remove that member.");
    } finally {
      setIsRemoving(false);
    }
  };

  // The guard is redirecting; render nothing rather than flashing the page.
  if (blocked) return null;

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-900">
      <div className="px-6 py-6">
        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Your shared workspace
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">
              {department ? `${department.name} Department` : "Meetings & MOM"}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {departmentId && canCreate && (
              <button
                type="button"
                onClick={() => setManagingMembers(true)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <LuUserPlus className="h-4 w-4" />
                Add Member
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={handleCreate}
                className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
              >
                <LuPlus className="h-4 w-4" />
                Create MOM
              </button>
            )}
          </div>
        </div>

        {department && (
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Existing Members
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {department.members.length === 0 ? (
                <p className="text-sm text-gray-400">No one assigned yet.</p>
              ) : (
                department.members.map((member) => (
                  <span
                    key={member.id}
                    className="flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-1.5 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    {member.user.fullName}
                    {canCreate && (
                      <button
                        type="button"
                        aria-label={`Remove ${member.user.fullName}`}
                        onClick={() => setRemoving(member)}
                        className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                      >
                        <LuX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {/* Search + tabs share one bar, as in the design */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 py-2.5">
          <div className="relative min-w-0 flex-1">
            <LuSearch className="pointer-events-none absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search MOM..."
              aria-label="Search minutes of meeting"
              className="h-9 w-full min-w-0 bg-transparent pl-8 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {TABS.map((tab) => {
              const isActive = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setFilter(tab.key)}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-gray-900 font-medium text-white dark:bg-gray-100 dark:text-gray-900"
                      : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results. The empty state keeps its own bordered card; the populated
            view is a plain grid, since each card carries its own border. */}
        {query.isLoading ? (
          <div className="mt-6 flex items-center justify-center rounded-2xl border border-gray-200 py-24 dark:border-gray-800">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : query.isError ? (
          /* Distinct from "no meetings": the list may well have rows, we just
             could not fetch them, and offering "Create MOM" here would be a
             non-sequitur. */
          <div className="mt-6 rounded-2xl border border-gray-200 px-6 py-20 text-center dark:border-gray-800">
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Couldn&apos;t load meetings
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {parseApiError(query.error).message}
            </p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-6 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-800">
            <MomEmptyState
              isFiltered={isFiltered}
              onCreate={canCreate ? handleCreate : undefined}
            />
          </div>
        ) : (
          <>
            <h2 className="mt-6 text-xl font-bold text-gray-900 dark:text-gray-100">
              Recent meetings
            </h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((mom) => (
                <MomCard
                  key={mom.id}
                  mom={mom}
                  onView={(selected) => router.push(`/meetings/${selected.id}`)}
                  isCreator={mom.creator.id === selfId}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmActionModal
        isOpen={deleting !== null}
        title={deleting ? `Delete "${deleting.title}"?` : ""}
        description={
          deleting && deleting.taskStats.total > 0
            ? `Its ${deleting.taskStats.total} follow-up task${
                deleting.taskStats.total === 1 ? "" : "s"
              } will keep their status, assignee and history — they just won't be linked to this meeting anymore. This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete meeting"
        isLoading={isDeleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />

      {department && managingMembers && (
        <DepartmentMembersModal
          isOpen
          department={department}
          onClose={() => setManagingMembers(false)}
        />
      )}

      <ConfirmActionModal
        isOpen={removing !== null}
        title="Remove from department?"
        description={
          removing
            ? `${removing.user.fullName} will lose Minutes of Meeting access for ${department?.name}.`
            : ""
        }
        confirmLabel="Remove"
        isLoading={isRemoving}
        onClose={() => setRemoving(null)}
        onConfirm={() => void handleRemoveMember()}
      />
    </div>
  );
}
