import { api } from "@/lib/api";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null; // seconds, null if timer running
  isManual: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; fullName: string; avatarUrl: string | null; avatarColor: string };
}

export interface StartTimerResult {
  stoppedEntry: TimeEntry | null;
  activeEntry: TimeEntry;
}

export const timeEntryService = {
  logManual: (taskId: string, payload: { description?: string; durationMinutes: number }) =>
    api.post<ApiWrapper<TimeEntry>>(`/tasks/${taskId}/time/manual`, payload).then(r => r.data.data),

  startTimer: (taskId: string) =>
    api.post<ApiWrapper<StartTimerResult>>(`/tasks/${taskId}/time/start`).then(r => r.data.data),

  stopTimer: (taskId: string) =>
    api.post<ApiWrapper<TimeEntry>>(`/tasks/${taskId}/time/stop`).then(r => r.data.data),

  list: (taskId: string) =>
    api.get<ApiWrapper<TimeEntry[]>>(`/tasks/${taskId}/time`).then(r => r.data.data),

  getActive: () =>
    api.get<ApiWrapper<TimeEntry | null>>("/time-entries/active").then(r => r.data.data),

  delete: (entryId: string) =>
    api.delete<ApiWrapper<null>>(`/time-entries/${entryId}`).then(r => r.data),
};
