"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/keys";
import { workspaceService } from "@/services/workspace.service";
import { useWorkspaceStore } from "@/stores/workspace.store";

export function useWorkspaceMembers() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.workspaceMembers(workspaceId),
    queryFn: async () => {
      const all = await workspaceService.getMembers(workspaceId!);
      return all.filter((m) => m.inviteStatus !== "PENDING");
    },
    enabled: !!workspaceId,
    staleTime: 60_000,
  });

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaceMembers(workspaceId),
      }),
  };
}
