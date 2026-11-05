import { api } from "@/lib/api";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface DashboardOwner {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  avatarColor: string;
}

export type DashboardPriority = "URGENT" | "HIGH" | "NORMAL" | "LOW" | "NONE";

export interface DashboardList {
  id: string;
  name: string;
  position: number;
  startDate: string | null;
  endDate: string | null;
  ownerUserId: string | null;
  priority: DashboardPriority | null;
  owner: DashboardOwner | null;
  taskCount: number;
  completedCount: number;
  openCount: number;
}

export interface DashboardAttachment {
  id: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  listId: string;
  listName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedBy: DashboardOwner;
}

export interface DashboardStatusSummary {
  statusId: string;
  name: string;
  color: string;
  group: string;
  position: number;
  count: number;
}

export interface DashboardProject {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

export interface DashboardData {
  project: DashboardProject;
  statusSummary: DashboardStatusSummary[];
  lists: DashboardList[];
  attachments: DashboardAttachment[];
  docs: unknown[];
}

export interface UpdateListOverviewPayload {
  name?: string;
  startDate?: string | null;
  endDate?: string | null;
  ownerId?: string | null;
  priority?: DashboardPriority | null;
}

export interface UpdatedList {
  id: string;
  projectId: string;
  name: string;
  position: number;
  startDate: string | null;
  endDate: string | null;
  ownerUserId: string | null;
  priority: DashboardPriority | null;
  isArchived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  owner: DashboardOwner | null;
}

export const dashboardService = {
  get: (projectId: string) =>
    api
      .get<ApiWrapper<DashboardData>>(`/projects/${projectId}/dashboard`)
      .then((r) => r.data.data),

  updateList: (projectId: string, listId: string, payload: UpdateListOverviewPayload) =>
    api
      .patch<ApiWrapper<UpdatedList>>(`/projects/${projectId}/lists/${listId}`, payload)
      .then((r) => r.data.data),
};
