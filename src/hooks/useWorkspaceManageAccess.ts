"use client";

import { useAccountingRole } from "@/hooks/useAccounting";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { WorkspaceMemberRole } from "@/services/workspace.service";

export interface WorkspaceManageAccess {
  role: WorkspaceMemberRole | null;
  /** OWNER or MANAGER — full parity on every workspace-management action. */
  canManageWorkspace: boolean;
  /** The workspace creator. Their row can never be demoted or duplicated. */
  isOwner: boolean;
  isManager: boolean;
  isLoading: boolean;
}

/**
 * Single source of truth for workspace-management gating.
 *
 * MANAGER has **full parity with OWNER** on the backend for settings, delete,
 * invite, add/remove member and change-role — every one of those routes is
 * `@Roles('OWNER', 'MANAGER')`, backed by `assertActorIsOwnerOrManager()`. So
 * anything gated on "owner" previously must gate on both, or managers see a
 * read-only page while the API would happily accept their calls.
 *
 * The two things neither role can do — mint a second OWNER, and grant
 * accounting access — are gated separately (the latter on `isPlatformAdmin`).
 *
 * While the role query is still in flight we fall back to `createdBy`, so the
 * creator's own controls don't flicker in on first paint. That fallback can
 * only ever resolve *true* for the OWNER, so a MANAGER briefly sees disabled
 * controls before the query settles — acceptable, and strictly safer than
 * assuming rights we haven't confirmed.
 */
export function useWorkspaceManageAccess(): WorkspaceManageAccess {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { workspaceRole, isLoading } = useAccountingRole();

  const role = (workspaceRole as WorkspaceMemberRole | null) ?? null;
  const isOwner = isLoading
    ? activeWorkspace?.createdBy === user?.id
    : role === "OWNER";
  const isManager = !isLoading && role === "MANAGER";

  return {
    role,
    canManageWorkspace: isOwner || isManager,
    isOwner,
    isManager,
    isLoading,
  };
}
