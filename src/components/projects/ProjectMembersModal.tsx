"use client";

import { useMemo, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LuLock, LuX, LuSearch, LuTrash2 } from "react-icons/lu";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { projectService, type Project, type ProjectMember } from "@/services/project.service";
import { useProjects } from "@/context/ProjectContext";
import { useAuthStore } from "@/stores/auth.store";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";

/** The API caps a batch invite at 50; enforced here so the user sees it first. */
const MAX_BATCH_INVITE = 50;

/**
 * "Sharing & Permissions" — the one place a project's visibility is changed and
 * its members are managed.
 *
 * Both controls are creator-only server-side. A non-creator still opens this to
 * *see* whether the project is private and who else has access; the controls are
 * disabled rather than hidden, so the state is explicable rather than just
 * missing.
 */
export default function ProjectMembersModal({
  isOpen,
  onClose,
  project,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}) {
  const queryClient = useQueryClient();
  const { patchLocalProject, refetch: refetchProjects } = useProjects();
  const currentUser = useAuthStore((s) => s.user);

  // No server flag for this — the creator's id is the only signal.
  const isCreator = !!currentUser && project.createdBy === currentUser.id;
  const isPrivate = project.visibility === "PRIVATE";

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const membersQuery = useQuery({
    queryKey: queryKeys.projectMembers(project.id),
    queryFn: () => projectService.listMembers(project.id),
    enabled: isOpen && isPrivate,
    staleTime: 60_000,
  });

  /* Creator-only endpoint — a plain member calling it gets a 403, so the gate
     is on `enabled`, not just on whether the picker is rendered. */
  const candidatesQuery = useQuery({
    queryKey: queryKeys.projectMemberCandidates(project.id),
    queryFn: () => projectService.listMemberCandidates(project.id),
    enabled: isOpen && isPrivate && isCreator,
    staleTime: 60_000,
  });

  const invalidateMembership = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(project.id) });
    queryClient.invalidateQueries({
      queryKey: queryKeys.projectMemberCandidates(project.id),
    });
  };

  const members = membersQuery.data ?? [];

  /* Candidates arrive pre-annotated with isProjectMember/isCreator, so existing
     members are filtered out here rather than diffed against the member list. */
  const invitable = useMemo(() => {
    const rows = (candidatesQuery.data ?? []).filter(
      (c) => !c.isProjectMember && !c.isCreator
    );
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (c) =>
        c.fullName.toLowerCase().includes(needle) ||
        c.email.toLowerCase().includes(needle)
    );
  }, [candidatesQuery.data, search]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const applyVisibility = async (next: "PUBLIC" | "PRIVATE") => {
    const previous = project.visibility;
    setSavingVisibility(true);
    // Optimistic so the sections below swap immediately; reverted on failure.
    patchLocalProject(project.id, { visibility: next });
    try {
      const updated = await projectService.setVisibility(project.id, next);
      patchLocalProject(project.id, updated);
      invalidateMembership();
      toast.success(
        next === "PRIVATE"
          ? "Project is now private."
          : "Project is now open to the workspace."
      );
    } catch (err) {
      patchLocalProject(project.id, { visibility: previous });
      toast.error(parseApiError(err).message || "Couldn't change visibility.");
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleToggleVisibility = () => {
    if (isPrivate) {
      // Going public exposes the project to everyone — worth a confirmation.
      setConfirmPublic(true);
      return;
    }
    void applyVisibility("PRIVATE");
  };

  const handleInvite = async () => {
    if (selected.size === 0) return;
    setInviting(true);
    try {
      const { summary, results } = await projectService.addMembersBatch(
        project.id,
        Array.from(selected)
      );

      /* This endpoint resolves 201 even when every entry failed, so the outcome
         has to be read from the summary rather than from a resolved promise. */
      if (summary.invited === 0 && summary.failed > 0) {
        toast.error(
          `Couldn't add ${summary.failed} of ${summary.total} ${
            summary.failed === 1 ? "person" : "people"
          }.`
        );
      } else if (summary.failed > 0) {
        toast.warning(`Added ${summary.invited}; ${summary.failed} failed.`);
      } else if (summary.invited === 0 && summary.alreadyMember > 0) {
        toast.info("Everyone selected already has access.");
      } else {
        toast.success(
          `Added ${summary.invited} ${summary.invited === 1 ? "person" : "people"}.`
        );
      }

      // Keep only what failed selected, so a retry doesn't re-send successes.
      const failedIds = new Set(
        results.filter((r) => r.status === "failed").map((r) => r.userId)
      );
      setSelected(failedIds);
      invalidateMembership();
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't add members.");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async () => {
    if (!removing) return;
    setIsRemoving(true);
    try {
      // `userId`, never `removing.id` — that one is the membership row's id.
      await projectService.removeMember(project.id, removing.userId);
      toast.success(`${removing.user.fullName} removed.`);
      setRemoving(null);
      invalidateMembership();
      /* Removal also unassigns them from every task in the project, so the
         board/list caches are now stale. */
      queryClient.invalidateQueries({ queryKey: ["task-board"] });
      queryClient.invalidateQueries({ queryKey: ["task-board-infinite"] });
      refetchProjects();
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't remove member.");
    } finally {
      setIsRemoving(false);
    }
  };

  if (!isOpen) return null;

  const overLimit = selected.size > MAX_BATCH_INVITE;

  return (
    <>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div className="flex max-h-[calc(100vh-4rem)] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
          <div className="flex shrink-0 items-start justify-between p-6 pb-4">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                Sharing &amp; Permissions
              </h2>
              <p className="mt-0.5 truncate text-sm text-gray-400">{project.name}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="ml-4 shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
            {/* ── Visibility ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <div className="flex min-w-0 items-center gap-2.5">
                <LuLock className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-sm font-normal text-gray-800 dark:text-gray-200">
                    Private
                  </p>
                  <p className="text-xs text-gray-500">
                    {isCreator
                      ? "Only you and invited members have access"
                      : "Only the project creator can change visibility"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPrivate}
                aria-label="Make this project private"
                disabled={!isCreator || savingVisibility}
                onClick={handleToggleVisibility}
                /* Matches the app-standard switch (ProfileSettingsForm,
                   university settings): h-6/w-11 track, h-5/w-5 knob. */
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isPrivate ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    isPrivate ? "translate-x-5.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {!isPrivate && (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                This space is open to everyone in the workspace. Make it private
                to choose who has access.
              </p>
            )}

            {isPrivate && (
              <>
                {/* ── Current members ──────────────────────────────────── */}
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  People with access
                </p>
                <div className="mt-2 space-y-0.5">
                  {membersQuery.isLoading && (
                    <p className="py-4 text-center text-sm text-gray-400">
                      Loading members…
                    </p>
                  )}
                  {members.map((m) => {
                    const isProjectCreator = m.userId === project.createdBy;
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
                      >
                        <UserAvatar
                          name={m.user.fullName}
                          avatarUrl={m.user.avatarUrl}
                          size={28}
                          color={m.user.avatarColor}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-gray-800 dark:text-gray-200">
                            {m.user.fullName}
                          </p>
                          <p className="truncate text-xs text-gray-400">
                            {m.user.email}
                          </p>
                        </div>
                        {isProjectCreator ? (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            Creator
                          </span>
                        ) : (
                          isCreator && (
                            <button
                              type="button"
                              aria-label={`Remove ${m.user.fullName}`}
                              onClick={() => setRemoving(m)}
                              className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                            >
                              <LuTrash2 className="h-4 w-4" />
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Invite picker (creator only) ─────────────────────── */}
                {isCreator && (
                  <>
                    <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Add people
                    </p>
                    <div className="relative mt-2">
                      <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search people…"
                        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      />
                    </div>
                    <div className="mt-2 max-h-52 space-y-0.5 overflow-y-auto">
                      {candidatesQuery.isLoading && (
                        <p className="py-4 text-center text-sm text-gray-400">
                          Loading…
                        </p>
                      )}
                      {!candidatesQuery.isLoading && invitable.length === 0 && (
                        <p className="py-4 text-center text-sm text-gray-400">
                          {search.trim()
                            ? "No one matches that search."
                            : "Everyone in the workspace already has access."}
                        </p>
                      )}
                      {invitable.map((c) => {
                        const isSelected = selected.has(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggle(c.id)}
                            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${
                              isSelected
                                ? "bg-brand-50 dark:bg-brand-900/20"
                                : "hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                          >
                            <UserAvatar
                              name={c.fullName}
                              avatarUrl={c.avatarUrl}
                              size={28}
                              color={c.avatarColor}
                            />
                            <div className="min-w-0 flex-1 text-left">
                              <p className="truncate text-gray-800 dark:text-gray-200">
                                {c.fullName}
                              </p>
                              <p className="truncate text-xs text-gray-400">
                                {c.email}
                              </p>
                            </div>
                            {isSelected && (
                              <span className="shrink-0 text-xs font-medium text-brand-500">
                                Selected
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {overLimit && (
                      <p role="alert" className="mt-2 text-xs text-red-500">
                        Select at most {MAX_BATCH_INVITE} people at a time.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 p-4 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Close
            </button>
            {isPrivate && isCreator && (
              <button
                type="button"
                onClick={handleInvite}
                disabled={selected.size === 0 || overLimit || inviting}
                className="rounded-lg bg-[linear-gradient(90deg,#6547f7_0%,#5431ed_100%)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {inviting
                  ? "Adding…"
                  : selected.size > 0
                    ? `Add ${selected.size}`
                    : "Add"}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmActionModal
        isOpen={confirmPublic}
        title="Make this project public?"
        description="Everyone in the workspace will be able to see this space and its tasks."
        confirmLabel="Make public"
        isLoading={savingVisibility}
        onClose={() => setConfirmPublic(false)}
        onConfirm={async () => {
          setConfirmPublic(false);
          await applyVisibility("PUBLIC");
        }}
      />

      <ConfirmActionModal
        isOpen={removing !== null}
        title="Remove member?"
        description={
          removing
            ? `${removing.user.fullName} will lose access to this project and be unassigned from all of its tasks.`
            : ""
        }
        confirmLabel="Remove"
        isLoading={isRemoving}
        onClose={() => setRemoving(null)}
        onConfirm={handleRemove}
      />
    </>
  );
}
