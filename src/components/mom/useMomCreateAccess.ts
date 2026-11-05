"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceManageAccess } from "@/hooks/useWorkspaceManageAccess";
import { useMyDepartment } from "@/hooks/useMyDepartment";
import { meetingsListHref } from "./momRoutes";

/**
 * Whether the caller can create a Minutes of Meeting — narrower than
 * `useMomAccessGuard`, which only gates *viewing*.
 *
 * Server-side, `MeetingService.create` allows OWNER/MANAGER (unchanged) or
 * that department's own supervisor (`isDepartmentSupervisor`) — a regular
 * assigned member can view everything in their department but can no longer
 * create (`MOM_CREATE_FORBIDDEN`). This mirrors that same condition.
 */
export function useMomCreateAccess(): {
  canCreate: boolean;
  isLoading: boolean;
} {
  const { canManageWorkspace, isLoading: roleLoading } = useWorkspaceManageAccess();
  const { isDepartmentSupervisor, isLoading: deptLoading } = useMyDepartment();

  return {
    canCreate: canManageWorkspace || isDepartmentSupervisor,
    isLoading: roleLoading || deptLoading,
  };
}

/**
 * Keeps anyone without create access off the Create MOM screen — a regular
 * assigned member (view-only) navigating straight to /meetings/create would
 * otherwise see the form only to have `POST /meetings` 403 on save.
 *
 * Returns `true` while the page should not render, same contract as
 * `useMomAccessGuard`.
 */
export function useMomCreateAccessGuard(): boolean {
  const router = useRouter();
  const { canCreate, isLoading } = useMomCreateAccess();
  const { departmentId } = useMyDepartment();

  useEffect(() => {
    if (!isLoading && !canCreate) router.replace(meetingsListHref(departmentId));
  }, [isLoading, canCreate, departmentId, router]);

  return isLoading || !canCreate;
}
