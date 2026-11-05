"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LuChevronDown, LuRefreshCcw } from "react-icons/lu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { taskService, TaskListItem, TaskPriority } from "@/services/task.service";
import { StatusItem } from "@/services/status.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useTaskStore } from "@/stores/task.store";
import { parseApiError } from "@/lib/api";
import { queryKeys } from "@/queries/keys";
import { toast } from "sonner";
import TaskRow from "@/components/projects/TaskRow";
import StatusIcon from "@/components/projects/StatusIcon";

const GROUP_ORDER: Record<string, number> = {
  NOT_STARTED: 0,
  ACTIVE: 1,
  DONE: 2,
  CLOSED: 3,
};

function deriveStatuses(tasks: TaskListItem[]): StatusItem[] {
  const seen = new Map<string, StatusItem>();
  for (const t of tasks) {
    if (!seen.has(t.status.id)) {
      seen.set(t.status.id, {
        id: t.status.id,
        projectId: t.list.project.id,
        name: t.status.name,
        color: t.status.color,
        group: t.status.group as StatusItem["group"],
        position: 0,
        isDefault: false,
        isProtected: false,
        isClosed: t.status.group === "CLOSED",
        createdAt: "",
        updatedAt: "",
      });
    }
  }
  return Array.from(seen.values()).sort((a, b) => {
    const gDiff = (GROUP_ORDER[a.group] ?? 99) - (GROUP_ORDER[b.group] ?? 99);
    if (gDiff !== 0) return gDiff;
    return a.name.localeCompare(b.name);
  });
}

