import { api } from "@/lib/api";

export type DocScope = "WORKSPACE" | "PROJECT" | "PERSONAL";

export interface Doc {
  id: string;
  workspaceId: string;
  projectId: string | null;
  ownerId: string;
  scope: DocScope;
  title: string;
  contentJson: Record<string, unknown>;
  plaintext: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DocSearchResult {
  id: string;
  title: string;
  scope: DocScope;
  projectId: string | null;
  updatedAt: string;
  snippet: string;
  rank: number;
}

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface CreateDocPayload {
  title: string;
  scope: DocScope;
  workspaceId: string;
  projectId?: string | null;
  contentJson?: Record<string, unknown>;
}

export interface UpdateDocPayload {
  title?: string;
  contentJson?: Record<string, unknown>;
}

export const docsService = {
  create: (payload: CreateDocPayload) =>
    api.post<ApiWrapper<Doc>>("/docs", payload).then((r) => r.data.data),

  list: (params: { workspaceId: string; projectId?: string; scope?: DocScope }) =>
    api
      .get<ApiWrapper<Doc[]>>("/docs", { params })
      .then((r) => r.data.data),

  get: (id: string) =>
    api.get<ApiWrapper<Doc>>(`/docs/${id}`).then((r) => r.data.data),

  update: (id: string, payload: UpdateDocPayload) =>
    api.patch<ApiWrapper<Doc>>(`/docs/${id}`, payload).then((r) => r.data.data),

  delete: (id: string) =>
    api.delete<ApiWrapper<unknown>>(`/docs/${id}`).then((r) => r.data),

  search: (params: { workspaceId: string; q: string; projectId?: string }) =>
    api
      .get<ApiWrapper<DocSearchResult[]>>("/docs/search", { params })
      .then((r) => r.data.data),
};
