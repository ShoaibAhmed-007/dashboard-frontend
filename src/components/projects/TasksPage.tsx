"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useModal } from "@/hooks/useModal";
import { useProjects } from "@/context/ProjectContext";
import { projectService } from "@/services/project.service";
import { useTaskLists } from "@/context/TaskListContext";
import { parseApiError, getApiErrorCode } from "@/lib/api";
import { useStatuses } from "@/hooks/useStatuses";
import { TaskList } from "@/services/task-list.service";
import { useWorkspaceTags } from "@/hooks/useWorkspaceTags";
import { taskService, TaskListItem } from "@/services/task.service";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { getTaskSearchCacheKey, useTaskSearchStore } from "@/stores/task-search.store";
import { useTaskStore } from "@/stores/task.store";
import { useInfiniteTaskSearch } from "@/hooks/useInfiniteTaskSearch";
import TaskListView, { TaskListSectionData } from "./TaskListView";
import TaskBoard from "./TaskBoard";
import TaskDashboardHome from "./TaskDashboardHome";
import TaskCalendarView from "./TaskCalendarView";
import MinimizedTaskBar from "./MinimizedTaskBar";
import ProjectTaskHeader from "./ProjectTaskHeader";
import ListTaskHeader from "./ListTaskHeader";
import ProjectAttachments from "./ProjectAttachments";
import ListAttachments from "./ListAttachments";
import TaskPagination from "./TaskPagination";

// Opened on demand only — never visible on first paint, so defer their bundle cost.
const TaskForm = dynamic(() => import("./TaskForm"), { ssr: false });
const TaskDetailModal = dynamic(() => import("./TaskDetailModal"), { ssr: false });
const CreateListModal = dynamic(() => import("./CreateListModal"), { ssr: false });
const RenameListModal = dynamic(() => import("./RenameListModal"), { ssr: false });
const ConfirmActionModal = dynamic(() => import("@/components/common/ConfirmActionModal"), { ssr: false });
const TaskFiltersModal = dynamic(() => import("./TaskFiltersModal"), { ssr: false });
import {
  clearTaskSearchPatch,
  countActiveTaskSearchFilters,
  hasActiveTaskSearchFilters,
  parseTaskSearchParams,
} from "./task-search-utils";
import { toast } from "sonner";
import type { ReactElement } from "react";
import { LuArchive, LuCalendarDays, LuLayoutDashboard, LuList, LuSquareKanban, LuStar, LuPaperclip, LuLock } from "react-icons/lu";
import { ICON_MAP } from "@/components/projects/IconColorPicker";

type ProjectView = "overview" | "list" | "board" | "calendar" | "attachments";

type PendingCreateDefaults = {
  listId?: string | null;
  statusId?: string | null;
};

const VIEW_TABS: Array<{
  id: ProjectView;
  label: string;
  icon: ReactElement;
  projectOnly?: boolean;
}> = [
  { id: "overview", label: "Overview", icon: <LuLayoutDashboard className="h-4 w-4 " />, projectOnly: true },
  { id: "list", label: "List", icon: <LuList className="h-4 w-4" /> },
  { id: "board", label: "Board", icon: <LuSquareKanban className="h-4 w-4 text-blue-500" /> },
  { id: "calendar", label: "Calendar", icon: <LuCalendarDays className="h-4 w-4 text-orange-400" /> },
  { id: "attachments", label: "Attachments", icon: <LuPaperclip className="h-4 w-4 text-red-400" /> },
];

