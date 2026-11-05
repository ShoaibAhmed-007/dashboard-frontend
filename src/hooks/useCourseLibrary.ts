"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { getCourses, type CoursesParams } from "@/services/university.service";
import { queryKeys } from "@/queries/keys";

export function useCourseLibrary(params: CoursesParams) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const queryKey = queryKeys.universityCourses(params);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await getCourses(params);
      return {
        courses: res.data,
        total: res.meta.total,
        totalPages: res.meta.totalPages,
      };
    },
    enabled: !!accessToken,
    staleTime: 5 * 60_000,
  });

  return {
    courses: query.data?.courses ?? [],
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 1,
    isLoading: query.isLoading,
    error: query.error ? "Failed to load courses" : null,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  };
}
