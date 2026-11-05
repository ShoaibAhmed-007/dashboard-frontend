"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/queries/keys";
import {
  flattenGroupedStatuses,
  statusService,
  type GroupedStatuses,
  type StatusItem,
} from "@/services/status.service";

/**
 * Shared statuses query for a project. Caches the raw grouped response under
 * `["statuses", projectId]` and exposes a flattened selector, so the board,
 * task views, and the project editors all share one cached fetch.
 */
export function useStatuses(projectId: string | null | undefined, enabled = true) {
  const query = useQuery<GroupedStatuses>({
    queryKey: queryKeys.statuses(projectId ?? ""),
    queryFn: () => statusService.list(projectId!),
    enabled: Boolean(projectId) && enabled,
    staleTime: 5 * 60_000,
  });

  const statuses = useMemo<StatusItem[]>(
    () => (query.data ? flattenGroupedStatuses(query.data) : []),
    [query.data]
  );

  return {
    grouped: query.data ?? null,
    statuses,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
