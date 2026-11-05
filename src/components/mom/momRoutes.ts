/**
 * Where "back to all meetings" goes. The flow is Departments → a department's
 * meetings (`/departments/[departmentId]`), so the standalone `/meetings` list
 * is no longer a destination. A workspace-general meeting (no department) has
 * no department page of its own, so it falls back to the Departments page.
 */
export function meetingsListHref(departmentId?: string | null): string {
  return departmentId ? `/departments/${departmentId}` : "/departments";
}
