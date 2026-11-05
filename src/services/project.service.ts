import { api } from "@/lib/api";

export interface ProjectStatus {
  id: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isClosed: boolean;
}

/**
 * PUBLIC: every workspace member can see and act on the project. PRIVATE:
 * visible only to the creator and explicitly invited members.
 *
 * A PRIVATE project you aren't a member of is omitted from `GET /projects`
 * entirely — so if a project reaches this client at all, the current user can
 * see it. There is no "am I a member" flag to check.
 */
export type ProjectVisibility = "PUBLIC" | "PRIVATE";

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  taskIdPrefix: string;
  isArchived: boolean;
  isFavorite?: boolean;
  /** Creator's user id. The only signal for "can I manage this project" —
   *  the API sends no isCreator flag, so compare against the current user. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  statuses: ProjectStatus[];
  _count: { taskLists: number };
  visibility: ProjectVisibility;
}

/**
 * A member of a PRIVATE project, from `GET /projects/:id/members`.
 *
 * Note the shape: `id` is the **membership row** id, and the person's details
 * are nested under `user`. Removal is by `userId` — passing `id` would send a
 * membership id to a user-id route. `ProjectMemberCandidate` below is flat and
 * its `id` *is* a user id; the two are easy to confuse.
 */
export interface ProjectMember {
  id: string;
  userId: string;
  invitedBy: string | null;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    avatarColor: string | null;
  };
}

/**
 * A row for the invite picker, from `GET /projects/:id/members/candidates`.
 * Creator-only. Every workspace member is returned, already annotated — so the
 * picker never has to diff two lists client-side.
 *
 * Flat, unlike {@link ProjectMember}: `id` here is the user id.
 */
export interface ProjectMemberCandidate {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  isProjectMember: boolean;
  isCreator: boolean;
}

/**
 * `POST /projects/:id/members/batch` result.
 *
 * The request returns 201 even when every entry failed, so success must be
 * read from `summary` — never from the fact that the promise resolved.
 */
export interface BatchInviteResult {
  results: {
    userId: string;
    status: "invited" | "already_member" | "failed";
    message: string | null;
  }[];
  summary: {
    total: number;
    invited: number;
    alreadyMember: number;
    failed: number;
  };
}

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

interface ProjectResponse {
  success: boolean;
  data: Project;
  message: string | null;
}

interface ProjectsResponse {
  success: boolean;
  data: Project[];
  message: string | null;
}

export interface CreateProjectPayload {
  name: string;
  taskIdPrefix: string;
  description?: string;
  color?: string;
  icon?: string;
  /** Omitted means PUBLIC. Creating as PRIVATE is private from the first
   *  moment — no window where the project is briefly workspace-visible. */
  visibility?: ProjectVisibility;
}

/**
 * Deliberately has no `visibility`: that lives on its own creator-only route
 * (`PATCH /projects/:id/visibility`). Smuggling it in here would make an
 * ordinary rename by a non-creator fail with 403.
 */
export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
}

export const projectService = {
  list: () =>
    api.get<ProjectsResponse>("/projects").then((r) => r.data.data),

  listArchived: () =>
    api.get<ProjectsResponse>("/projects/archived").then((r) => r.data.data),

  get: (id: string) =>
    api.get<ProjectResponse>(`/projects/${id}`).then((r) => r.data.data),

  create: (payload: CreateProjectPayload) =>
    api.post<ProjectResponse>("/projects", payload).then((r) => r.data.data),

  update: (id: string, payload: UpdateProjectPayload) =>
    api
      .patch<ProjectResponse>(`/projects/${id}`, payload)
      .then((r) => r.data.data),

  delete: (id: string) => api.delete(`/projects/${id}`),

  archive: (id: string) =>
    api.patch<ProjectResponse>(`/projects/${id}/archive`).then((r) => r.data.data),

  restore: (id: string) =>
    api.patch<ProjectResponse>(`/projects/${id}/restore`).then((r) => r.data.data),

  favorite: (id: string) => api.put(`/projects/${id}/favorite`),

  unfavorite: (id: string) => api.delete(`/projects/${id}/favorite`),

  // ── Visibility & membership ───────────────────────────────────────────────
  // All creator-only except `listMembers`, which any member may call. A
  // non-member gets 404 (not 403) from every one of these, matching how the
  // API refuses to confirm a private project even exists.

  /** Returns the full updated project, so the caller can patch local state. */
  setVisibility: (id: string, visibility: ProjectVisibility) =>
    api
      .patch<ProjectResponse>(`/projects/${id}/visibility`, { visibility })
      .then((r) => r.data.data),

  listMembers: (id: string) =>
    api
      .get<ApiWrapper<ProjectMember[]>>(`/projects/${id}/members`)
      .then((r) => r.data.data),

  /** Creator-only — a plain member gets 403, so gate the call site. */
  listMemberCandidates: (id: string) =>
    api
      .get<ApiWrapper<ProjectMemberCandidate[]>>(`/projects/${id}/members/candidates`)
      .then((r) => r.data.data),

  /** Returns no body; refetch the member list afterwards. 409 if already a member. */
  addMember: (id: string, userId: string) =>
    api
      .post<ApiWrapper<null>>(`/projects/${id}/members`, { userId })
      .then((r) => r.data.data),

  /** Max 50 per call. Resolves 201 even if every entry failed — read `summary`. */
  addMembersBatch: (id: string, userIds: string[]) =>
    api
      .post<ApiWrapper<BatchInviteResult>>(`/projects/${id}/members/batch`, { userIds })
      .then((r) => r.data.data),

  /** Takes the **user** id (`member.userId`), not the membership row id.
   *  Also unassigns that user from every task in the project, server-side. */
  removeMember: (id: string, userId: string) =>
    api
      .delete<ApiWrapper<null>>(`/projects/${id}/members/${userId}`)
      .then((r) => r.data.data),
};
