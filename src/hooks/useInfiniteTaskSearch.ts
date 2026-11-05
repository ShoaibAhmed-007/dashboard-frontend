"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/queries/keys";
import { taskService, TaskSearchParams, TaskSearchResult } from "@/services/task.service";
import { normalizeParams, TaskSearchScope } from "@/stores/task-search.store";

function loadPage(scope: TaskSearchScope, params: TaskSearchParams, page: number): Promise<TaskSearchResult> {
  const pageParams = { ...params, page };
  if (scope.type === "workspace") return taskService.searchWorkspace(pageParams);
  if (scope.type === "project") return taskService.searchProject(scope.projectId, pageParams);
  return taskService.searchList(scope.projectId, scope.listId, pageParams);
}

export function useInfiniteTaskSearch(scope: TaskSearchScope | null, params?: TaskSearchParams) {
  const normalizedParams = normalizeParams(params);
  const queryKey = scope ? queryKeys.taskBoardInfinite(scope, normalizedParams) : ["task-board-infinite", "disabled"];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => loadPage(scope!, normalizedParams, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.meta.has_next ? lastPage.meta.page + 1 : undefined),
    enabled: !!scope,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data]
  );

  return {
    items,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    queryKeyString: JSON.stringify(queryKey),
  };
}
