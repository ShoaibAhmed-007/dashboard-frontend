"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/keys";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspaceManageAccess } from "@/hooks/useWorkspaceManageAccess";
import { parseApiError } from "@/lib/api";
import { PiExport } from "react-icons/pi";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { toast } from "sonner";
import {
  LuChevronDown,
  LuEllipsis,
  LuSearch,
  LuSparkles,
  LuCoins,
  LuRotateCcw,
  LuTrash2,
} from "react-icons/lu";
import ProfileSettingsForm from "@/components/settings/ProfileSettingsForm";
import ChangePasswordForm from "@/components/settings/ChangePasswordForm";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import {
  workspaceService,
  WorkspaceMember,
  type AccountingRole,
  type AiModelTier,
  type TokenQuotaStatus,
} from "@/services/workspace.service";
import InvitePeopleModal from "@/components/workspace/InvitePeopleModal";
import MemberTierSecretModal from "@/components/workspace/MemberTierSecretModal";
import TokenAllowanceModal from "@/components/workspace/TokenAllowanceModal";

const AVATAR_COLOR_STYLES = [
  { bg: "#18181b", text: "#ffffff" },
  { bg: "#7c3aed", text: "#ffffff" },
  { bg: "#eab308", text: "#000000" },
  { bg: "#0f172a", text: "#ffffff" },
  { bg: "#6d28d9", text: "#ffffff" },
  { bg: "#ca8a04", text: "#000000" },
  { bg: "#1e1b4b", text: "#ffffff" },
  { bg: "#fbbf24", text: "#000000" },
  { bg: "#3b0764", text: "#ffffff" },
  { bg: "#292524", text: "#ffffff" },
  { bg: "#854d0e", text: "#ffffff" },
  { bg: "#4c1d95", text: "#ffffff" },
];


function workspaceInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

/**
 * Display-only labels. The underlying values stay CEO/ACCOUNTANT (that's
 * what the API sends and accepts) — "CEO" and "Accountant" just aren't
 * meaningful labels to someone reading this table, so relabel to what they
 * actually mean: CEO is read-only, ACCOUNTANT is read + write.
 */
const ACCOUNTING_ROLE_LABELS: Record<AccountingRole, string> = {
  CEO: "Read Only",
  ACCOUNTANT: "Read & Write",
};

/**
 * Whether a membership-level grant (accounting role, IT Manager flag) can be
 * assigned to this row.
 *
 * Both `PUT /organizations/members/:id/accounting-role` and `.../it-manager`
 * write to a `WorkspaceMember` row, which only exists once an invite is
 * accepted. The API reports `inviteStatus` for *pending/rejected invites
 * only* — an accepted member's is `null`, so testing for `"ACCEPTED"` matches
 * nobody.
 */
function isMembershipRoleAssignable(member: { inviteStatus: string | null }): boolean {
  return member.inviteStatus === null || member.inviteStatus === "ACCEPTED";
}

/** Compact token count for tight table cells: 620000 -> "620k". */
function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function memberAvatarStyle(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLOR_STYLES[Math.abs(hash) % AVATAR_COLOR_STYLES.length];
}

