import { api } from "@/lib/api";

export interface TaskList {
  id: string;
  projectId: string;
  name: string;
  position: number;
  isArchived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskListResponse {
  success: boolean;
  data: TaskList;
  message: string | null;
}

interface TaskListsResponse {
  success: boolean;
  data: TaskList[];
  message: string | null;
}

export interface CreateTaskListPayload {
  name: string;
}

export interface UpdateTaskListPayload {
  name: string;
}

export const taskListService = {
  list: (projectId: string, includeArchived = false) =>
    api
      .get<TaskListsResponse>(`/projects/${projectId}/lists`, {
        params: includeArchived ? { includeArchived: true } : undefined,
      })
      .then((response) => response.data.data),

  create: (projectId: string, payload: CreateTaskListPayload) =>
    api
      .post<TaskListResponse>(`/projects/${projectId}/lists`, payload)
      .then((response) => response.data.data),

  update: (projectId: string, listId: string, payload: UpdateTaskListPayload) =>
    api
      .patch<TaskListResponse>(`/projects/${projectId}/lists/${listId}`, payload)
      .then((response) => response.data.data),

  archive: (projectId: string, listId: string) =>
    api
      .patch<TaskListResponse>(`/projects/${projectId}/lists/${listId}/archive`)
      .then((response) => response.data.data),

  restore: (projectId: string, listId: string) =>
    api
      .patch<TaskListResponse>(`/projects/${projectId}/lists/${listId}/restore`)
      .then((response) => response.data.data),

  reorder: (projectId: string, listIds: string[]) =>
    api
      .put<TaskListsResponse>(`/projects/${projectId}/lists/reorder`, { listIds })
      .then((response) => response.data.data),

  delete: (projectId: string, listId: string) =>
    api.delete(`/projects/${projectId}/lists/${listId}`),
};
