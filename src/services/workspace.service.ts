import { api } from "@/lib/api";
import { AuthUser } from "@/stores/auth.store";
import { Workspace } from "@/stores/workspace.store";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export type WorkspaceUse = "WORK" | "PERSONAL" | "SCHOOL";
export type WorkspaceManagementType =
  | "HR_RECRUITING" | "CREATIVE_DESIGN" | "PROFESSIONAL_SERVICES"
  | "FINANCE_ACCOUNTING" | "OPERATIONS" | "SOFTWARE_DEVELOPMENT"
  | "IT" | "SALES_CRM" | "PERSONAL_USE" | "SUPPORT"
  | "STARTUP" | "PMO" | "MARKETING" | "OTHER";
/**
 * The only roles an invite / add-member / change-role call may carry. OWNER is
 * absent deliberately: it is written in exactly one place server-side
 * (`WorkspaceService.create()`), and every DTO plus a service-level check in
 * `changeMemberRole()` rejects it. See `docs/workspace-roles.md`.
 */
export type WorkspaceInviteRole = "MANAGER" | "MEMBER";

/**
 * Every role a member row can *report*. Wider than `WorkspaceInviteRole`
 * because OWNER still exists on the creator's row (and on legacy workspaces
 * that predate the single-owner rule) — it just can't be granted any more.
 * ADMIN is an unrelated tier used by chat/channels/projects moderation; it
 * carries no workspace-management rights and is never offered here.
 */
export type WorkspaceMemberRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER";
export type WorkspaceInviteNextStep = "claim_account" | "login";

export interface WorkspaceInvitePreview {
  workspaceId: string;
  workspaceName: string;
  invitedEmail: string;
  role: WorkspaceInviteRole;
  inviterName: string;
  nextStep: WorkspaceInviteNextStep;
}

export interface WorkspaceInviteClaimResult {
  user: AuthUser;
  accessToken: string;
  workspaceId: string;
}

export type AiModelTier = "PREMIUM" | "STANDARD";

export interface TokenQuotaStatus {
  /** False for standard-tier members and premium members with no allowance set. */
  metered: boolean;
  tokenLimit: number;
  consumedTokens: number;
  remainingTokens: number;
  percentUsed: number;
  estimatedTokens: number;
  costUsdUsed: number;
  periodStart: string;
  resetsAt: string;
  exhausted: boolean;
  fallbackOptIn: boolean;
  band: "ok" | "warn" | "critical";
}

/**
 * Accounting access, granted per workspace membership — NOT a global user
 * attribute. The same person can be ACCOUNTANT in one workspace and have no
 * accounting access in another. `null` means no access at all.
 */
export type AccountingRole = "CEO" | "ACCOUNTANT";

export interface WorkspaceMember {
  id: string;
  fullName: string;
  email: string;
  /** A URL or an `initials:AB` token; null for a pending invite, which has no
   *  user account behind it yet. */
  avatarUrl: string | null;
  avatarColor: string;
  role: WorkspaceMemberRole;
  /** AI model entitlement in this workspace. Separate from role. */
  aiModelTier: AiModelTier;
  /** Independent of `role` — an OWNER isn't automatically CEO, and a plain
   *  MEMBER can be ACCOUNTANT. Pending invites always report null. */
  accountingRole: AccountingRole | null;
  /** Grants IT Management module access, independent of `role` — an OWNER
   *  always has it regardless of this flag (`ItManagerGuard`), and a plain
   *  MEMBER can be flagged true. Pending invites always report false (no
   *  membership row exists yet to carry the flag). */
  isItManager: boolean;
  /**
   * Only populated for rows backed by a pending/rejected invite — an accepted
   * member has no invite record left to report, so this is `null` for everyone
   * who has actually joined. Backend types it `InviteStatus | null`.
   */
  inviteStatus: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED" | null;
  lastActive: string | null;
  invitedBy: string | null;
  invitedOn: string | null;
}

