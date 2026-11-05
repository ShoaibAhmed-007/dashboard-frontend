"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/queries/keys";
import { useAuthStore } from "@/stores/auth.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { workspaceService } from "@/services/workspace.service";

/**
 * The caller's own Department in the active workspace, independent of
 * `role`/`accountingRole` — gates department-scoped Minutes of Meeting
 * access (see useMomAccessGuard).
 *
 * Deliberately shares `queryKeys.accountingRole(workspaceId)` with
 * `useAccountingRole()` — both read `GET /workspaces/:id`, so using the same
 * key means this never issues a second network request beyond whatever
 * `useAccountingRole`/`useWorkspaceManageAccess` already triggered.
 */
export function useMyDepartment() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const isReady = !!accessToken && !!workspaceId;

  const query = useQuery({
    queryKey: queryKeys.accountingRole(workspaceId),
    queryFn: () => workspaceService.getWorkspace(workspaceId!),
    enabled: isReady,
    staleTime: 5 * 60_000,
  });

  return {
    departmentId: query.data?.departmentId ?? null,
    departmentName: query.data?.departmentName ?? null,
    isDepartmentSupervisor: query.data?.isDepartmentSupervisor ?? false,
    isLoading: query.isLoading || !isReady,
  };
}
