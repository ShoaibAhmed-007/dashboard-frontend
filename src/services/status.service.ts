import { api } from "@/lib/api";

export type StatusGroup = "NOT_STARTED" | "ACTIVE" | "DONE" | "CLOSED";

export interface StatusItem {
  id: string;
  projectId: string;
  name: string;
  color: string;
  group: StatusGroup;
  position: number;
  isDefault: boolean;
  isProtected: boolean;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupedStatuses {
  projectId: string;
  groups: {
    notStarted: StatusItem[];
    active: StatusItem[];
    done: StatusItem[];
    closed: StatusItem[];
  };
}

export interface CreateStatusPayload {
  projectId: string;
  name: string;
  color?: string;
  group: "NOT_STARTED" | "ACTIVE" | "DONE";
}

export interface UpdateStatusPayload {
  name?: string;
  color?: string;
}

export interface ReorderGroupsPayload {
  notStarted: string[];
  active: string[];
  done: string[];
  closed: string[];
}

interface StatusResponse {
  success: boolean;
  data: StatusItem;
  message: string | null;
}

interface GroupedStatusesResponse {
  success: boolean;
  data: GroupedStatuses;
  message: string | null;
}

export const statusService = {
  create: (payload: CreateStatusPayload) =>
    api.post<StatusResponse>("/statuses", payload).then((r) => r.data.data),

  list: (projectId: string) =>
    api
      .get<GroupedStatusesResponse>("/statuses", { params: { projectId } })
      .then((r) => r.data.data),

  get: (id: string) =>
    api.get<StatusResponse>(`/statuses/${id}`).then((r) => r.data.data),

  update: (id: string, payload: UpdateStatusPayload) =>
    api.put<StatusResponse>(`/statuses/${id}`, payload).then((r) => r.data.data),

  delete: (id: string, replacementStatusId?: string) =>
    api.delete(`/statuses/${id}`, {
      data: replacementStatusId ? { replacementStatusId } : undefined,
    }),

  reorder: (projectId: string, groups: ReorderGroupsPayload) =>
    api
      .put<GroupedStatusesResponse>("/statuses/reorder", { projectId, groups })
      .then((r) => r.data.data),
};

export function flattenGroupedStatuses(grouped: GroupedStatuses): StatusItem[] {
  const { notStarted, active, done, closed } = grouped.groups;
  const normalizedClosed = closed.map((s) => ({ ...s, color: "#2a9764" }));
  return [...notStarted, ...active, ...done, ...normalizedClosed];
}
