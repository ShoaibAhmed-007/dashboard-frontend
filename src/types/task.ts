// Re-export backend types (not TaskPriority — that conflicts with legacy)
export type {
  TaskStatusInfo,
  TaskUserInfo,
  TaskAssignee,
  TaskTagInfo,
  TaskListRef,
  TaskListItem,
  TaskDetail,
  TaskTimeEntry,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateSubtaskPayload,
} from "@/services/task.service";

// Legacy local types kept for backward compatibility with old components
export type LegacyTaskStatus = "todo" | "in-progress" | "review" | "done";
export type LegacyTaskPriority = "urgent" | "high" | "normal" | "low";

// Backward-compat aliases used by old components
export type TaskStatus = LegacyTaskStatus;
export type TaskPriority = LegacyTaskPriority;

export interface TaskTag {
  id: string;
  name: string;
  color: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assignee?: string;
  dueDate?: string;
  priority?: LegacyTaskPriority;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
}

export interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  url?: string;
}

// Legacy Task shape — used by old form/board/calendar components
export interface Task {
  id: string;
  projectId: string;
  listId: string;
  title: string;
  description: string;
  status: LegacyTaskStatus;
  statusId?: string;
  priority: LegacyTaskPriority;
  assignees: string[];
  dueDate: string;
  startDate?: string;
  tags: TaskTag[];
  subtasks: Subtask[];
  checklists: Checklist[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  timeEstimate?: number;
  createdAt: string;
}

export interface TaskFilters {
  search: string;
  status: LegacyTaskStatus | "all";
  priority: LegacyTaskPriority | "all";
  assignee: string;
}

export const TASK_STATUS_CONFIG: Record<
  LegacyTaskStatus,
  { label: string; color: string; bg: string; dot: string; border: string }
> = {
  todo: {
    label: "To Do",
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800",
    dot: "bg-gray-400",
    border: "border-gray-400",
  },
  "in-progress": {
    label: "In Progress",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    dot: "bg-blue-500",
    border: "border-blue-500",
  },
  review: {
    label: "Review",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-500/10",
    dot: "bg-orange-500",
    border: "border-orange-500",
  },
  done: {
    label: "Done",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-500/10",
    dot: "bg-green-500",
    border: "border-green-500",
  },
};

export const TASK_PRIORITY_CONFIG: Record<
  LegacyTaskPriority,
  { label: string; color: string; bg: string; dot: string }
> = {
  urgent: {
    label: "Urgent",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10",
    dot: "bg-red-500",
  },
  high: {
    label: "High",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-500/10",
    dot: "bg-orange-500",
  },
  normal: {
    label: "Normal",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    dot: "bg-blue-500",
  },
  low: {
    label: "Low",
    color: "text-gray-500 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800",
    dot: "bg-gray-400",
  },
};

export const ALL_STATUSES: LegacyTaskStatus[] = ["todo", "in-progress", "review", "done"];
export const ALL_PRIORITIES: LegacyTaskPriority[] = ["urgent", "high", "normal", "low"];

export const SAMPLE_ASSIGNEES = [
  "Alice Johnson",
  "Bob Smith",
  "Carol White",
  "David Lee",
  "Emma Davis",
];

export const SAMPLE_TAGS: TaskTag[] = [
  { id: "t1", name: "Design", color: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" },
  { id: "t2", name: "Frontend", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" },
  { id: "t3", name: "Backend", color: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" },
  { id: "t4", name: "Bug", color: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" },
  { id: "t5", name: "Feature", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300" },
  { id: "t6", name: "Urgent", color: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" },
  { id: "t7", name: "Research", color: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300" },
];