export function WorkspaceSettingsContent({ tab }: { tab: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeWorkspace, updateWorkspace, deleteWorkspace } = useWorkspace();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<WorkspaceMember | null>(null);
  const [tierTarget, setTierTarget] = useState<WorkspaceMember | null>(null);
  const [quotas, setQuotas] = useState<Record<string, TokenQuotaStatus>>({});
  /** Set when an owner picks "Edit token limit" or "Reset tokens" from the menu. */
  const [allowanceTarget, setAllowanceTarget] = useState<{
    member: WorkspaceMember;
    mode: "edit" | "reset";
  } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentTab = tab;
  const isPeopleTab = currentTab === "people";

  useEffect(() => {
    setName(activeWorkspace?.name ?? "");
    setLogoUrl(activeWorkspace?.logoUrl ?? "");
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace || tab !== "people") return;
    setMembersLoading(true);
    workspaceService.getMembers(activeWorkspace.id)
      .then(setMembers)
      .catch((err) => toast.error(parseApiError(err).message))
      .finally(() => setMembersLoading(false));
  }, [activeWorkspace, tab]);

  /**
   * Management-gated UI keys off the workspace *role*, not `createdBy`, and
   * admits MANAGER alongside OWNER: every backend route behind these controls
   * is `@Roles('OWNER', 'MANAGER')`, so gating on OWNER alone would show a
   * manager a read-only page the API would have accepted writes from.
   *
   * The OWNER row needs no special handling here: the role badge names it, and
   * no control in this page can promote or demote it.
   *
   * `isRealOwner` is NOT the same gate. The AI-tier and token-allowance routes
   * (`TokenAllowanceController`, `AiTierController`) are `@Roles('OWNER')` —
   * OWNER alone, no MANAGER — so the Usage column and the AI-tier / token
   * controls must stay owner-only or a manager gets a column of 403s.
   */
  const { canManageWorkspace: isOwner, isOwner: isRealOwner } =
    useWorkspaceManageAccess();

  // Token usage for premium members only — standard members are unmetered, so
  // fetching a quota for them would be a wasted request per row. Usage is
  // owner-only information (the backend rejects non-owner reads too), so a
  // member viewer skips this fetch entirely rather than firing requests that
  // will only 403.
  useEffect(() => {
    if (!activeWorkspace || tab !== "people" || !isRealOwner) return;
    const premium = members.filter((m) => m.aiModelTier === "PREMIUM");
    if (premium.length === 0) return;

    let cancelled = false;
    Promise.all(
      premium.map((m) =>
        workspaceService
          .getTokenAllowance(activeWorkspace.id, m.id)
          .then((quota) => [m.id, quota] as const)
          // A failed quota read must not break the member list.
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      setQuotas(
        Object.fromEntries(results.filter((r): r is NonNullable<typeof r> => r !== null)),
      );
    });
    return () => {
      cancelled = true;
    };
    // `isRealOwner` now derives from an async role query, so it can flip from false
    // to true after this effect first runs — it has to be a dependency or the
    // quota fetch would be skipped permanently for a real owner.
  }, [activeWorkspace, tab, members, isRealOwner]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // menuPos is captured once from the trigger button's position at click time
  // and the table can now scroll horizontally (more columns than fit at once),
  // so a scroll would otherwise leave the dropdown floating away from its
  // button. Closing on scroll is simpler and safer than repositioning mid-scroll.
  useEffect(() => {
    if (!openMenuId) return;
    const handleScroll = () => {
      setOpenMenuId(null);
      setMenuPos(null);
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [openMenuId]);

  const initial = workspaceInitial(name || activeWorkspace?.name || "W");

  const isDirty = useMemo(() => {
    if (!activeWorkspace) return false;
    const nextName = name.trim();
    const nextLogo = logoUrl.trim();
    const currentLogo = activeWorkspace.logoUrl ?? "";
    return nextName !== activeWorkspace.name || nextLogo !== currentLogo;
  }, [activeWorkspace, name, logoUrl]);

  const handleSave = async () => {
    if (!activeWorkspace) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Workspace name is required");
      return;
    }

    const payload: { name?: string; logoUrl?: string | null } = {};
    const nextLogo = logoUrl.trim();
    const currentLogo = activeWorkspace.logoUrl ?? "";

    if (trimmedName !== activeWorkspace.name) {
      payload.name = trimmedName;
    }
    if (nextLogo !== currentLogo) {
      payload.logoUrl = nextLogo ? nextLogo : null;
    }

    if (!Object.keys(payload).length) {
      toast.message("No changes to save");
      return;
    }

    setSaving(true);
    try {
      await updateWorkspace(activeWorkspace.id, payload);
      toast.success("Workspace updated successfully");
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeWorkspace || deleting) return;
    if (!isOwner) {
      toast.error("Only workspace owner can delete this workspace");
      return;
    }

    setDeleting(true);
    try {
      await deleteWorkspace(activeWorkspace.id);
      toast.success("Workspace deleted successfully");
      setDeleteModalOpen(false);
      router.push("/");
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Accounting access is granted per workspace membership, independent of the
   * workspace role. `null` revokes it. Platform-admin only server-side
   * (`PlatformAdminGuard`) — deliberately NOT something an OWNER or MANAGER
   * can do, which is why the control is gated on `user.isPlatformAdmin`.
   */
  const handleChangeAccountingRole = async (
    member: WorkspaceMember,
    accountingRole: AccountingRole | null
  ) => {
    if (!activeWorkspace) return;
    const previous = member.accountingRole;
    // Optimistic: the dropdown should feel immediate, and we revert on failure.
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, accountingRole } : m))
    );
    try {
      await workspaceService.changeMemberAccountingRole(
        activeWorkspace.id,
        member.id,
        accountingRole
      );
      toast.success(
        accountingRole
          ? `${member.fullName} now has ${ACCOUNTING_ROLE_LABELS[accountingRole]} accounting access`
          : `Accounting access removed for ${member.fullName}`
      );
      // An OWNER can change their own role, and the accounting rail/menus read
      // from this — invalidate so the change lands without a reload.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workspaceMembers(activeWorkspace.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accountingRole(activeWorkspace.id),
      });
    } catch (err) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, accountingRole: previous } : m
        )
      );
      toast.error(parseApiError(err).message);
    }
  };

  /**
   * IT Management module access, granted per workspace membership,
   * independent of workspace role. Unlike `handleChangeAccountingRole`
   * above, this is OWNER-gated (`@Roles('OWNER')`), not platform-admin —
   * delegating the IT module is workspace-internal, so any OWNER may hand it
   * to someone else, the same way `changeMemberRole` already lets an OWNER
   * manage MANAGER/MEMBER. That's why the control below is gated on
   * `isRealOwner`, not `user.isPlatformAdmin`.
   */
  const handleChangeItManagerRole = async (
    member: WorkspaceMember,
    isItManager: boolean
  ) => {
    if (!activeWorkspace) return;
    const previous = member.isItManager;
    // Optimistic: the toggle should feel immediate, and we revert on failure.
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, isItManager } : m))
    );
    try {
      await workspaceService.changeMemberItManagerRole(
        activeWorkspace.id,
        member.id,
        isItManager
      );
      toast.success(
        isItManager
          ? `${member.fullName} can now access IT Management`
          : `IT Management access removed for ${member.fullName}`
      );
      // An OWNER can change their own flag, and the IT rail reads from this
      // — invalidate so the change lands without a reload.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workspaceMembers(activeWorkspace.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accountingRole(activeWorkspace.id),
      });
    } catch (err) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, isItManager: previous } : m
        )
      );
      toast.error(parseApiError(err).message);
    }
  };

  // The modal performs the secret-gated request itself; this only syncs the two
  // caches. useWorkspaceMembers serves the same data via react-query elsewhere,
  // so that key must be invalidated or other views show a stale tier.
  const handleTierChanged = (member: WorkspaceMember, tier: AiModelTier) => {
    setMembers(prev => prev.map(m => (m.id === member.id ? { ...m, aiModelTier: tier } : m)));
    if (activeWorkspace) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workspaceMembers(activeWorkspace.id),
      });
    }
    setTierTarget(null);
    toast.success(
      tier === "PREMIUM"
        ? `${member.fullName} upgraded to Dashboard Premium`
        : `${member.fullName} moved to Standard`,
    );
  };

  const handleRemoveMember = async () => {
    if (!activeWorkspace || !confirmRemove) return;
    setRemovingId(confirmRemove.id);
    try {
      await workspaceService.removeMember(activeWorkspace.id, confirmRemove.id);
      setMembers(prev => prev.filter(m => m.id !== confirmRemove.id));
      toast.success("Member removed");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setRemovingId(null);
      setConfirmRemove(null);
    }
  };

  if (!activeWorkspace) {
    return (
      <div className="h-full overflow-y-auto bg-white p-5 dark:bg-white/3 lg:px-6 lg:py-4">
        <div className="mx-auto max-w-[900px] rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-2xl font-normal text-gray-900 dark:text-white">
            Workspace Settings
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No active workspace is selected.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 rounded-lg bg-brand-500 px-4 py-2 text-sm font-normal text-white hover:bg-brand-600"
          >
            Go to home
          </button>
        </div>
      </div>
    );
  }



  if (isPeopleTab) {
    const filteredMembers = members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(peopleQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(peopleQuery.toLowerCase())
    );

    const formatDate = (iso: string | null) => {
      if (!iso) return "—";
      return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    };

    const formatLastActive = (iso: string | null) => {
      if (!iso) return "Never";
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    return (
      <div className="h-full overflow-y-auto bg-white p-5 dark:bg-gray-900 lg:px-10 lg:py-4">
        <div className="mx-auto w-full max-w-full">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-medium text-gray-900 dark:text-gray-100">Manage people</h1>
            <button
              type="button"
              className="flex gap-1 items-center justify-center rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-normal text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <PiExport className="w-4 h-4 "/>
              Export
            </button>
          </div> 

          <div className="mt-5">
            <div className="relative">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={peopleQuery}
                onChange={(e) => setPeopleQuery(e.target.value)}
                placeholder="Search by name or email"
                className="h-[48px] w-full rounded-lg border border-violet-300  bg-white pl-9 pr-36 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none dark:border-gray-905 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-000"
              />
              {/* Inviting is OWNER/MANAGER-only server-side, so a plain MEMBER
                  never sees the entry point. */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-violet-500 px-3 py-1 text-sm font-normal text-white hover:bg-violet-600 dark:bg-gray-000 dark:text-black dark:hover:bg-gray-200"
                >
                  + Invite people
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-normal text-violet-700 dark:bg-gray-905 dark:text-gray-100">
              All Users ({members.length}) <LuChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-black dark:[&::-webkit-scrollbar-thumb]:border-gray-700">
              <table className="w-full min-w-[1320px] table-fixed">
                {/* One <col> per <th>, in the same order: Name, Email, Role,
                    Accounting, IT Manager, Subscription, [Usage — owner only],
                    Last Active, Invited By, Invited On, and the trailing
                    actions cell. A count mismatch here silently shifts every
                    column's width onto its neighbour under `table-fixed`. */}
                <colgroup>
                  <col className="w-[15%]" />
                  <col className="w-[16%]" />
                  <col className="w-[7%]" />
                  <col className="w-[9%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  {isRealOwner && <col className="w-[13%]" />}
                  <col className="w-[9%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-normal text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Accounting</th>
                    <th className="px-4 py-3 text-left">IT Manager</th>
                    <th className="px-4 py-3 text-left">Subscription</th>
                    {isRealOwner && <th className="px-4 py-3 text-left">Usage</th>}
                    <th className="px-4 py-3 text-left">Last Active</th>
                    <th className="px-4 py-3 text-left">Invited By</th>
                    <th className="px-4 py-3 text-left">Invited On</th>
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {membersLoading ? (
                    <tr>
                      <td colSpan={isRealOwner ? 10 : 9} className="px-4 py-10 text-center text-sm text-gray-400">
                        Loading members...
                      </td>
                    </tr>
                  ) : filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={isRealOwner ? 10 : 9} className="px-4 py-10 text-center text-sm text-gray-400">
                        No members found.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => {
                      const isMe = member.id === user?.id;
                      /* MANAGER is a distinct role, not a member — folding it
                         into "Member" would hide that they hold full
                         workspace-management rights. */
                      const roleLabel =
                        member.role === "OWNER" ? "Owner"
                        : member.role === "MANAGER" ? "Manager"
                        : member.role === "ADMIN" ? "Admin"
                        : "Member";
                      const isPrivilegedRole =
                        member.role === "OWNER" || member.role === "MANAGER";
                      return (
                        <tr key={member.id} className="border-b border-gray-100 align-middle last:border-0 dark:border-gray-800/70">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar
                                name={member.fullName}
                                avatarUrl={member.avatarUrl}
                                size={32}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-normal text-gray-900 dark:text-gray-100">
                                  {member.fullName}
                                  {isMe && (
                                    <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-normal bg-violet-100 text-violet-700 dark:bg-gray-905 dark:text-gray-100">
                                      You
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <p className="truncate text-sm text-gray-700 dark:text-gray-300">{member.email}</p>
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-normal ${
                              isPrivilegedRole
                                ? "bg-violet-100 text-violet-700 dark:bg-gray-905 dark:text-gray-100"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }`}>
                              {roleLabel}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            {/* A real membership row is what the API needs to set
                                an accounting role, and only *pending* invites
                                carry an inviteStatus — an accepted member's is
                                null. So the test is "not pending", not
                                "=== ACCEPTED", which never matches.

                                Gated on isPlatformAdmin, not isOwner/isOwner-of-
                                this-workspace: granting accounting access is a
                                company-level decision, not a workspace one, and
                                the backend guard (PlatformAdminGuard) no longer
                                checks workspace OWNER at all for this action. */}
                            {user?.isPlatformAdmin && isMembershipRoleAssignable(member) ? (
                              <select
                                aria-label={`Accounting access for ${member.fullName}`}
                                value={member.accountingRole ?? ""}
                                onChange={(event) =>
                                  handleChangeAccountingRole(
                                    member,
                                    (event.target.value || null) as AccountingRole | null
                                  )
                                }
                                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                <option value="">No access</option>
                                <option value="ACCOUNTANT">{ACCOUNTING_ROLE_LABELS.ACCOUNTANT}</option>
                                <option value="CEO">{ACCOUNTING_ROLE_LABELS.CEO}</option>
                              </select>
                            ) : (
                              <span
                                title={
                                  isMembershipRoleAssignable(member)
                                    ? undefined
                                    : "Available once the invite is accepted"
                                }
                                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-normal ${
                                  member.accountingRole
                                    ? "bg-brand-100 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                }`}
                              >
                                {member.accountingRole
                                  ? ACCOUNTING_ROLE_LABELS[member.accountingRole]
                                  : "—"}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {/* IT Management module access — OWNER-gated
                                (`@Roles('OWNER')`), not platform-admin like
                                Accounting above, since it's a workspace-
                                internal delegation. An OWNER row can carry
                                either value: OWNER always has module access
                                regardless (`ItManagerGuard`), but the flag
                                still controls whether they're notified of
                                routine IT activity (see the integration
                                doc's Notifications section).

                                A still-pending row can also read `true` here
                                — an OWNER/MANAGER can grant it right at
                                invite time (doc §1.2), applied the moment
                                the invite is accepted. That's not a real
                                grant yet (there's no membership row to flip
                                it on), so it's labelled "(pending)" rather
                                than shown identically to an already-active
                                IT Manager, and stays read-only like
                                Accounting's own pending-row badge above —
                                `changeMemberItManagerRole` has no
                                membership row to write to either. */}
                            {isRealOwner && isMembershipRoleAssignable(member) ? (
                              <select
                                aria-label={`IT Manager access for ${member.fullName}`}
                                value={member.isItManager ? "true" : "false"}
                                onChange={(event) =>
                                  handleChangeItManagerRole(member, event.target.value === "true")
                                }
                                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                <option value="false">No access</option>
                                <option value="true">IT Manager</option>
                              </select>
                            ) : (
                              <span
                                title={
                                  isMembershipRoleAssignable(member)
                                    ? undefined
                                    : member.isItManager
                                      ? "Will become an IT Manager once they accept the invite"
                                      : "Available once the invite is accepted"
                                }
                                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-normal ${
                                  member.isItManager
                                    ? "bg-brand-100 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                }`}
                              >
                                {member.isItManager
                                  ? isMembershipRoleAssignable(member)
                                    ? "IT Manager"
                                    : "IT Manager (pending)"
                                  : "—"}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {member.aiModelTier === "PREMIUM" ? (
                              <span
                                title="Uses the premium AI model"
                                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-normal bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
                              >
                                <LuSparkles className="h-3 w-3" />
                                Premium
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                                Standard
                              </span>
                            )}
                          </td>

                          {isRealOwner && (
                            <td className="px-4 py-3">
                              {(() => {
                                if (member.aiModelTier !== "PREMIUM") {
                                  return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
                                }
                                const quota = quotas[member.id];

                                // Always show something for a premium member — a
                                // freshly-upgraded member with no limit assigned
                                // yet must not silently show nothing.
                                if (!quota?.metered) {
                                  return (
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                      No token limit set
                                    </p>
                                  );
                                }

                                // Same three zones as the chat composer: green
                                // below 50%, yellow from 50%, red from 85%.
                                const barColor =
                                  quota.band === "critical"
                                    ? "bg-red-500"
                                    : quota.band === "warn"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500";
                                return (
                                  <div className="w-full max-w-[130px]">
                                    <div className="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                      <div
                                        className={`h-full rounded-full ${barColor}`}
                                        style={{ width: `${Math.min(100, quota.percentUsed)}%` }}
                                      />
                                    </div>
                                    <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                                      {formatTokenCount(quota.consumedTokens)}/
                                      {formatTokenCount(quota.tokenLimit)} ·{" "}
                                      {formatTokenCount(quota.remainingTokens)} left
                                    </p>
                                  </div>
                                );
                              })()}
                            </td>
                          )}

                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {formatLastActive(member.lastActive)}
                          </td>

                          <td className="px-4 py-3">
                            <p className="truncate text-sm text-gray-700 dark:text-gray-300">
                              {member.invitedBy ?? "—"}
                            </p>
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(member.invitedOn)}
                          </td>

                          <td className="px-2 py-3">
                            {!isMe && isOwner && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                  if (openMenuId === member.id) {
                                    setOpenMenuId(null);
                                    setMenuPos(null);
                                  } else {
                                    setOpenMenuId(member.id);
                                    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                  }
                                }}
                                className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                              >
                                <LuEllipsis className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Fixed dropdown — renders outside table so it never affects layout */}
        {isOwner && openMenuId && menuPos && (() => {
          const member = filteredMembers.find(m => m.id === openMenuId);
          if (!member) return null;
          /* No "Change to Owner/Member" entry: OWNER is set once at workspace
             creation and no API path can grant or revoke it, so a role toggle
             here could only ever produce a call the backend rejects. The rest
             of the menu is unaffected.

             The AI-tier and token-allowance entries are owner-only, not
             manager-visible: `AiTierController` and `TokenAllowanceController`
             are both `@Roles('OWNER')`, so a manager clicking them would only
             ever collect a 403. Remove stays available to both. */
          return (
            <div
              ref={menuRef}
              className="fixed z-9999 w-62 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              {isRealOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(null);
                      setMenuPos(null);
                      setTierTarget(member);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 rounded-t-xl"
                  >
                    <LuSparkles className="h-4 w-4 text-gray-400" />
                    {member.aiModelTier === "PREMIUM"
                      ? "Downgrade to Standard"
                      : "Upgrade to Dashboard Premium"}
                  </button>
                  {member.aiModelTier === "PREMIUM" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          setMenuPos(null);
                          setAllowanceTarget({ member, mode: "edit" });
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <LuCoins className="h-4 w-4 text-gray-400" />
                        Edit token limit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          setMenuPos(null);
                          setAllowanceTarget({ member, mode: "reset" });
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <LuRotateCcw className="h-4 w-4 text-gray-400" />
                        Reset tokens now
                      </button>
                    </>
                  )}
                  <div className="mx-3 border-t border-gray-100 dark:border-gray-800" />
                </>
              )}
              <button
                type="button"
                onClick={() => { setOpenMenuId(null); setMenuPos(null); setConfirmRemove(member); }}
                /* For a manager this is the only item, so it needs both corners. */
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-b-xl ${
                  isRealOwner ? "" : "rounded-t-xl"
                }`}
              >
                <LuTrash2 className="h-4 w-4" />
                Remove from workspace
              </button>
            </div>
          );
        })()}

        <InvitePeopleModal
          isOpen={inviteOpen}
          onClose={() => setInviteOpen(false)}
        />

        {activeWorkspace && (
          <MemberTierSecretModal
            isOpen={!!tierTarget}
            member={tierTarget}
            targetTier={tierTarget?.aiModelTier === "PREMIUM" ? "STANDARD" : "PREMIUM"}
            workspaceId={activeWorkspace.id}
            onClose={() => setTierTarget(null)}
            onConfirmed={(tier) => handleTierChanged(tierTarget!, tier)}
          />
        )}

        {activeWorkspace && allowanceTarget && (
          <TokenAllowanceModal
            isOpen={!!allowanceTarget}
            member={allowanceTarget.member}
            mode={allowanceTarget.mode}
            workspaceId={activeWorkspace.id}
            currentQuota={quotas[allowanceTarget.member.id]}
            onClose={() => setAllowanceTarget(null)}
            onSaved={(quota) => {
              setQuotas((prev) => ({ ...prev, [allowanceTarget.member.id]: quota }));
              toast.success(
                allowanceTarget.mode === "edit"
                  ? `Token limit updated for ${allowanceTarget.member.fullName}`
                  : `Tokens reset for ${allowanceTarget.member.fullName}`,
              );
            }}
          />
        )}

        <ConfirmActionModal
          isOpen={!!confirmRemove}
          title="Remove member"
          description={`Remove ${confirmRemove?.fullName} from this workspace? They will lose access to all projects and tasks.`}
          confirmLabel="Remove"
          onClose={() => { if (!removingId) setConfirmRemove(null); }}
          onConfirm={handleRemoveMember}
          isLoading={!!removingId}
        />
      </div>
    );
  }

  return (
    <div className=" h-full overflow-y-auto  bg-white p-5 dark:bg-[#111111] lg:pl-[100px] lg:py-8  mr-2  rounded-tr-xl rounded-br-xl [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
      <div className="mx-auto w-full max-w-[860px]">
        <section className="min-w-0">
          <div className="max-w-[760px] lg:px-6">
            <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100">
              Workspace Settings
            </h1>

            <div className="mt-8">
              <h3 className="text-[16px] font-medium text-gray-900 dark:text-gray-100">
                General
              </h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="grid grid-cols-[140px_1fr] items-center border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                  <p className="text-sm text-gray-900 font-semibold dark:text-gray-401">Avatar</p>
                  <div className="flex items-center justify-end">
                    {logoUrl.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl.trim()}
                        alt={activeWorkspace.name}
                        className="h-8 w-8 rounded-md object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-normal"
                        style={{ backgroundColor: memberAvatarStyle(activeWorkspace.id).bg, color: memberAvatarStyle(activeWorkspace.id).text }}
                      >
                        {initial}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-[140px_1fr] items-center px-4 py-3">
                  <p className="text-sm text-gray-900 font-semibold dark:text-gray-401">Name</p>
                  <div className="flex justify-end">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                      className="h-9 w-full max-w-[260px] rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none dark:border-gray-905 dark:focus:border-gray-000 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-normal dark:bg-gray-000 dark:text-black dark:hover:bg-gray-200 text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>

            <div className="mt-8 pb-8">
              <h3 className="text-[16px] font-medium text-gray-900 dark:text-gray-100">
                Danger zone
              </h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-gray-900 font-semibold dark:text-gray-401">
                    Delete this Workspace forever
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isOwner) {
                        toast.error("Only workspace owner can delete this workspace");
                        return;
                      }
                      setDeleteModalOpen(true);
                    }}
                    disabled={!isOwner || deleting}
                    className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    {deleting ? "Deleting..." : "Delete Workspace"}
                  </button>
                </div>
              </div>
              {!isOwner && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Only workspace owner can delete this workspace.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
      {deleteModalOpen && (
        <ConfirmActionModal
          isOpen={deleteModalOpen}
          title="Delete Workspace"
          description={`Delete workspace "${activeWorkspace.name}" forever? This action cannot be undone.`}
          confirmLabel="Delete Workspace"
          onClose={() => {
            if (!deleting) setDeleteModalOpen(false);
          }}
          onConfirm={handleDelete}
          isLoading={deleting}
          requireText={activeWorkspace.name}
          requireTextLabel={`Type "${activeWorkspace.name}" to confirm workspace deletion`}
        />
      )}
    </div>
  );
}

export default WorkspaceSettingsContent;
