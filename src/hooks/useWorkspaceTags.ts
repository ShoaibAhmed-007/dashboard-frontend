"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tagService, WorkspaceTag } from "@/services/tag.service";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { queryKeys } from "@/queries/keys";

export function useWorkspaceTags() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.tags(workspaceId), [workspaceId]);

  const query = useQuery({
    queryKey,
    queryFn: () => tagService.list(),
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });

  const createTag = useCallback(
    async (payload: { name: string; color?: string }) => {
      const created = await tagService.create(payload);
      queryClient.setQueryData<WorkspaceTag[]>(queryKey, (prev) => [...(prev ?? []), created]);
      return created;
    },
    [queryClient, queryKey]
  );

  const updateTag = useCallback(
    async (tagId: string, payload: { name?: string; color?: string }) => {
      const updated = await tagService.update(tagId, payload);
      queryClient.setQueryData<WorkspaceTag[]>(queryKey, (prev) =>
        (prev ?? []).map((t) => (t.id === updated.id ? updated : t))
      );
      return updated;
    },
    [queryClient, queryKey]
  );

  const deleteTag = useCallback(
    async (tagId: string) => {
      await tagService.delete(tagId);
      queryClient.setQueryData<WorkspaceTag[]>(queryKey, (prev) =>
        (prev ?? []).filter((t) => t.id !== tagId)
      );
    },
    [queryClient, queryKey]
  );

  return {
    tags: query.data ?? [],
    isLoading: query.isLoading,
    createTag,
    updateTag,
    deleteTag,
  };
}
