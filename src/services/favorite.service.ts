import { api } from "@/lib/api";
import { Project } from "./project.service";
import { TaskListItem } from "./task.service";

interface ProjectsResponse {
  success: boolean;
  data: Project[];
  message: string | null;
}

interface TasksResponse {
  success: boolean;
  data: TaskListItem[];
  message: string | null;
}

export const favoriteService = {
  listProjects: () =>
    api.get<ProjectsResponse>("/favorites/projects").then((r) => r.data.data),

  listTasks: () =>
    api.get<TasksResponse>("/favorites/tasks").then((r) => r.data.data),
};
