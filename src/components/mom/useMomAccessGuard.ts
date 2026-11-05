"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceManageAccess } from "@/hooks/useWorkspaceManageAccess";
import { useMyDepartment } from "@/hooks/useMyDepartment";

/**
 * Keeps everyone without MoM access out of the MOM screens.
 *
 * Server-side, `MomAccessGuard` passes for OWNER/MANAGER (workspace-wide,
 * unchanged from before departments existed) OR for any member assigned to
 * a department (scoped to that department) — everyone else gets 403 even on
 * reads. This mirrors that same OR here. The rail hides the entry point for
 * anyone this rejects; this covers the direct-URL case.
 *
 * Returns `true` while the user should not be rendered the page, so callers
 * can return null instead of flashing content before the redirect lands.
 */
export function useMomAccessGuard(): boolean {
  const router = useRouter();
  const { canManageWorkspace, isLoading: roleLoading } = useWorkspaceManageAccess();
  const { departmentId, isLoading: deptLoading } = useMyDepartment();

  const isLoading = roleLoading || deptLoading;
  const hasAccess = canManageWorkspace || departmentId !== null;

  useEffect(() => {
    // Waiting on the role/department query is not the same as being denied.
    if (!isLoading && !hasAccess) router.replace("/");
  }, [isLoading, hasAccess, router]);

  return isLoading || !hasAccess;
}