function MyStatusGroup({
  status,
  listIds,
  allStatuses,
  members,
  onRefresh,
}: {
  status: StatusItem;
  listIds: string[];
  allStatuses: StatusItem[];
  members: WorkspaceMember[];
  onRefresh: () => void;
}) {
  const { tasksByList, updateTask, deleteTask, addAssignee, removeAssignee, openTaskDetail } = useTaskStore();
  const [collapsed, setCollapsed] = useState(false);

  // Read live from the store — same pattern as StatusGroup in TaskListView
  const tasks = useMemo(
    () =>
      listIds.flatMap((lid) =>
        (tasksByList[lid] ?? []).filter((t) => t.status.id === status.id && t.depth === 0)
      ),
    [tasksByList, listIds, status.id]
  );

  // Group tasks within this status by project
  const byProject = useMemo<{ projectId: string; projectName: string; tasks: TaskListItem[] }[]>(() => {
    const map = new Map<string, { projectId: string; projectName: string; tasks: TaskListItem[] }>();
    for (const t of tasks) {
      const pid = t.list.project.id;
      if (!map.has(pid)) {
        map.set(pid, { projectId: pid, projectName: t.list.project.name, tasks: [] });
      }
      map.get(pid)!.tasks.push(t);
    }
    return Array.from(map.values());
  }, [tasks]);

  const handleUpdateStatus = async (task: TaskListItem, statusId: string) => {
    try {
      await updateTask(task.id, task.list.id, { statusId });
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleUpdatePriority = async (task: TaskListItem, priority: TaskPriority) => {
    try {
      await updateTask(task.id, task.list.id, { priority });
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleUpdateDates = async (task: TaskListItem, startDate: string | null, dueDate: string | null) => {
    try {
      await updateTask(task.id, task.list.id, { startDate, dueDate });
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleAddAssignee = async (task: TaskListItem, userId: string) => {
    try {
      await addAssignee(task.id, task.list.id, [userId]);
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleRemoveAssignee = async (task: TaskListItem, userId: string) => {
    try {
      await removeAssignee(task.id, task.list.id, userId);
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const handleDelete = async (task: TaskListItem) => {
    try {
      await deleteTask(task.id, task.list.id);
      toast.success("Task deleted");
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  return (
    <div className="border-b border-gray-100 last:border-b-0 dark:border-gray-700">
      {/* Status group header */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-left"
        >
          <LuChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase text-white"
            style={{ backgroundColor: status.color }}
          >
            <StatusIcon group={status.group} color="#fff" size={11} />
            {status.name}
          </span>
          <span className="text-xs text-gray-400">{tasks.length}</span>
        </button>
      </div>

      {!collapsed && (
        <div>
          {tasks.length > 0 && (
            <div
              className="grid items-center gap-2 border-b border-gray-100 px-4 py-1.5 text-[11px] text-gray-400 dark:border-gray-800"
              style={{ gridTemplateColumns: "minmax(0,1fr) 110px 110px 80px 100px 32px" }}
            >
              <span className="pl-3">Name</span>
              <span>Assignee</span>
              <span>Due date</span>
              <span>Priority</span>
              <span>Status</span>
              <span />
            </div>
          )}

          {byProject.map((group) => (
            <div key={group.projectId}>
              {/* Project label divider */}
              <div className="flex items-center gap-2 px-4 py-1 mt-0.5">
                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                <span className="shrink-0 text-[11px] text-gray-400 font-normal">{group.projectName}</span>
                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
              </div>

              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  statuses={allStatuses}
                  members={members}
                  listId={task.list.id}
                  onView={() => openTaskDetail(task.id)}
                  onUpdateStatus={(statusId) => handleUpdateStatus(task, statusId)}
                  onUpdatePriority={(priority) => handleUpdatePriority(task, priority)}
                  onUpdateDates={(start, due) => handleUpdateDates(task, start, due)}
                  onAddAssignee={(userId) => handleAddAssignee(task, userId)}
                  onRemoveAssignee={(userId) => handleRemoveAssignee(task, userId)}
                  onDelete={() => handleDelete(task)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MY_TASKS_MAX_PAGES = 5;

async function fetchMyTasks(): Promise<{ items: TaskListItem[]; total: number }> {
  const limit = 100;
  const baseParams = {
    me: true,
    include_closed: true,
    include_archived: false,
    include_subtasks: false,
    limit,
  } as const;

  // Fetch page 1 to learn the page count, then request the rest in parallel
  // instead of awaiting each page serially.
  const first = await taskService.searchWorkspace({ ...baseParams, page: 1 });
  const items = [...first.items];
  const pageCount = Math.min(first.meta.total_pages || 1, MY_TASKS_MAX_PAGES);

  if (pageCount > 1) {
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, i) =>
        taskService.searchWorkspace({ ...baseParams, page: i + 2 })
      )
    );
    rest.forEach((result) => items.push(...result.items));
  }

  return { items, total: first.meta.total };
}

export default function MyTasksPage() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const { setTasksForLists } = useTaskStore();
  const { members } = useWorkspaceMembers();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.myTasks(activeWorkspaceId), [activeWorkspaceId]);

  const query = useQuery({
    queryKey,
    queryFn: fetchMyTasks,
    enabled: !!activeWorkspaceId,
    /* This list spans every project, so a project turning PRIVATE can strip
       tasks out of it from outside this page. Always refetch on mount rather
       than serving the 60s-stale cache, or the user sees rows that render but
       404 when opened. */
    refetchOnMount: "always",
  });

  const tasks = useMemo(() => query.data?.items ?? [], [query.data]);
  const totalCount = query.data?.total ?? 0;
  const loading = query.isLoading;

  useEffect(() => {
    if (query.error) toast.error(parseApiError(query.error).message);
  }, [query.error]);

  // Bridge: keep task.store.ts as the single read model TaskRow's mutation
  // callbacks consume, exactly like before, just fed by React Query now.
  useEffect(() => {
    if (!query.data) return;
    const byList: Record<string, TaskListItem[]> = {};
    query.data.items.forEach((t) => {
      (byList[t.list.id] ??= []).push(t);
    });
    setTasksForLists(byList);
  }, [query.data, setTasksForLists]);

  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  );

  const statuses = useMemo(() => deriveStatuses(tasks), [tasks]);

  const listIds = useMemo(() => [...new Set(tasks.map((t) => t.list.id))], [tasks]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800 shrink-0">
        <div>
          <h1 className="text-[14px] font-semibold text-gray-900 dark:text-white">My Tasks</h1>
          {!loading && tasks.length > 0 && (
            <p className="text-[12px] text-gray-400 mt-0.5">
              {tasks.length === totalCount
                ? `${totalCount} task${totalCount !== 1 ? "s" : ""} assigned to you`
                : `Showing ${tasks.length} of ${totalCount} tasks assigned to you`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          title="Refresh"
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
        >
          <LuRefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
            <StatusIcon group="DONE" color="#d1d5db" size={52} />
            <p className="text-[18px] font-bold text-brand-400">No tasks assigned to you</p>
            <p className="text-xs text-gray-400">Tasks assigned to you across all projects will appear here.</p>
          </div>
        ) : (
          <div className="pb-8">
            {statuses.map((status) => (
              <MyStatusGroup
                key={status.id}
                status={status}
                listIds={listIds}
                allStatuses={statuses}
                members={members}
                onRefresh={refetch}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
