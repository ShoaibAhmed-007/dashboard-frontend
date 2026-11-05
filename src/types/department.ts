/**
 * Per-workspace department (Sales, HR, Finance, ...), used to scope Minutes
 * of Meeting access for MEMBERs — independent of workspace `Role`. A member
 * belongs to at most one department. Mirrors what `/departments` actually
 * returns, per `apps/api/src/departments/` in the backend.
 */

export type DepartmentMemberUser = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  avatarColor: string;
};

/** A department's supervisor/admin — always also one of its `members`. */
export type DepartmentSupervisor = {
  /** WorkspaceMember id — matches a DepartmentMember.id in this department. */
  id: string;
  user: DepartmentMemberUser;
};

export type DepartmentMember = {
  /** WorkspaceMember id — use this (not user.id) when calling assignMember. */
  id: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER";
  user: DepartmentMemberUser;
};

export type Department = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  /** False pauses Minutes of Meeting access for every member of this
   *  department, independent of deletion. */
  isActive: boolean;
  supervisorId: string | null;
  supervisor: DepartmentSupervisor | null;
  /** First few members only, for a card's avatar-stack preview — see
   *  `_count.members` for the real total. */
  members: DepartmentMember[];
  _count: { members: number };
};

/** `GET /departments/:departmentId` — the list shape plus its member roster. */
export type DepartmentDetail = Department & {
  members: DepartmentMember[];
};

export type CreateDepartmentPayload = {
  name: string;
  color?: string;
  description?: string;
  /** A WorkspaceMember id or user id (see `assignMember`) to make this
   *  department's supervisor/admin — they are auto-assigned as a member of
   *  this department. */
  supervisorId?: string;
};

/** Every field optional; the server rejects an empty body. */
export type UpdateDepartmentPayload = {
  name?: string;
  color?: string;
  description?: string;
  /** Same id flexibility as CreateDepartmentPayload.supervisorId, or null to
   *  clear the current one. */
  supervisorId?: string | null;
  /** Pauses (false) or resumes (true) MoM access for every member. */
  isActive?: boolean;
};

export type DepartmentListParams = {
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  status?: "active" | "inactive";
};

/** The app's standard paginated envelope. */
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};
