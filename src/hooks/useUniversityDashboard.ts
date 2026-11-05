"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { getDashboardStats, getMyCourses } from "@/services/university.service";
import { queryKeys } from "@/queries/keys";

export function useUniversityDashboard() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const query = useQuery({
    queryKey: queryKeys.universityDashboard(),
    queryFn: async () => {
      const [stats, coursesRes] = await Promise.all([
        getDashboardStats(),
        getMyCourses(1, 3),
      ]);
      return { stats, myCourses: coursesRes.data };
    },
    enabled: !!accessToken,
    staleTime: 5 * 60_000,
  });

  return {
    stats: query.data?.stats ?? null,
    myCourses: query.data?.myCourses ?? [],
    isLoading: query.isLoading,
    error: query.error ? "Failed to load dashboard data" : null,
  };
}
