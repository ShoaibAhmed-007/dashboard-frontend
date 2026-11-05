import { StatusItem } from "@/services/status.service";
import { Task, TaskStatus } from "@/types/task";

export function legacyStatusFromBackendStatus(status: StatusItem): TaskStatus {
  if (status.isClosed || status.group === "CLOSED") return "done";
  if (status.group === "DONE") return "review";
  if (status.group === "ACTIVE") return "in-progress";
  return "todo";
}

export function findStatusForTask(task: Task, statuses: StatusItem[]) {
  if (task.statusId) {
    const matchedById = statuses.find((status) => status.id === task.statusId);
    if (matchedById) return matchedById;
  }

  const taskStatus = task.status.replace(/[\s_-]/g, "");
  return statuses.find((status) => {
    const normalizedName = status.name.toLowerCase().replace(/[\s_-]/g, "");
    const legacyMap: Record<string, string[]> = {
      todo: ["todo"],
      inprogress: ["in-progress", "inprogress"],
      review: ["review"],
      done: ["done"],
      complete: ["done"],
      completed: ["done"],
    };

    return (legacyMap[normalizedName] ?? [normalizedName]).includes(taskStatus);
  });
}

export function taskMatchesStatus(task: Task, status: StatusItem) {
  return findStatusForTask(task, [status])?.id === status.id;
}
