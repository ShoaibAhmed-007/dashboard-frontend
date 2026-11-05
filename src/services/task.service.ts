import { api } from "@/lib/api";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

interface PaginatedApiWrapper<T> extends ApiWrapper<T> {
  meta: TaskSearchMeta;
}

export type TaskPriority = "URGENT" | "HIGH" | "NORMAL" | "LOW" | "NONE";
export type TaskSortOrder = "asc" | "desc";
export type TaskAssigneeMatch = "any" | "all";
export type TaskTagMatch = "any" | "all";
export type TaskStatusGroup = "NOT_STARTED" | "ACTIVE" | "DONE" | "CLOSED";

export interface TaskStatusInfo {
  id: string;
  name: string;
  color: string;
  group: "NOT_STARTED" | "ACTIVE" | "DONE" | "CLOSED";
}

export interface TaskUserInfo {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  avatarColor: string;
}

export interface TaskAssignee {
  user: TaskUserInfo;
  assignedBy: string;
}

export interface TaskTagInfo {
  tag: {
    id: string;
    name: string;
    color: string;
  };
}

export interface TaskListRef {
  id: string;
  name: string;
  project: { id: string; name: string; taskIdPrefix: string };
}

export interface TaskListItem {
  id: string;
  taskId: string;
  taskNumber: number;
  title: string;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  depth: number;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: TaskStatusInfo;
  assignees: TaskAssignee[];
  tags: TaskTagInfo[];
  list: TaskListRef;
  isFavorite?: boolean;
  _count: { children: number };
}

// Returned by the bulk GET /tasks/batch endpoint — a list item plus creator.
export interface TaskListItemWithCreator extends TaskListItem {
  creator: TaskUserInfo;
}

export interface TaskDetail {
  id: string;
  taskId: string;
  taskNumber: number;
  parentId: string | null;
  depth: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  isCompleted: boolean;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  totalTimeLogged: number;
  status: TaskStatusInfo;
  creator: TaskUserInfo;
  assignees: TaskAssignee[];
  tags: TaskTagInfo[];
  list: TaskListRef;
  isFavorite?: boolean;
  children: (Omit<TaskListItem, "_count"> & { _count?: { children: number } })[];
  timeEntries: TaskTimeEntry[];
}

export interface TaskTimeEntry {
  id: string;
  userId: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  isManual: boolean;
  createdAt: string;
  updatedAt: string;
  user: TaskUserInfo;
}

export interface TaskSearchMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface TaskSearchResult {
  items: TaskListItem[];
  meta: TaskSearchMeta;
}

export interface TaskSearchParams {
  q?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: TaskSortOrder;
  status_ids?: string[];
  status_groups?: TaskStatusGroup[];
  priority?: TaskPriority[];
  assignee_ids?: string[];
  assignee_match?: TaskAssigneeMatch;
  tag_ids?: string[];
  tag_match?: TaskTagMatch;
  due_date?: string;
  include_subtasks?: boolean;
  include_closed?: boolean;
  include_archived?: boolean;
  me?: boolean;
}

export interface CreateTaskPayload {
  title: string;
  statusId: string;
  description?: string;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  assigneeIds?: string[];
  tagIds?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  statusId?: string;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  listId?: string;
}

export interface CreateSubtaskPayload {
  title: string;
  statusId: string;
  description?: string | null;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
}

function serializeTaskSearchParams(params?: TaskSearchParams) {
  if (!params) return undefined;

  const query: Record<string, string | number | boolean> = {};
  const append = (key: keyof TaskSearchParams, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      query[key] = value.join(",");
      return;
    }
    query[key] = value as string | number | boolean;
  };

  append("q", params.q ?? params.search);
  append("page", params.page);
  append("limit", params.limit);
  append("sort_by", params.sort_by);
  append("sort_order", params.sort_order);
  append("status_ids", params.status_ids);
  append("status_groups", params.status_groups);
  append("priority", params.priority);
  append("assignee_ids", params.assignee_ids);
  append("assignee_match", params.assignee_match);
  append("tag_ids", params.tag_ids);
  append("tag_match", params.tag_match);
  append("due_date", params.due_date);
  append("include_subtasks", params.include_subtasks);
  append("include_closed", params.include_closed);
  append("include_archived", params.include_archived);
  append("me", params.me);

  return query;
}

