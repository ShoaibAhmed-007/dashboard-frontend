"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LuLock, LuPencil, LuPlus, LuSearch, LuTrash2, LuUsers, LuX } from "react-icons/lu";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import Pagination from "@/components/common/Pagination";
import UserAvatar from "@/components/ui/UserAvatar";
import Switch from "@/components/form/switch/Switch";
import { useDepartmentsAccessGuard } from "./useDepartmentsAccessGuard";
import { departmentService } from "@/services/department.service";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspaceManageAccess } from "@/hooks/useWorkspaceManageAccess";
import { useMyDepartment } from "@/hooks/useMyDepartment";
import type {
  CreateDepartmentPayload,
  Department,
  UpdateDepartmentPayload,
} from "@/types/department";

const PAGE_SIZE = 20;
/** Mirrors the backend's `description` max in create/update-department.dto. */
const DESCRIPTION_MAX_LENGTH = 1000;

const COLOR_PRESETS = [
  "#6366f1", "#ef4444", "#f59e0b", "#10b981",
  "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6",
];

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-indigo-400";
const labelCls = "mb-1.5 block text-xs font-medium text-slate-500 dark:text-gray-400";

const STATUS_TABS: { key: "all" | "active" | "inactive"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

/** "02 Sept 2026" — matches MomCard's date form. */
function formatCreatedDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/\bSep\b/, "Sept");
}

type FormState = {
  name: string;
  color: string;
  description: string;
  /** WorkspaceMember id, or "" for none. */
  supervisorId: string;
  isActive: boolean;
};
const emptyForm = (): FormState => ({
  name: "",
  color: COLOR_PRESETS[0],
  description: "",
  supervisorId: "",
  isActive: true,
});

/**
 * Departments screen. Two very different experiences behind one guard (see
 * useDepartmentsAccessGuard):
 *  - OWNER/MANAGER: full CRUD — create, edit, delete, and open any card.
 *  - A department's own supervisor: read-only browse of every department
 *    (so they can find theirs), but no create/edit/delete affordance at all,
 *    and "View Department" only works on their own card — every other one
 *    renders locked. Enforced server-side too (DepartmentsService.findAll
 *    lets them list, findOne still 403s on another department).
 *
 * Each accessible card's "View Department" opens that department's own
 * meetings + member roster (DepartmentMeetingsRoute).
 */
