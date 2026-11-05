import { api } from "@/lib/api";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface WorkspaceTag {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export const tagService = {
  list: () =>
    api.get<ApiWrapper<WorkspaceTag[]>>("/tags").then((r) => r.data.data),

  create: (payload: { name: string; color?: string }) =>
    api.post<ApiWrapper<WorkspaceTag>>("/tags", payload).then((r) => r.data.data),

  update: (tagId: string, payload: { name?: string; color?: string }) =>
    api.patch<ApiWrapper<WorkspaceTag>>(`/tags/${tagId}`, payload).then((r) => r.data.data),

  delete: (tagId: string) =>
    api.delete<ApiWrapper<null>>(`/tags/${tagId}`).then((r) => r.data),
};
