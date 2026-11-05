"use client";

import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/keys";

export function useInvalidateUniversityCache() {
  const queryClient = useQueryClient();

  return {
    invalidateDashboard: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.universityDashboard() }),
    invalidateLibrary: () =>
      queryClient.invalidateQueries({ queryKey: ["university", "courses"] }),
  };
}