export const taskService = {
  list: (projectId: string, listId: string) =>
    api
      .get<ApiWrapper<TaskListItem[]>>(`/projects/${projectId}/lists/${listId}/tasks`)
      .then((r) => r.data.data),

  searchWorkspace: (params?: TaskSearchParams) =>
    api
      .get<PaginatedApiWrapper<TaskListItem[]>>("/tasks", {
        params: serializeTaskSearchParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  searchProject: (projectId: string, params?: TaskSearchParams) =>
    api
      .get<PaginatedApiWrapper<TaskListItem[]>>(`/projects/${projectId}/tasks`, {
        params: serializeTaskSearchParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  searchList: (projectId: string, listId: string, params?: TaskSearchParams) =>
    api
      .get<PaginatedApiWrapper<TaskListItem[]>>(`/projects/${projectId}/lists/${listId}/tasks`, {
        params: serializeTaskSearchParams(params),
      })
      .then((r) => ({ items: r.data.data, meta: r.data.meta })),

  get: (taskId: string) =>
    api
      .get<ApiWrapper<TaskDetail>>(`/tasks/${taskId}`)
      .then((r) => r.data.data),

  // Bulk lookup by id in one request (avoids N+1 GET /tasks/:id calls).
  // Returns list items augmented with `creator` (used by the Inbox actor map).
  getByIds: (ids: string[]) =>
    ids.length === 0
      ? Promise.resolve([] as TaskListItemWithCreator[])
      : api
          .get<ApiWrapper<TaskListItemWithCreator[]>>("/tasks/batch", {
            params: { ids: ids.join(",") },
          })
          .then((r) => r.data.data),

  create: (projectId: string, listId: string, payload: CreateTaskPayload) =>
    api
      .post<ApiWrapper<TaskDetail>>(`/projects/${projectId}/lists/${listId}/tasks`, payload)
      .then((r) => r.data.data),

  update: (taskId: string, payload: UpdateTaskPayload) =>
    api
      .patch<ApiWrapper<TaskDetail>>(`/tasks/${taskId}`, payload)
      .then((r) => r.data.data),

  delete: (taskId: string) =>
    api.delete(`/tasks/${taskId}`).then((r) => r.data),

  complete: (taskId: string) =>
    api
      .patch<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/complete`, {})
      .then((r) => r.data.data),

  uncomplete: (taskId: string) =>
    api
      .patch<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/uncomplete`, {})
      .then((r) => r.data.data),

  reorder: (projectId: string, listId: string, taskIds: string[]) =>
    api
      .put<ApiWrapper<TaskListItem[]>>(`/projects/${projectId}/lists/${listId}/tasks/reorder`, { taskIds })
      .then((r) => r.data.data),

  createSubtask: (taskId: string, payload: CreateSubtaskPayload) =>
    api
      .post<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/subtasks`, payload)
      .then((r) => r.data.data),

  getSubtasks: (taskId: string) =>
    api
      .get<ApiWrapper<TaskListItem[]>>(`/tasks/${taskId}/subtasks`)
      .then((r) => r.data.data),

  addAssignee: (taskId: string, userIds: string[]) =>
    api
      .post<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/assignees`, { userIds })
      .then((r) => r.data.data),

  removeAssignee: (taskId: string, userId: string) =>
    api
      .delete<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/assignees/${userId}`)
      .then((r) => r.data.data),

  addTag: (taskId: string, tagId: string) =>
    api
      .post<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/tags`, { tagId })
      .then((r) => r.data.data),

  removeTag: (taskId: string, tagId: string) =>
    api
      .delete<ApiWrapper<TaskDetail>>(`/tasks/${taskId}/tags/${tagId}`)
      .then((r) => r.data.data),

  getBoard: (projectId: string, params?: TaskSearchParams) =>
    api
      .get<ApiWrapper<BoardResponse>>(`/projects/${projectId}/board/tasks`, {
        params: serializeTaskSearchParams(params),
      })
      .then((r) => r.data.data),

  boardReorder: (projectId: string, payload: BoardReorderPayload) =>
    api
      .put<ApiWrapper<BoardResponse>>(`/projects/${projectId}/board/tasks/reorder`, payload)
      .then((r) => r.data.data),

  favorite: (taskId: string) => api.put(`/tasks/${taskId}/favorite`),

  unfavorite: (taskId: string) => api.delete(`/tasks/${taskId}/favorite`),
};

export interface BoardStatusInfo {
  id: string;
  name: string;
  color: string;
  group: "NOT_STARTED" | "ACTIVE" | "DONE" | "CLOSED";
  position: number;
  isDefault: boolean;
  isProtected: boolean;
  isClosed: boolean;
}

export interface BoardColumn {
  status: BoardStatusInfo;
  tasks: TaskListItem[];
  total: number;
}

export interface BoardResponse {
  groupBy: string;
  projectId: string;
  columns: BoardColumn[];
  total: number;
}

export interface BoardReorderPayload {
  mode: "manual";
  taskId: string;
  toStatusId: string;
  toListId?: string;
  orderedTaskIds: string[];
}

export { serializeTaskSearchParams };