/** `GET /workspaces/:id` — includes the caller's own membership context. */
export interface WorkspaceDetail extends Workspace {
  memberCount: number;
  /** The caller's workspace role in this workspace. */
  role: WorkspaceMemberRole;
  /** The caller's accounting role in this workspace. */
  accountingRole: AccountingRole | null;
  /** The caller's Department in this workspace, independent of `role` —
   *  null means no department, which (for a plain MEMBER) means no MoM
   *  access at all. See useMyDepartment. */
  departmentId: string | null;
  departmentName: string | null;
  /** True iff the caller supervises `departmentId` — grants creating Minutes
   *  of Meeting in it (a regular assigned member can only view) and managing
   *  its member roster. See useMyDepartment. */
  isDepartmentSupervisor: boolean;
  /**
   * The caller's own IT Manager flag — grants access to the IT Management
   * module, independent of `role`/`accountingRole`. The module is otherwise
   * OWNER-only (`ItManagerGuard`). Also exposed per-member on
   * `GET /workspaces/:id/members` (see `WorkspaceMember.isItManager`).
   */
  isItManager: boolean;
}

export const workspaceService = {
  getMembers: (workspaceId: string) =>
    api
      .get<ApiWrapper<WorkspaceMember[]>>(`/workspaces/${workspaceId}/members`, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data.data),

  removeMember: (workspaceId: string, memberId: string) =>
    api
      .delete(`/organizations/members`, {
        headers: { "x-workspace-id": workspaceId },
        data: { workspaceId, memberId },
      })
      .then((r) => r.data),

  changeMemberRole: (workspaceId: string, memberId: string, role: WorkspaceInviteRole) =>
    api
      .put(`/organizations/members/${memberId}/role`, { workspaceId, role }, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data),

  /**
   * The caller's own membership context for a workspace — this is how the app
   * learns its `accountingRole`, which is no longer on the user/auth response.
   */
  getWorkspace: (workspaceId: string) =>
    api
      .get<ApiWrapper<WorkspaceDetail>>(`/workspaces/${workspaceId}`, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data.data),

  /**
   * Grant or revoke accounting access. Platform-admin-only server-side (a
   * company-wide flag, not workspace-scoped) — `null` revokes. No
   * `x-workspace-id` header: the guard behind this endpoint doesn't check
   * workspace membership at all, unlike `changeMemberRole` above.
   */
  changeMemberAccountingRole: (
    workspaceId: string,
    memberId: string,
    accountingRole: AccountingRole | null
  ) =>
    api
      .put(`/organizations/members/${memberId}/accounting-role`, {
        workspaceId,
        accountingRole,
      })
      .then((r) => r.data),

  /**
   * Grant or revoke IT Management module access. OWNER-only, but — unlike
   * `changeMemberAccountingRole` above — workspace-scoped (`@Roles('OWNER')`
   * via `RolesGuard`, not platform-admin-gated), since delegating the IT
   * module is a workspace-internal concern. Same shape as `changeMemberRole`:
   * carries `x-workspace-id`.
   */
  changeMemberItManagerRole: (
    workspaceId: string,
    memberId: string,
    isItManager: boolean
  ) =>
    api
      .put(`/organizations/members/${memberId}/it-manager`, {
        workspaceId,
        isItManager,
      }, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data),

  // Requires the office-admin secret key in addition to OWNER role — the role
  // gates who sees the action, the secret gates who can complete it.
  changeMemberTier: (
    workspaceId: string,
    memberId: string,
    tier: AiModelTier,
    secret: string,
  ) =>
    api
      .patch(`/workspaces/${workspaceId}/members/${memberId}/ai-tier`, { tier, secret }, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data),

  getTokenAllowance: (workspaceId: string, memberId: string) =>
    api
      .get<ApiWrapper<TokenQuotaStatus>>(
        `/workspaces/${workspaceId}/members/${memberId}/token-allowance`,
        { headers: { "x-workspace-id": workspaceId } },
      )
      .then((r) => r.data.data),

  setTokenAllowance: (
    workspaceId: string,
    memberId: string,
    tokenLimit: number,
    secret: string,
  ) =>
    api
      .patch<ApiWrapper<TokenQuotaStatus>>(
        `/workspaces/${workspaceId}/members/${memberId}/token-allowance`,
        { tokenLimit, secret },
        { headers: { "x-workspace-id": workspaceId } },
      )
      .then((r) => r.data.data),

  resetTokenAllowance: (workspaceId: string, memberId: string, secret: string) =>
    api
      .post<ApiWrapper<TokenQuotaStatus>>(
        `/workspaces/${workspaceId}/members/${memberId}/token-allowance/reset`,
        { secret },
        { headers: { "x-workspace-id": workspaceId } },
      )
      .then((r) => r.data.data),

  /**
   * Cost bounds for an allowance. A single figure is impossible: the same tokens
   * cost the input rate on prompts and the output rate on replies.
   */
  getTokenCostQuote: (tokens: number) =>
    api
      .get<ApiWrapper<{ tokens: number; model: string; minCostUsd: number; maxCostUsd: number }>>(
        `/ai-tier/token-cost-quote`,
        { params: { tokens } },
      )
      .then((r) => r.data.data),

  list: () =>
    api.get<ApiWrapper<Workspace[]>>("/workspaces").then((r) => r.data.data),

  get: (id: string) =>
    api
      .get<ApiWrapper<Workspace>>(`/workspaces/${id}`, {
        headers: { "x-workspace-id": id },
      })
      .then((r) => r.data.data),

  create: (payload: { name: string; workspaceUse: WorkspaceUse; managementType: WorkspaceManagementType; logoUrl?: string }) =>
    api
      .post<ApiWrapper<Workspace>>("/workspaces", payload)
      .then((r) => r.data.data),

  update: (id: string, payload: { name?: string; logoUrl?: string | null }) =>
    api
      .patch<ApiWrapper<Workspace>>(`/workspaces/${id}`, payload, {
        headers: { "x-workspace-id": id },
      })
      .then((r) => r.data.data),

  delete: (id: string) =>
    api
      .delete(`/workspaces/${id}`, {
        headers: { "x-workspace-id": id },
      })
      .then((r) => r.data),

  // An invite carries a workspace role only — accounting access can no
  // longer be attached to one. It's granted separately, after acceptance,
  // via `changeMemberAccountingRole`, which only a platform admin can call.
  // No `isItManager` field either, unlike the single `invite` below —
  // deliberately absent here, same reasoning as accounting access.
  inviteBulk: (
    workspaceId: string,
    payload: {
      emails: string[];
      role?: WorkspaceInviteRole;
    }
  ) =>
    api
      .post(`/workspaces/${workspaceId}/invites`, payload, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data.data),

  /**
   * `isItManager` (default false) is the only path where a MANAGER — not
   * just the OWNER — can put someone straight into the IT Manager slot: it
   * applies the moment the invite is accepted, no separate
   * `changeMemberItManagerRole` call needed after. Single-invite only —
   * deliberately absent from `inviteBulk` below (granting IT Manager access
   * to up to 50 people in one request was judged too risky).
   */
  invite: (
    workspaceId: string,
    payload: {
      email: string;
      role?: WorkspaceInviteRole;
      isItManager?: boolean;
    }
  ) =>
    api
      .post<ApiWrapper<null>>(`/workspaces/${workspaceId}/invite`, payload, {
        headers: { "x-workspace-id": workspaceId },
      })
      .then((r) => r.data.message),

  previewInvite: (token: string) =>
    api
      .get<ApiWrapper<WorkspaceInvitePreview>>(`/workspaces/invite/${token}`)
      .then((r) => r.data.data),

  claimInvite: (payload: { token: string; fullName: string; password: string }) =>
    api
      .post<ApiWrapper<WorkspaceInviteClaimResult>>("/workspaces/invite/claim", payload)
      .then((r) => r.data.data),

  acceptInvite: (token: string) =>
    api
      .post<ApiWrapper<{ workspaceId: string }>>("/workspaces/invite/accept", { token })
      .then((r) => r.data.data),
};
