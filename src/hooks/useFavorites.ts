"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { favoriteService } from "@/services/favorite.service";
import { Project } from "@/services/project.service";
import { TaskListItem } from "@/services/task.service";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useUiStore } from "@/stores/ui.store";
import { queryKeys } from "@/queries/keys";

type FavoritesData = { projects: Project[]; tasks: TaskListItem[] };

export function useFavorites() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const favoritesRefreshKey = useUiStore((s) => s.favoritesRefreshKey);
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.favorites(workspaceId), [workspaceId]);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<FavoritesData> => {
      const [projects, tasks] = await Promise.all([
        favoriteService.listProjects(),
        favoriteService.listTasks(),
      ]);
      return { projects, tasks };
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });

  // invalidateFavorites() (called imperatively from several mutation sites)
  // bumps this counter — react to it here rather than rewiring every call site.
  useEffect(() => {
    if (favoritesRefreshKey === 0) return;
    queryClient.invalidateQueries({ queryKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritesRefreshKey]);

  // Optimistic local removal — lets a "remove from favorites" click clear the
  // sidebar item instantly instead of waiting on the invalidate-then-refetch
  // round trip triggered above.
  const removeFavoriteProject = useCallback(
    (projectId: string) => {
      queryClient.setQueryData<FavoritesData>(queryKey, (prev) =>
        prev ? { ...prev, projects: prev.projects.filter((p) => p.id !== projectId) } : prev
      );
    },
    [queryClient, queryKey]
  );

  const removeFavoriteTask = useCallback(
    (taskId: string) => {
      queryClient.setQueryData<FavoritesData>(queryKey, (prev) =>
        prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) } : prev
      );
    },
    [queryClient, queryKey]
  );

  return {
    favoriteProjects: query.data?.projects ?? [],
    favoriteTasks: query.data?.tasks ?? [],
    isLoading: query.isLoading,
    removeFavoriteProject,
    removeFavoriteTask,
  };
}
