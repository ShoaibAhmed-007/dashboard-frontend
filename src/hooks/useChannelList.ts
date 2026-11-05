"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { channelService } from "@/services/channel.service";
import { queryKeys } from "@/queries/keys";

export function useChannelList() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.channels(workspaceId), [workspaceId]);

  const query = useQuery({
    queryKey,
    queryFn: () => channelService.getChannels(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });

  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  );

  return {
    channels: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}