export default function DepartmentsPage() {
  const blocked = useDepartmentsAccessGuard();
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const { members: workspaceMembers } = useWorkspaceMembers();
  const { canManageWorkspace } = useWorkspaceManageAccess();
  const { departmentId: myDepartmentId } = useMyDepartment();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState<Department | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const listParams = useMemo(
    () => ({
      q: search.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      page,
      limit: PAGE_SIZE,
    }),
    [search, statusFilter, page]
  );

  const listQuery = useQuery({
    queryKey: queryKeys.departments(workspaceId, listParams),
    queryFn: () => departmentService.list(listParams),
    enabled: Boolean(workspaceId) && !blocked,
    staleTime: 30_000,
  });

  const departments = listQuery.data?.items ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["departments", workspaceId] });
    // Creating/editing a department can set or clear its supervisor — same
    // "who am I" cache DepartmentMembersModal's invalidate() clears.
    queryClient.invalidateQueries({ queryKey: queryKeys.accountingRole(workspaceId) });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (department: Department) => {
    setEditing(department);
    setForm({
      name: department.name,
      color: department.color,
      description: department.description ?? "",
      supervisorId: department.supervisorId ?? "",
      isActive: department.isActive,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Please enter a department name");
    setIsSaving(true);
    try {
      if (editing) {
        const payload: UpdateDepartmentPayload = {
          name: form.name.trim(),
          color: form.color,
          description: form.description.trim() || undefined,
          // Explicit null clears the supervisor — this form always reflects
          // the full intended state on save, same as color/description above.
          supervisorId: form.supervisorId || null,
          isActive: form.isActive,
        };
        await departmentService.update(editing.id, payload);
        toast.success(`${form.name.trim()} updated.`);
      } else {
        const payload: CreateDepartmentPayload = {
          name: form.name.trim(),
          color: form.color,
          description: form.description.trim() || undefined,
          supervisorId: form.supervisorId || undefined,
        };
        await departmentService.create(payload);
        toast.success(`${form.name.trim()} created.`);
      }
      invalidate();
      closeForm();
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't save that department.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await departmentService.remove(deleting.id);
      invalidate();
      toast.success(`"${deleting.name}" deleted.`);
      setDeleting(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't delete that department.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (blocked) return null;

  return (
    <div className="h-screen overflow-y-auto bg-gray-100 px-4 py-6 dark:bg-gray-950 sm:px-6 lg:px-8">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Departments
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
            Assigning someone to a department gives them Minutes of Meeting access
            scoped to that department.
          </p>
        </div>
        {canManageWorkspace && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.98]"
          >
            <LuPlus className="h-4 w-4" />
            Create Department
          </button>
        )}
      </div>

      {/* status tabs + search */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex shrink-0 items-center gap-1">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setStatusFilter(tab.key)}
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

        <div className="relative min-w-0 max-w-sm flex-1">
          <LuSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search departments"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-white/20"
          />
        </div>
      </div>

      {/* grid */}
      {listQuery.isLoading ? (
        <div className="mt-10 flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent dark:border-white dark:border-t-transparent" />
        </div>
      ) : listQuery.isError ? (
        <div className="mt-10 rounded-2xl border border-gray-200 px-6 py-16 text-center dark:border-white/10">
          <p className="text-sm font-medium text-slate-700 dark:text-gray-200">
            Couldn&apos;t load departments
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">
            {parseApiError(listQuery.error).message}
          </p>
          <button
            onClick={() => listQuery.refetch()}
            className="mt-4 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            Try again
          </button>
        </div>
      ) : departments.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-white/[0.06]">
            <LuUsers className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-700 dark:text-gray-200">
            No departments yet
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">
            Create one to start assigning members and scoping MoM access.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {departments.map((department) => {
              const overflow = department._count.members - department.members.length;
              return (
                <article
                  key={department.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">
                      {department.name}
                    </h3>
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          department.isActive
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                        }`}
                      >
                        {department.isActive ? "Active" : "Inactive"}
                      </span>
                      {canManageWorkspace && (
                        <>
                          <button
                            type="button"
                            aria-label={`Edit ${department.name}`}
                            onClick={() => openEdit(department)}
                            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                          >
                            <LuPencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${department.name}`}
                            onClick={() => setDeleting(department)}
                            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                          >
                            <LuTrash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    {formatCreatedDate(department.createdAt)}
                  </p>

                  {department.description && (
                    <p className="mt-3 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                      {department.description}
                    </p>
                  )}

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Members
                  </p>
                  <div className="mt-2 flex items-center">
                    {department.members.length === 0 ? (
                      <p className="text-xs text-gray-400">No one assigned yet.</p>
                    ) : (
                      <div className="flex items-center -space-x-2">
                        {department.members.map((member) => (
                          <UserAvatar
                            key={member.id}
                            name={member.user.fullName}
                            avatarUrl={member.user.avatarUrl}
                            color={member.user.avatarColor}
                            size={28}
                            className="ring-2 ring-white dark:ring-gray-900"
                          />
                        ))}
                        {overflow > 0 && (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 ring-2 ring-white dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-900">
                            +{overflow}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {department.supervisor && (
                    <div className="mt-3 flex items-center gap-2">
                      <UserAvatar
                        name={department.supervisor.user.fullName}
                        avatarUrl={department.supervisor.user.avatarUrl}
                        color={department.supervisor.user.avatarColor}
                        size={32}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {department.supervisor.user.fullName}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">Supervisor</p>
                      </div>
                    </div>
                  )}

                  {canManageWorkspace || department.id === myDepartmentId ? (
                    <button
                      type="button"
                      onClick={() => router.push(`/departments/${department.id}`)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-300 py-2 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:border-brand-500/40 dark:text-brand-400 dark:hover:bg-brand-500/10"
                    >
                      <LuUsers className="h-3.5 w-3.5" />
                      View Department
                    </button>
                  ) : (
                    <span
                      className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-400 dark:border-gray-700 dark:text-gray-500"
                      title="Not your department"
                    >
                      <LuLock className="h-3.5 w-3.5" />
                      View Department
                    </span>
                  )}
                </article>
              );
            })}
          </div>
          <Pagination meta={listQuery.data?.meta} onPageChange={setPage} />
        </>
      )}

      {/* create/edit modal */}
      {formOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {editing ? "Edit department" : "New department"}
              </h2>
              <button
                onClick={closeForm}
                aria-label="Close"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Name</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Sales"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Choose color ${c}`}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`h-7 w-7 rounded-full transition ${
                        form.color === c
                          ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-gray-900"
                          : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional"
                  rows={2}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  className={inputCls}
                />
                <p className="mt-1 text-right text-xs text-gray-400">
                  {form.description.length}/{DESCRIPTION_MAX_LENGTH}
                </p>
              </div>

              <div>
                <label className={labelCls}>Department Supervisor</label>
                <select
                  value={form.supervisorId}
                  onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Select employee</option>
                  {workspaceMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">
                  Can manage this department&apos;s members and create Minutes of
                  Meeting in it. Auto-added as a member.
                </p>
              </div>

              {editing && (
                <div>
                  <label className={labelCls}>Status</label>
                  <Switch
                    key={editing.id}
                    label={form.isActive ? "Active" : "Inactive"}
                    defaultChecked={form.isActive}
                    onChange={(checked) => setForm({ ...form, isActive: checked })}
                  />
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">
                    Inactive pauses Minutes of Meeting access for every member of
                    this department.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeForm}
                disabled={isSaving}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200"
              >
                {isSaving ? "Saving…" : editing ? "Save changes" : "Create department"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={deleting !== null}
        title={deleting ? `Delete "${deleting.name}"?` : ""}
        description={
          deleting && deleting._count.members > 0
            ? `${deleting._count.members} ${
                deleting._count.members === 1 ? "member" : "members"
              } will lose Minutes of Meeting access for this department. This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete department"
        isLoading={isDeleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