export default function TasksPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects, isLoading: projectsLoading, patchLocalProject, refetch: refetchProjects } = useProjects();
  const { getLists, getProjectLists, isProjectLoading, renameList, archiveList, restoreList, deleteList } = useTaskLists();
  const {
    openTaskDetail,
    closeTaskDetail,
    minimizeTask,
    openTask,
    openTaskLoading,
    setTasksForLists,
    setHighlightTaskId,
  } = useTaskStore();
  const { searchProject, searchList } = useTaskSearchStore();
  const { tags } = useWorkspaceTags();
  const [pendingDefaults, setPendingDefaults] = useState<PendingCreateDefaults>({});
  const [createListOpen, setCreateListOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TaskList | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TaskList | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskList | null>(null);
  const [isMutatingList, setIsMutatingList] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);
  const formModal = useModal();

  const projectId = searchParams.get("projectId");
  // Scoped to the project: on a PRIVATE project only its members may be assigned.
  const { members, refetch: refetchMembers } = useProjectMembers(projectId);
  const listId = searchParams.get("listId");
  const taskIdParam = searchParams.get("taskId");
  const highlightTaskIdParam = searchParams.get("highlightTaskId");
  const requestedView = (searchParams.get("view") as ProjectView | null) ?? null;
  const project = projects.find((item) => item.id === projectId) ?? null;
  const taskSearchParams = useMemo(() => parseTaskSearchParams(searchParams), [searchParams]);

  useEffect(() => {
    return () => {
      closeTaskDetail();
    };
  }, [closeTaskDetail]);

  // Auto-open task when taskId is in the URL (e.g. from sidebar favorites)
  useEffect(() => {
    if (!taskIdParam) return;
    void openTaskDetail(taskIdParam);
    // Remove taskId from URL after opening so back-navigation works cleanly
    const next = new URLSearchParams(searchParams.toString());
    next.delete("taskId");
    router.replace(`?${next.toString()}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIdParam]);

  const currentView: ProjectView = useMemo(() => {
    if (listId) {
      if (requestedView && requestedView !== "overview") return requestedView;
      return "list";
    }
    return requestedView ?? "overview";
  }, [listId, requestedView]);

  const allLists = projectId ? getProjectLists(projectId, { includeArchived: true }) : [];
  const activeLists = allLists.filter((list) => !list.isArchived);
  const selectedList = allLists.find((list) => list.id === listId) ?? null;
  const visibleTabs = listId
    ? VIEW_TABS.filter((tab) => !tab.projectOnly)
    : VIEW_TABS;

  useEffect(() => {
    if (!projectId) return;
    // Always request the archived-inclusive set: `allLists` (and therefore
    // `selectedList`) reads the { includeArchived: true } cache regardless of
    // the current view, so fetching a narrower set here would leave the read
    // cache empty on a restored board/calendar URL.
    void getLists(projectId, { includeArchived: true }).catch((err) => {
      /* Usually harmless (an aborted or duplicate fetch), but a PROJECT_NOT_FOUND
         here means access was revoked while the project was open — a private
         project you were removed from. The project list is cached for five
         minutes, so without this the user would sit on a dead page watching
         every request fail. This is the first request fired for a project, so
         it is the earliest place to catch it. */
      if (getApiErrorCode(err) === "PROJECT_NOT_FOUND") {
        toast.error("You no longer have access to this project.");
        void refetchProjects();
        router.replace("/projects");
      }
    });
  }, [getLists, listId, projectId, refetchProjects, router]);

  const { statuses } = useStatuses(projectId);

  useEffect(() => {
    // Wait until lists have finished loading before treating a listId as stale;
    // otherwise a mid-hydration render would discard the persisted listId.
    if (isProjectLoading(projectId ?? "")) return;
    if (listId && !selectedList && activeLists.length > 0) {
      router.replace(`/projects?projectId=${projectId}`);
    }
  }, [activeLists.length, isProjectLoading, listId, projectId, router, selectedList]);

  const taskScope = useMemo(() => {
    if (!projectId) return null;
    if (selectedList) {
      return { type: "list" as const, projectId, listId: selectedList.id };
    }
    return { type: "project" as const, projectId };
  }, [projectId, selectedList]);

  // Mirrors TaskBoard's own isProjectBoard check — a project with exactly one
  // active list and no list selected still takes the single-list board path.
  const boardLists = selectedList ? [selectedList] : activeLists;
  const isProjectBoardView = boardLists.length > 1;
  const boardScope = currentView === "board" && !isProjectBoardView && boardLists.length === 1
    ? taskScope
    : null;
  const boardQuery = useInfiniteTaskSearch(boardScope, taskSearchParams);
  const lastBoardKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!boardScope || boardQuery.isLoading) return;
    const boardListId = boardLists[0].id;
    if (lastBoardKeyRef.current !== boardQuery.queryKeyString) {
      lastBoardKeyRef.current = boardQuery.queryKeyString;
      useTaskStore.getState().setTasksForLists({ [boardListId]: boardQuery.items });
      return;
    }
    const existing = useTaskStore.getState().tasksByList[boardListId] ?? [];
    const existingIds = new Set(existing.map((t) => t.id));
    const toAppend = boardQuery.items.filter((t) => !existingIds.has(t.id));
    if (toAppend.length > 0) {
      useTaskStore.getState().setTasksForLists({ [boardListId]: [...existing, ...toAppend] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardScope, boardQuery.items, boardQuery.isLoading, boardQuery.queryKeyString]);

  const pagedCacheKey = useMemo(() => (
    taskScope ? getTaskSearchCacheKey(taskScope, taskSearchParams, "page") : null
  ), [taskScope, taskSearchParams]);

  const fullCacheKey = useMemo(() => (
    taskScope ? getTaskSearchCacheKey(taskScope, taskSearchParams, "all") : null
  ), [taskScope, taskSearchParams]);

  const pagedCache = useTaskSearchStore((state) => (pagedCacheKey ? state.caches[pagedCacheKey] : undefined));
  const fullCache = useTaskSearchStore((state) => (fullCacheKey ? state.caches[fullCacheKey] : undefined));

  // Paginated cache only backs the List tab (TaskListView + TaskPagination).
  useEffect(() => {
    if (!taskScope || currentView !== "list") return;
    if (taskScope.type === "list") {
      void searchList(taskScope.projectId, taskScope.listId, taskSearchParams, "page");
      return;
    }
    void searchProject(taskScope.projectId, taskSearchParams, "page");
  }, [currentView, taskScope, taskSearchParams, searchList, searchProject]);

  // Full (all-pages) cache only backs Calendar — Board uses useInfiniteTaskSearch instead
  // (see boardQuery above) so it never eagerly downloads every page.
  useEffect(() => {
    if (!taskScope || currentView !== "calendar") return;
    if (taskScope.type === "list") {
      void searchList(taskScope.projectId, taskScope.listId, taskSearchParams, "all");
      return;
    }
    void searchProject(taskScope.projectId, taskSearchParams, "all");
  }, [currentView, taskScope, taskSearchParams, searchList, searchProject]);

  const activeSearchItems = useMemo<TaskListItem[]>(
    () => (currentView === "list" ? pagedCache?.items ?? [] : fullCache?.items ?? []),
    [currentView, fullCache?.items, pagedCache?.items]
  );

  const groupedTasksByList = useMemo<Record<string, TaskListItem[]>>(() => {
    const initial = Object.fromEntries(activeLists.map((list) => [list.id, [] as TaskListItem[]]));
    activeSearchItems.forEach((task) => {
      if (!initial[task.list.id]) return;
      initial[task.list.id].push(task);
    });
    return initial;
  }, [activeLists, activeSearchItems]);

  useEffect(() => {
    // Overview/Attachments don't fetch pagedCache/fullCache, so groupedTasksByList would
    // be empty placeholders here — only sync into the shared task store for views that
    // actually populate it (List/Calendar). Board is excluded: it's synced separately by
    // the boardQuery effect above, and groupedTasksByList (derived from the now Calendar-only
    // fullCache) would otherwise race with and wipe that data.
    if (!projectId || currentView === "overview" || currentView === "attachments" || currentView === "board") return;
    setTasksForLists(groupedTasksByList);
  }, [currentView, groupedTasksByList, projectId, setTasksForLists]);

  const listSections = useMemo<TaskListSectionData[]>(() => {
    return allLists.map((list) => ({
      list,
      tasks: groupedTasksByList[list.id] ?? [],
    }));
  }, [allLists, groupedTasksByList]);

  const updateQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    router.push(`${pathname}?${next.toString()}`);
  };

  /* Redirected here from elsewhere (currently: Minutes of Meeting's "view in
     project" button) with a task to point at, rather than a task to open —
     the modal stays closed; the row is scrolled to and flashed once found
     (see `TaskListView`'s own highlight effect, driven by the task store's
     `highlightTaskId`).
     `currentView` (above) reads only `listId`/`view`, and on first paint
     neither is set yet — so without this, the page renders Overview (or
     whatever it last was) for as long as the async lookup below takes, and
     the user watches the wrong screen before it jumps to List. This forces
     `view=list` the instant the param shows up, synchronously, before any
     network round trip. */
  useEffect(() => {
    if (!highlightTaskIdParam) return;
    if (requestedView === "list") return;
    updateQuery({ view: "list" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTaskIdParam, requestedView]);

  /* The list view is paginated, so the target row may not be on whichever
     page loads first: this walks pages of the project's own task search
     (same sort the visible list already uses) until the task turns up, then
     jumps the URL to that page. Searched project-wide (not scoped to the
     task's own list) deliberately: setting `listId` here would race the
     stale-listId cleanup effect above, which strips a `listId` back out the
     moment it doesn't yet recognise it as valid — as it always will,
     immediately after a redirect, before that project's lists have loaded.
     The project-wide list view already includes every list's tasks (see
     `listSections`'s fallback below), so there is nothing lost by leaving
     `listId` out of this redirect entirely. */
  const highlightSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!highlightTaskIdParam || !projectId) return;
    if (highlightSearchRef.current === highlightTaskIdParam) return;
    highlightSearchRef.current = highlightTaskIdParam;

    let cancelled = false;

    (async () => {
      try {
        /* Deliberately not `taskSearchParams` (the URL's current filters):
           if a search term, status/assignee filter, or non-default sort was
           left active from whatever the user was doing on this page before,
           it could exclude the target task from every page's results —
           the loop below would then run out of pages, find nothing, and
           silently give up. Since the whole point of this redirect is to
           show a specific task, any filter that would hide it works against
           the user's actual intent, so the search here ignores them. */
        const pageParams = { limit: 20, include_closed: true };

        let foundPage: number | null = null;
        let totalPages = 1;
        for (let page = 1; page <= totalPages; page += 1) {
          const result = await taskService.searchProject(projectId, {
            ...pageParams,
            page,
          });
          if (cancelled) return;
          totalPages = Math.max(1, result.meta.total_pages);
          if (result.items.some((item) => item.id === highlightTaskIdParam)) {
            foundPage = page;
            break;
          }
        }

        if (cancelled) return;

        const patch: Record<string, string | null> = {
          highlightTaskId: null,
          view: "list",
          /* Every filter/sort/search param is cleared alongside `page` —
             not just left alone — for the same reason: whatever was active
             before must not hide the row this redirect exists to show. */
          ...clearTaskSearchPatch(),
          /* Always set explicitly, never left as whatever the URL already
             had — a stale `page` param (e.g. left over from browsing before
             this redirect happened) would otherwise point the list at the
             wrong page even after the target's real page was found here,
             and the row would never appear for `TaskListView` to highlight. */
          page: foundPage && foundPage > 1 ? String(foundPage) : null,
        };
        updateQuery(patch);

        // The row can only be found/highlighted once its page has actually
        // rendered — that happens on a later pass through this component
        // (new cache key from the URL patch above), so this only arms the
        // store; TaskListView does the scrolling once the row exists.
        setHighlightTaskId(highlightTaskIdParam);
      } catch {
        // Task no longer exists, or fetch failed — nothing to highlight.
        updateQuery({ highlightTaskId: null });
      }
    })();

    return () => {
      cancelled = true;
      /* Reset the guard on cleanup, not just on success — otherwise React
         Strict Mode's dev-only mount→cleanup→remount cycle poisons this
         permanently: the ref is set (synchronously, above) on the first,
         throwaway mount, that effect's cleanup cancels the in-flight search
         before it resolves, and the second (real) mount then sees the ref
         already "consumed" and skips the search forever — highlightTaskId
         never gets set, the URL param never gets cleared, and the row never
         glows. Resetting here lets the second mount actually run the search. */
      highlightSearchRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTaskIdParam, projectId]);

  const filterCount = countActiveTaskSearchFilters(taskSearchParams);
  const hasActiveFilters = hasActiveTaskSearchFilters(taskSearchParams);
  const disableListReorder = hasActiveFilters || (pagedCache?.meta?.total_pages ?? 1) > 1;
  const disableBoardReorder = hasActiveFilters;

  const openCreate = (defaults?: PendingCreateDefaults) => {
    if (!projectId) return;
    if (!selectedList && activeLists.length === 0) {
      setCreateListOpen(true);
      return;
    }

    setPendingDefaults({
      listId: defaults?.listId ?? selectedList?.id ?? null,
      statusId: defaults?.statusId ?? null,
    });
    formModal.openModal();
  };

  const openTaskDetailById = async (taskId: string) => {
    await openTaskDetail(taskId);
  };

  const handleUnarchiveProject = async () => {
    if (!projectId) return;
    try {
      await projectService.restore(projectId);
      patchLocalProject(projectId, { isArchived: false });
      toast.success("Project restored");
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  };

  const handleRenameList = async (name: string) => {
    if (!renameTarget) return;
    setIsMutatingList(true);
    try {
      await renameList(renameTarget.projectId, renameTarget.id, { name });
      toast.success(`List "${name}" renamed`);
      setRenameTarget(null);
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setIsMutatingList(false);
    }
  };

  const handleArchiveList = async () => {
    if (!archiveTarget) return;
    setIsMutatingList(true);
    try {
      await archiveList(archiveTarget.projectId, archiveTarget.id);
      if (selectedList?.id === archiveTarget.id) {
        router.push(`/projects?projectId=${archiveTarget.projectId}`);
      }
      toast.success(`List "${archiveTarget.name}" archived`);
      setArchiveTarget(null);
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setIsMutatingList(false);
    }
  };

  const handleRestoreList = async (list: TaskList) => {
    try {
      await restoreList(list.projectId, list.id);
      toast.success(`List "${list.name}" restored`);
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  };

  const handleDeleteList = async () => {
    if (!deleteTarget) return;
    setIsMutatingList(true);
    try {
      await deleteList(deleteTarget.projectId, deleteTarget.id);
      if (selectedList?.id === deleteTarget.id) {
        router.push(`/projects?projectId=${deleteTarget.projectId}`);
      }
      toast.success(`List "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setIsMutatingList(false);
    }
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-normal text-gray-900 dark:text-white">Select a Project</h2>
          <p className="mt-2 text-sm text-gray-400">
            Choose a project from the sidebar to open its lists and boards.
          </p>
        </div>
      </div>
    );
  }

  if (projectsLoading && !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-normal text-gray-900 dark:text-white">Project not found</h2>
          <p className="mt-2 text-sm text-gray-400">
            The selected space is unavailable in this workspace.
          </p>
        </div>
      </div>
    );
  }


  const projectInitial = (project.name ?? "").charAt(0).toUpperCase();
  const heading = selectedList ? selectedList.name : (project.name ?? "");
  const scopeHeader = selectedList ? (
    <ListTaskHeader
      listName={selectedList.name}
      searchValue={taskSearchParams.q ?? ""}
      filterCount={filterCount}
      onSearchChange={(value) => updateQuery({ q: value || null, page: null })}
      onOpenFilters={(rect) => { setFilterAnchor(rect); setFiltersOpen(true); }}
      onAddTask={() => openCreate({ listId: selectedList.id })}
    />
  ) : (
    <ProjectTaskHeader
      searchValue={taskSearchParams.q ?? ""}
      filterCount={filterCount}
      onSearchChange={(value) => updateQuery({ q: value || null, page: null })}
      onOpenFilters={(rect) => { setFilterAnchor(rect); setFiltersOpen(true); }}
      onAddTask={() => openCreate({ listId: null })}
    />
  );

  const isLoadingTasks = taskScope
    ? currentView === "list"
      ? !pagedCache || pagedCache.loading
      : currentView === "calendar"
        ? !fullCache || fullCache.loading
        : false
    : false;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 -mx-5 -mt-3 px-5 lg:-mx-6 lg:px-6">
        <div className="mb-1 flex items-center gap-2 py-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: project.color }}
          >
            {project.icon && ICON_MAP.has(project.icon)
              ? (() => { const I = ICON_MAP.get(project.icon!)!; return <I className="h-4 w-4" />; })()
              : <span className="text-[11px] font-semibold">{projectInitial}</span>
            }
          </span>
          <div className="flex items-center gap-2">
            {selectedList ? (
              <>
                <h1 className="text-lg font-normal text-gray-800 dark:text-white">{project.name}</h1>
                <span className="text-gray-300">/</span>
              </>
            ) : null}
            <h1 className="text-lg font-normal text-gray-800 dark:text-white">{heading}</h1>
          </div>
          <button
            type="button"
            className="text-gray-300 transition-colors hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300"
            aria-label="Favorite project"
          >
            <LuStar className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-0.5">
          {/* <button
            type="button"
            className="pb-2 text-sm text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            Add Channel
          </button> */}
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => updateQuery({ view: tab.id })}
              className={`border-b-2 pb-2 text-[12px] font-normal transition-colors group ${
                currentView === tab.id
                  ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                  : "border-transparent text-gray-500 dark:text-gray-400"
              }`}
            >
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                currentView === tab.id
                  ? ""
                  : "group-hover:bg-gray-100 dark:group-hover:bg-gray-800 group-hover:text-gray-700 dark:group-hover:text-gray-200"
              }`}>
                {tab.icon}
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {project?.isArchived && (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <LuArchive className="h-4 w-4 shrink-0" />
          <span className="flex-1">This Project is archived.</span>
          <button
            type="button"
            onClick={() => void handleUnarchiveProject()}
            className="font-medium underline hover:no-underline"
          >
            Unarchive
          </button>
        </div>
      )}


      {currentView !== "overview" && scopeHeader}

      <div className="min-h-0 flex-1 bg-gray-910 dark:bg-transparent overflow-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-901 pr-2">
        {isLoadingTasks ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4  border-brand-500 border-t-transparent" />
          </div>
        ) : null}

        {currentView === "overview" ? (
          <TaskDashboardHome
            projectId={project.id}
            projectName={project.name}
            members={members}
            onCreateList={() => setCreateListOpen(true)}
          />
        ) : null}

        {!isLoadingTasks && currentView === "list" ? (
          <>
            <TaskListView
              mode={selectedList ? "list" : "project"}
              projectName={project.name}
              projectId={project.id}
              sections={selectedList ? [{ list: selectedList, tasks: groupedTasksByList[selectedList.id] ?? [] }] : listSections}
              statuses={statuses}
              onAdd={openCreate}
              onCreateList={() => setCreateListOpen(true)}
              onRenameList={setRenameTarget}
              onArchiveList={setArchiveTarget}
              onRestoreList={handleRestoreList}
              onDeleteList={setDeleteTarget}
              onOpenTaskDetail={(taskId) => void openTaskDetailById(taskId)}
              disableAutoFetch
              disableSameStatusReorder={disableListReorder}
            />
            <TaskPagination
              meta={pagedCache?.meta ?? null}
              onPageChange={(page) => updateQuery({ page: String(page) })}
            />
          </>
        ) : null}

        {!isLoadingTasks && currentView === "board" ? (
          <TaskBoard
            projectId={project.id}
            lists={boardLists}
            statuses={statuses}
            members={members}
            onOpenTaskDetail={(taskId) => void openTaskDetailById(taskId)}
            onRefetchMembers={refetchMembers}
            disableAutoFetch
            disableSameStatusReorder={disableBoardReorder || (boardQuery.hasNextPage ?? false)}
            taskSearchParams={taskSearchParams}
            fetchNextPage={boardQuery.fetchNextPage}
            hasNextPage={boardQuery.hasNextPage}
            isFetchingNextPage={boardQuery.isFetchingNextPage}
            boardInitialLoading={boardQuery.isLoading}
          />
        ) : null}

        {!isLoadingTasks && currentView === "calendar" ? (
          <TaskCalendarView
            tasks={fullCache?.items ?? []}
            onView={(taskId) => void openTaskDetailById(taskId)}
          />
        ) : null}

        {currentView === "attachments" ? (
          <div className="px-1 py-2 h-full">
            {selectedList ? (
              <ListAttachments listId={selectedList.id} />
            ) : (
              <ProjectAttachments projectId={project.id} />
            )}
          </div>
        ) : null}
      </div>

      <TaskForm
        key={`${project.id}-${pendingDefaults.listId ?? "none"}-${pendingDefaults.statusId ?? "none"}-${formModal.isOpen ? "open" : "closed"}`}
        isOpen={formModal.isOpen}
        onClose={formModal.closeModal}
        projectId={project.id}
        availableLists={activeLists}
        statuses={statuses}
        defaultListId={pendingDefaults.listId ?? selectedList?.id ?? null}
        defaultStatusId={pendingDefaults.statusId ?? null}
      />

      {openTask && !openTaskLoading && (
        <TaskDetailModal
          key={openTask.id}
          task={openTask}
          statuses={statuses}
          listId={openTask.list.id}
          onClose={closeTaskDetail}
          onMinimize={minimizeTask}
        />
      )}

      <CreateListModal
        isOpen={createListOpen}
        onClose={() => setCreateListOpen(false)}
        initialProjectId={project.id}
      />

      <RenameListModal
        key={renameTarget?.id ?? "rename-list"}
        isOpen={Boolean(renameTarget)}
        initialName={renameTarget?.name ?? ""}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRenameList}
        isLoading={isMutatingList}
      />

      <ConfirmActionModal
        isOpen={Boolean(archiveTarget)}
        title="Archive List"
        description={`Archive "${archiveTarget?.name ?? "this list"}"? It will disappear from the default list view.`}
        confirmLabel="Archive List"
        onClose={() => {
          if (!isMutatingList) setArchiveTarget(null);
        }}
        onConfirm={handleArchiveList}
        isLoading={isMutatingList}
      />

      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        title="Delete List"
        description={`Delete "${deleteTarget?.name ?? "this list"}" and all of its tasks? This action cannot be undone.`}
        confirmLabel="Delete List"
        onClose={() => {
          if (!isMutatingList) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteList}
        isLoading={isMutatingList}
      />

      <TaskFiltersModal
        key={`project-filters-${project.id}-${selectedList?.id ?? "project"}-${searchParams.toString()}`}
        isOpen={filtersOpen}
        anchorRect={filterAnchor}
        onClose={() => setFiltersOpen(false)}
        value={taskSearchParams}
        statuses={statuses}
        members={members}
        tags={tags}
        onApply={(patch) => updateQuery(patch)}
        onClear={() => {
          updateQuery(clearTaskSearchPatch());
          setFiltersOpen(false);
        }}
      />

      <MinimizedTaskBar />
    </div>
  );
}
