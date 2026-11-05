"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceManageAccess } from "@/hooks/useWorkspaceManageAccess";
import { useMyDepartment } from "@/hooks/useMyDepartment";

/**
 * Keeps everyone else out of the Departments screen — OWNER/MANAGER (full
 * CRUD) or a department's own supervisor (read-only browse of every
 * department, but can only open their own — see DepartmentsPage's own
 * per-card gating, and the backend's identical findAll/findOne checks).
 *
 * Deliberately its own file, not shared with MoM's `useMomAccessGuard` —
 * that guard also accepts a plain department member, who has no business
 * here at all.
 *
 * Returns `true` while the user should not be rendered the page, so callers
 * can return null instead of flashing content before the redirect lands.
 */
export function useDepartmentsAccessGuard(): boolean {
  const router = useRouter();
  const { canManageWorkspace, isLoading: roleLoading } = useWorkspaceManageAccess();
  const { isDepartmentSupervisor, isLoading: deptLoading } = useMyDepartment();

  const isLoading = roleLoading || deptLoading;
  const hasAccess = canManageWorkspace || isDepartmentSupervisor;

  useEffect(() => {
    if (!isLoading && !hasAccess) router.replace("/");
  }, [isLoading, hasAccess, router]);

  return isLoading || !hasAccess;
}
