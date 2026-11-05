import { api } from "@/lib/api";
import type {
  CreateMeetingPayload,
  CreateMeetingTaskPayload,
  Meeting,
  MeetingListItem,
  PaginationMeta,
  UpdateMeetingPayload,
} from "@/types/mom";

/**
 * Minutes of Meeting.
 *
 * The whole feature is `@Roles('OWNER','MANAGER')` server-side — a MEMBER gets
 * 403 on every route here, **including reads**. Callers gate on
 * `useWorkspaceManageAccess().canManageWorkspace` rather than letting the 403
 * surface as an error toast.
 *
 * No `x-workspace-id` is set here: the axios instance attaches it to every
 * request from the active workspace (see `lib/api.ts`).
 */
export const momService = {
  /**
   * Newest first. The endpoint supports `page`/`limit` and, for OWNER/MANAGER
   * only, `departmentId` to narrow to one department (see
   * DepartmentMeetingsPage) — no other server-side search or filter, so the
   * list screen narrows anything else itself from what it fetched.
   */
  list: async (params?: {
    page?: number;
    limit?: number;
    departmentId?: string;
  }): Promise<{ items: MeetingListItem[]; meta: PaginationMeta }> => {
    const { data } = await api.get<{
      data: MeetingListItem[];
      meta: PaginationMeta;
    }>("/meetings", { params });
    /* The paginated envelope puts rows at `data` and the page info alongside
       it — not the `{ data: { items } }` shape the other list endpoints use. */
    return { items: data.data, meta: data.meta };
  },

  getById: async (meetingId: string): Promise<Meeting> => {
    const { data } = await api.get<{ data: Meeting }>(`/meetings/${meetingId}`);
    return data.data;
  },

  /**
   * Each `tasks[]` entry becomes a real task in its project's first list and
   * first NOT_STARTED status, and notifies the assignee. There is no list or
   * status picker in this flow by design.
   */
  create: async (payload: CreateMeetingPayload): Promise<Meeting> => {
    const { data } = await api.post<{ data: Meeting }>("/meetings", payload);
    return data.data;
  },

  /** Creator-only (403 otherwise). An empty patch is rejected with 422. */
  update: async (
    meetingId: string,
    payload: UpdateMeetingPayload
  ): Promise<Meeting> => {
    const { data } = await api.patch<{ data: Meeting }>(
      `/meetings/${meetingId}`,
      payload
    );
    return data.data;
  },

  /**
   * Creator-only. Soft-deletes the meeting; its follow-up tasks are untouched
   * apart from losing the link, so they keep their status, assignee and
   * subtasks and stay visible in their projects.
   */
  remove: async (meetingId: string): Promise<void> => {
    await api.delete(`/meetings/${meetingId}`);
  },

  /**
   * Adds one more follow-up task to an existing meeting — creator-only, same
   * project/assignee/dueDate shape as a task inside `create()`'s own
   * `tasks[]`. Returns the full refreshed meeting, tasks and taskStats
   * included, so the caller can just replace its cached detail with it.
   */
  addTask: async (
    meetingId: string,
    payload: CreateMeetingTaskPayload
  ): Promise<Meeting> => {
    const { data } = await api.post<{ data: Meeting }>(
      `/meetings/${meetingId}/tasks`,
      payload
    );
    return data.data;
  },
};
