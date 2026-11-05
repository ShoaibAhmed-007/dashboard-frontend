"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/queries/keys";
import { departmentService } from "@/services/department.service";
import { useWorkspaceStore } from "@/stores/workspace.store";

/** Every department in the workspace, for the Create MOM department picker
 *  (OWNER/MANAGER only — see CreateMomPage) and similar option lists.
 *  Mirrors useWorkspaceMembers's shape. */
export function useDepartments() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const query = useQuery({
    queryKey: queryKeys.departments(workspaceId, { limit: 100 }),
    queryFn: () => departmentService.list({ limit: 100 }),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });

  return {
    departments: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
