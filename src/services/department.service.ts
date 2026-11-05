import { api } from "@/lib/api";
import type {
  CreateDepartmentPayload,
  Department,
  DepartmentDetail,
  DepartmentListParams,
  PaginationMeta,
  UpdateDepartmentPayload,
} from "@/types/department";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

/**
 * Department CRUD and member assignment — OWNER/MANAGER only server-side
 * (`@Roles('OWNER','MANAGER')` on `DepartmentsController`), the same gate
 * that already fully controls MoM. Callers should be behind
 * `useWorkspaceManageAccess().canManageWorkspace`, same as the MoM screens.
 *
 * No `x-workspace-id` is set here: the axios instance attaches it to every
 * request from the active workspace (see `lib/api.ts`).
 */
export const departmentService = {
  list: async (
    params?: DepartmentListParams
  ): Promise<{ items: Department[]; meta: PaginationMeta }> => {
    const { data } = await api.get<{ data: Department[]; meta: PaginationMeta }>(
      "/departments",
      { params }
    );
    return { items: data.data, meta: data.meta };
  },

  getById: async (departmentId: string): Promise<DepartmentDetail> => {
    const { data } = await api.get<ApiWrapper<DepartmentDetail>>(
      `/departments/${departmentId}`
    );
    return data.data;
  },

  create: async (payload: CreateDepartmentPayload): Promise<Department> => {
    const { data } = await api.post<ApiWrapper<Department>>(
      "/departments",
      payload
    );
    return data.data;
  },

  update: async (
    departmentId: string,
    payload: UpdateDepartmentPayload
  ): Promise<Department> => {
    const { data } = await api.patch<ApiWrapper<Department>>(
      `/departments/${departmentId}`,
      payload
    );
    return data.data;
  },

  /** Soft-deletes the department and clears it off every member assigned to
   *  it — those members lose MoM access immediately, matching the backend's
   *  own cleanup transaction. */
  remove: async (departmentId: string): Promise<void> => {
    await api.delete(`/departments/${departmentId}`);
  },

  /** `memberId` accepts either a WorkspaceMember id (e.g. from a
   *  DepartmentDetail's own `members[]`) or a user id (what
   *  `useWorkspaceMembers` actually returns as `id` — the server resolves
   *  either). Send `departmentId: null` to unassign. */
  assignMember: async (
    memberId: string,
    departmentId: string | null
  ): Promise<void> => {
    await api.patch(`/departments/members/${memberId}`, { departmentId });
  },
};
