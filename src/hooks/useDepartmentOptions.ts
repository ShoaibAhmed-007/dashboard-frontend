import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { companyEmployeesService } from "@/services/it-management.service";
import { queryKeys } from "@/queries/keys";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { DEPARTMENTS } from "@/types/it-management";

/**
 * Every department a picker or filter should offer, as stored values: the
 * suggested ones first, then any custom department already used by an
 * employee. Shares its cache entry with the Employees screen, so it costs no
 * extra request there. If the caller can't list employees the query simply
 * fails and the suggestions alone are returned.
 *
 * `extra` adds values that must stay selectable (e.g. the department already
 * saved on a request) even when no employee carries them any more.
 */
export function useDepartmentOptions(extra: Array<string | null | undefined> = []): string[] {
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const { data } = useQuery({
    queryKey: queryKeys.companyEmployees(workspaceId, { limit: 100, facets: true }),
    queryFn: () => companyEmployeesService.list({ limit: 100 }),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
    retry: false,
  });

  const extraKey = extra.join("|");
  return useMemo(() => {
    const known = new Set<string>(DEPARTMENTS);
    const inUse = (data?.items ?? []).map((employee) => employee.department);
    const custom = Array.from(
      new Set([...inUse, ...extra].filter((value): value is string => Boolean(value) && !known.has(value as string)))
    ).sort((a, b) => a.localeCompare(b));
    return [...DEPARTMENTS, ...custom];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, extraKey]);
}
