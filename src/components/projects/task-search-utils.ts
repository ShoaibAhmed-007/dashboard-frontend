"use client";

import { ReadonlyURLSearchParams } from "next/navigation";
import {
  TaskPriority,
  TaskSearchParams,
  TaskSortOrder,
  TaskStatusGroup,
} from "@/services/task.service";

export const DEFAULT_TASK_PAGE = 1;
export const DEFAULT_TASK_LIMIT = 20;

const BOOLEAN_KEYS = new Set([
  "include_subtasks",
  "include_closed",
  "include_archived",
  "me",
]);

const ARRAY_KEYS = new Set([
  "status_ids",
  "status_groups",
  "priority",
  "assignee_ids",
  "tag_ids",
]);

const DEFAULTS: TaskSearchParams = {
  page: DEFAULT_TASK_PAGE,
  limit: DEFAULT_TASK_LIMIT,
  include_closed: true,
  include_archived: false,
  include_subtasks: false,
  sort_order: "desc",
};

export function parseTaskSearchParams(searchParams: URLSearchParams | ReadonlyURLSearchParams): TaskSearchParams {
  const result: TaskSearchParams = { ...DEFAULTS };
  const entries = Array.from(searchParams.entries());

  entries.forEach(([key, value]) => {
    if (!value) return;

    if (ARRAY_KEYS.has(key)) {
      const items = value.split(",").map((item) => item.trim()).filter(Boolean);
      if (items.length === 0) return;
      (result as Record<string, unknown>)[key] = items;
      return;
    }

    if (BOOLEAN_KEYS.has(key)) {
      (result as Record<string, unknown>)[key] = value === "true";
      return;
    }

    if (key === "page" || key === "limit") {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        (result as Record<string, unknown>)[key] = parsed;
      }
      return;
    }

    if (key === "q" || key === "sort_by" || key === "due_date" || key === "assignee_match" || key === "tag_match" || key === "sort_order") {
      (result as Record<string, unknown>)[key] = value;
    }
  });

  return result;
}

export function toTaskSearchPatch(params: TaskSearchParams) {
  const patch: Record<string, string | null> = {};

  const setValue = (key: keyof TaskSearchParams, value: unknown, defaultValue?: unknown) => {
    if (value === undefined || value === null || value === "" || value === defaultValue) {
      patch[key] = null;
      return;
    }

    if (Array.isArray(value)) {
      patch[key] = value.length > 0 ? value.join(",") : null;
      return;
    }

    if (typeof value === "boolean") {
      patch[key] = value === defaultValue ? null : String(value);
      return;
    }

    patch[key] = String(value);
  };

  setValue("q", params.q, "");
  setValue("page", params.page, DEFAULT_TASK_PAGE);
  setValue("limit", params.limit, DEFAULT_TASK_LIMIT);
  setValue("sort_by", params.sort_by, undefined);
  setValue("sort_order", params.sort_order, DEFAULTS.sort_order);
  setValue("status_ids", params.status_ids, []);
  setValue("status_groups", params.status_groups, []);
  setValue("priority", params.priority, []);
  setValue("assignee_ids", params.assignee_ids, []);
  setValue("assignee_match", params.assignee_match, undefined);
  setValue("tag_ids", params.tag_ids, []);
  setValue("tag_match", params.tag_match, undefined);
  setValue("due_date", params.due_date, undefined);
  setValue("include_subtasks", params.include_subtasks, DEFAULTS.include_subtasks);
  setValue("include_closed", params.include_closed, DEFAULTS.include_closed);
  setValue("include_archived", params.include_archived, DEFAULTS.include_archived);
  setValue("me", params.me, false);

  return patch;
}

export function clearTaskSearchPatch() {
  return {
    q: null,
    page: null,
    limit: null,
    sort_by: null,
    sort_order: null,
    status_ids: null,
    status_groups: null,
    priority: null,
    assignee_ids: null,
    assignee_match: null,
    tag_ids: null,
    tag_match: null,
    due_date: null,
    include_subtasks: null,
    include_closed: null,
    include_archived: null,
    me: null,
  } as Record<string, string | null>;
}

export function countActiveTaskSearchFilters(params: TaskSearchParams) {
  let total = 0;
  if (params.status_ids?.length) total += 1;
  if (params.status_groups?.length) total += 1;
  if (params.priority?.length) total += 1;
  if (params.assignee_ids?.length) total += 1;
  if (params.tag_ids?.length) total += 1;
  if (params.due_date) total += 1;
  if (params.include_subtasks) total += 1;
  if (params.include_closed === false) total += 1;
  if (params.include_archived) total += 1;
  if (params.me) total += 1;
  if (params.sort_by) total += 1;
  return total;
}

export function hasActiveTaskSearchFilters(params: TaskSearchParams) {
  return countActiveTaskSearchFilters(params) > 0;
}

export const TASK_STATUS_GROUP_OPTIONS: TaskStatusGroup[] = [
  "NOT_STARTED",
  "ACTIVE",
  "DONE",
  "CLOSED",
];

export const TASK_PRIORITY_OPTIONS: TaskPriority[] = [
  "URGENT",
  "HIGH",
  "NORMAL",
  "LOW",
  "NONE",
];

export const TASK_DUE_DATE_OPTIONS = [
  { value: "", label: "Any due date" },
  { value: "today_or_earlier", label: "Today or earlier" },
  { value: "today", label: "Today" },
  { value: "overdue", label: "Overdue" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this_week", label: "This week" },
];

export const TASK_SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Updated time" },
  { value: "due_date", label: "Due date" },
  { value: "created_at", label: "Created time" },
  { value: "updated_at", label: "Updated time" },
  { value: "priority", label: "Priority" },
];

export const TASK_SORT_ORDER_OPTIONS: TaskSortOrder[] = ["desc", "asc"];
