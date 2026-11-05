import { api } from "@/lib/api";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface ActivityActor {
  id: string;
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  avatarColor: string;
}

export interface ActivityItem {
  id: string;
  kind: "activity" | "comment";
  category: string;
  entityType: string;
  entityId: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown>;
  actor: ActivityActor;
  displayText: string;
  createdAt: string;
}

export interface ActivityPage {
  items: ActivityItem[];
  nextCursor: string | null;
}

export interface TaskActivityParams {
  cursor?: string;
  limit?: number;
  q?: string;
  categories?: string;
  actions?: string;
  actorIds?: string;
  includeSubtasks?: boolean;
  me?: boolean;
  from?: string;
  to?: string;
}

export interface ProjectActivityParams {
  cursor?: string;
  limit?: number;
  q?: string;
  categories?: string;
  actions?: string;
  actorIds?: string;
  me?: boolean;
  from?: string;
  to?: string;
}

export const activityService = {
  getTaskActivity: (taskId: string, params?: TaskActivityParams) =>
    api
      .get<ApiWrapper<ActivityPage>>(`/tasks/${taskId}/activity`, { params })
      .then((r) => r.data.data),

  getProjectActivity: (projectId: string, params?: ProjectActivityParams) =>
    api
      .get<ApiWrapper<ActivityPage>>(`/activity`, { params: { projectId, ...params } })
      .then((r) => r.data.data),
};
