"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LuSearch, LuTrash2, LuX } from "react-icons/lu";
import UserAvatar from "@/components/ui/UserAvatar";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { departmentService } from "@/services/department.service";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import type { Department, DepartmentMember } from "@/types/department";

/**
 * A department's member roster — current members plus a picker to add more.
 * Mirrors ProjectMembersModal's "current members + candidate picker" shape,
 * simplified since department assignment is a direct 0-or-1 field rather
 * than an invite flow: adding someone here moves them straight in (no
 * pending state), and moving them from one department to another is just
 * assigning them to this one — the backend clears the old assignment as
 * part of the same write.
 */
export default function DepartmentMembersModal({
  isOpen,
  onClose,
  department,
}: {
  isOpen: boolean;
  onClose: () => void;
  department: Department;
}) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DepartmentMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [movingSupervisor, setMovingSupervisor] = useState<{
    userId: string;
    name: string;
    fromDepartment: string;
  } | null>(null);

  const detailQuery = useQuery({
    queryKey: queryKeys.department(department.id),
    queryFn: () => departmentService.getById(department.id),
    enabled: isOpen,
    staleTime: 30_000,
  });

  /* Every workspace member, regardless of their current department — picking
     one here reassigns them, it doesn't require they be unassigned first. */
  const { members: allMembers, isLoading: membersLoading } = useWorkspaceMembers();

  /* Who already supervises another department, keyed by user id. Adding one of
     them here moves them out of that department and clears its supervisor, so
     we ask before doing it. Capped at the API's page max (100). */
  const departmentsQuery = useQuery({
    queryKey: queryKeys.departments(workspaceId, { scope: "supervisor-check" }),
    queryFn: () => departmentService.list({ limit: 100 }),
    enabled: isOpen && Boolean(workspaceId),
    staleTime: 30_000,
  });

  const supervisedElsewhere = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departmentsQuery.data?.items ?? []) {
      if (d.id !== department.id && d.supervisor) {
        map.set(d.supervisor.user.id, d.name);
      }
    }
    return map;
  }, [departmentsQuery.data, department.id]);

  const currentMembers = useMemo(
    () => detailQuery.data?.members ?? [],
    [detailQuery.data]
  );
  /* User ids, not `m.id`: a department member's `id` is its WorkspaceMember
     id, while the workspace list below is keyed by user id — comparing those
     never matched, so people already in the department stayed in "Add people". */
  const currentUserIds = useMemo(
    () => new Set(currentMembers.map((m) => m.user.id)),
    [currentMembers]
  );

  const candidates = useMemo(() => {
    const rows = allMembers.filter((m) => !currentUserIds.has(m.id));
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (m) =>
        m.fullName.toLowerCase().includes(needle) ||
        m.email.toLowerCase().includes(needle)
    );
  }, [allMembers, currentUserIds, search]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.department(department.id) });
    queryClient.invalidateQueries({ queryKey: ["departments"] });
    // The affected member's own "who am I" cache (role/department/supervisor
    // status) — read by useMyDepartment/useAccountingRole/the sidebar. Only
    // matters for this browser's own session, but assigning yourself (or
    // being assigned while your own tab is open) would otherwise show stale
    // access for up to its 5-minute staleTime.
    queryClient.invalidateQueries({ queryKey: queryKeys.accountingRole(workspaceId) });
  };

  const handleAdd = async (memberId: string, memberName: string) => {
    setPendingId(memberId);
    try {
      await departmentService.assignMember(memberId, department.id);
      invalidate();
      toast.success(`${memberName} added to ${department.name}.`);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't add that member.");
    } finally {
      setPendingId(null);
    }
  };

  const requestAdd = (memberId: string, memberName: string) => {
    const fromDepartment = supervisedElsewhere.get(memberId);
    if (fromDepartment) {
      setMovingSupervisor({ userId: memberId, name: memberName, fromDepartment });
      return;
    }
    void handleAdd(memberId, memberName);
  };

  const confirmMoveSupervisor = async () => {
    if (!movingSupervisor) return;
    const { userId, name } = movingSupervisor;
    setMovingSupervisor(null);
    await handleAdd(userId, name);
  };

  const handleRemove = async () => {
    if (!removing) return;
    setIsRemoving(true);
    try {
      await departmentService.assignMember(removing.id, null);
      invalidate();
      toast.success(`${removing.user.fullName} removed from ${department.name}.`);
      setRemoving(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't remove that member.");
    } finally {
      setIsRemoving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div className="flex max-h-[calc(100vh-4rem)] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
          <div className="flex shrink-0 items-start justify-between p-6 pb-4">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                Members
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-gray-400">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: department.color }}
                />
                {department.name}
              </p>
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
            {/* ── Current members ──────────────────────────────────── */}
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              In this department
            </p>
            <div className="mt-2 space-y-0.5">
              {detailQuery.isLoading ? (
                <p className="py-4 text-center text-sm text-gray-400">Loading…</p>
              ) : currentMembers.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">
                  No one assigned yet.
                </p>
              ) : (
                currentMembers.map((m) => (
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
                    </div>
                    {m.id === department.supervisorId && (
                      <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        Supervisor
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${m.user.fullName}`}
                      onClick={() => setRemoving(m)}
                      className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                    >
                      <LuTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* ── Add people ───────────────────────────────────────── */}
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
              {membersLoading ? (
                <p className="py-4 text-center text-sm text-gray-400">Loading…</p>
              ) : candidates.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">
                  {search.trim()
                    ? "No one matches that search."
                    : "Everyone is already in this department."}
                </p>
              ) : (
                candidates.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={pendingId === m.id}
                    onClick={() => requestAdd(m.id, m.fullName)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-800"
                  >
                    <UserAvatar
                      name={m.fullName}
                      avatarUrl={m.avatarUrl}
                      size={28}
                      color={m.avatarColor}
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-gray-800 dark:text-gray-200">
                        {m.fullName}
                      </p>
                      <p className="truncate text-xs text-gray-400">{m.email}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-brand-500">
                      {pendingId === m.id ? "Adding…" : "Add"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-100 p-4 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <ConfirmActionModal
        isOpen={movingSupervisor !== null}
        title="Move this supervisor?"
        description={
          movingSupervisor
            ? `${movingSupervisor.name} supervises ${movingSupervisor.fromDepartment}. Adding them to ${department.name} moves them out of ${movingSupervisor.fromDepartment}, which will be left with no supervisor.`
            : ""
        }
        confirmLabel="Move"
        onClose={() => setMovingSupervisor(null)}
        onConfirm={() => void confirmMoveSupervisor()}
      />

      <ConfirmActionModal
        isOpen={removing !== null}
        title="Remove from department?"
        description={
          removing
            ? `${removing.user.fullName} will lose Minutes of Meeting access for ${department.name}.`
            : ""
        }
        confirmLabel="Remove"
        isLoading={isRemoving}
        onClose={() => setRemoving(null)}
        onConfirm={() => void handleRemove()}
      />
    </>
  );
}
