"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  taskService,
  TaskListItem,
  TaskSearchMeta,
  TaskSearchParams,
  TaskSearchResult,
} from "@/services/task.service";
import { parseApiError } from "@/lib/api";
import { idbStateStorage } from "@/lib/idbStorage";

export type TaskSearchScope =
  | { type: "workspace" }
  | { type: "project"; projectId: string }
  | { type: "list"; projectId: string; listId: string };

export type TaskSearchMode = "page" | "all";

export interface TaskSearchCacheEntry {
  key: string;
  scope: TaskSearchScope;
  mode: TaskSearchMode;
  params: TaskSearchParams;
  items: TaskListItem[];
  meta: TaskSearchMeta | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

interface TaskSearchState {
  caches: Record<string, TaskSearchCacheEntry>;
  searchWorkspace: (params?: TaskSearchParams, mode?: TaskSearchMode) => Promise<TaskSearchResult>;
  searchProject: (projectId: string, params?: TaskSearchParams, mode?: TaskSearchMode) => Promise<TaskSearchResult>;
  searchList: (projectId: string, listId: string, params?: TaskSearchParams, mode?: TaskSearchMode) => Promise<TaskSearchResult>;
  refreshMatchingCaches: (context: { projectId?: string; listId?: string }) => Promise<void>;
  applyLocalUpdate: (taskId: string, patch: Partial<TaskListItem>) => void;
  applyLocalReorder: (context: { projectId: string; listId: string; orderedIds: string[] }) => void;
  clearCache: (matcher?: (entry: TaskSearchCacheEntry) => boolean) => void;
}

function normalizeParams(params?: TaskSearchParams): TaskSearchParams {
  if (!params) return {};
  const normalized: TaskSearchParams = {};

  Object.entries(params).forEach(([rawKey, rawValue]) => {
    const key = rawKey as keyof TaskSearchParams;
    if (rawValue === undefined || rawValue === null || rawValue === "") return;
    if (Array.isArray(rawValue)) {
      if (rawValue.length === 0) return;
      normalized[key] = [...rawValue].sort() as never;
      return;
    }
    normalized[key] = rawValue as never;
  });

  return normalized;
}

function getTaskSearchCacheKey(scope: TaskSearchScope, params?: TaskSearchParams, mode: TaskSearchMode = "page") {
  return JSON.stringify({
    scope,
    mode,
    params: normalizeParams(params),
  });
}

async function loadAllPages(
  loader: (params: TaskSearchParams) => Promise<TaskSearchResult>,
  params?: TaskSearchParams
) {
  const baseParams = { ...params, page: 1 };
  const first = await loader(baseParams);
  if (first.meta.total_pages <= 1) return first;

  const items = [...first.items];
  for (let page = 2; page <= first.meta.total_pages; page += 1) {
    const next = await loader({ ...baseParams, page });
    items.push(...next.items);
  }

  return {
    items,
    meta: {
      ...first.meta,
      page: 1,
      limit: items.length || first.meta.limit,
      has_next: false,
      has_prev: false,
    },
  };
}

function matchesScope(scope: TaskSearchScope, context: { projectId?: string; listId?: string }) {
  if (scope.type === "workspace") return true;
  if (context.listId) {
    if (scope.type === "list") return scope.listId === context.listId;
    return scope.type === "project" && scope.projectId === context.projectId;
  }
  if (context.projectId) {
    return scope.projectId === context.projectId;
  }
  return true;
}

export const useTaskSearchStore = create<TaskSearchState>()(
  persist(
    (set, get) => {
  const runSearch = async (
    scope: TaskSearchScope,
    params?: TaskSearchParams,
    mode: TaskSearchMode = "page"
  ) => {
    const normalizedParams = normalizeParams(params);
    const key = getTaskSearchCacheKey(scope, normalizedParams, mode);

    set((state) => ({
      caches: {
        ...state.caches,
        [key]: {
          key,
          scope,
          mode,
          params: normalizedParams,
          items: state.caches[key]?.items ?? [],
          meta: state.caches[key]?.meta ?? null,
          loading: true,
          loaded: state.caches[key]?.loaded ?? false,
          error: null,
        },
      },
    }));

    try {
      let result: TaskSearchResult;
      if (scope.type === "workspace") {
        result = mode === "all"
          ? await loadAllPages((nextParams) => taskService.searchWorkspace(nextParams), normalizedParams)
          : await taskService.searchWorkspace(normalizedParams);
      } else if (scope.type === "project") {
        result = mode === "all"
          ? await loadAllPages((nextParams) => taskService.searchProject(scope.projectId, nextParams), normalizedParams)
          : await taskService.searchProject(scope.projectId, normalizedParams);
      } else {
        result = mode === "all"
          ? await loadAllPages((nextParams) => taskService.searchList(scope.projectId, scope.listId, nextParams), normalizedParams)
          : await taskService.searchList(scope.projectId, scope.listId, normalizedParams);
      }

      set((state) => ({
        caches: {
          ...state.caches,
          [key]: {
            key,
            scope,
            mode,
            params: normalizedParams,
            items: result.items,
            meta: result.meta,
            loading: false,
            loaded: true,
            error: null,
          },
        },
      }));

      return result;
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message = parseApiError(error).message;

      if (status === 404 || status === 403) {
        // Resource gone or access denied (e.g. locked project) — evict cache
        // and return empty so callers don't receive an unhandled rejection.
        set((state) => {
          const next = { ...state.caches };
          delete next[key];
          return { caches: next };
        });
        return { items: [], meta: { page: 1, limit: 0, total: 0, total_pages: 0, has_next: false, has_prev: false } };
      }
      set((state) => ({
        caches: {
          ...state.caches,
          [key]: {
            key,
            scope,
            mode,
            params: normalizedParams,
            items: state.caches[key]?.items ?? [],
            meta: state.caches[key]?.meta ?? null,
            loading: false,
            loaded: false,
            error: message,
          },
        },
      }));
      throw error;
    }
  };

  return {
    caches: {},

    searchWorkspace: (params, mode = "page") => runSearch({ type: "workspace" }, params, mode),

    searchProject: (projectId, params, mode = "page") =>
      runSearch({ type: "project", projectId }, params, mode),

    searchList: (projectId, listId, params, mode = "page") =>
      runSearch({ type: "list", projectId, listId }, params, mode),

    refreshMatchingCaches: async (context) => {
      const entries = Object.values(get().caches).filter((entry) => matchesScope(entry.scope, context));
      for (const entry of entries) {
        try {
          await runSearch(entry.scope, entry.params, entry.mode);
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 404) {
            // Resource no longer exists — drop the stale cache entry
            set((state) => {
              const next = { ...state.caches };
              delete next[entry.key];
              return { caches: next };
            });
          }
          // Other errors (5xx, network) are already stored in the cache entry by runSearch
        }
      }
    },

    applyLocalUpdate: (taskId, patch) => {
      set((state) => {
        const nextCaches: Record<string, TaskSearchCacheEntry> = {};
        let changed = false;
        for (const [key, entry] of Object.entries(state.caches)) {
          const idx = entry.items.findIndex((t) => t.id === taskId);
          if (idx === -1) { nextCaches[key] = entry; continue; }
          const nextItems = entry.items.slice();
          nextItems[idx] = { ...nextItems[idx], ...patch };
          nextCaches[key] = { ...entry, items: nextItems };
          changed = true;
        }
        return changed ? { caches: nextCaches } : state;
      });
    },

    applyLocalReorder: ({ projectId, listId, orderedIds }) => {
      const order = new Map(orderedIds.map((id, i) => [id, i]));
      set((state) => {
        const nextCaches: Record<string, TaskSearchCacheEntry> = {};
        let changed = false;
        for (const [key, entry] of Object.entries(state.caches)) {
          if (!matchesScope(entry.scope, { projectId, listId })) {
            nextCaches[key] = entry;
            continue;
          }
          const relevant = entry.items.filter((t) => order.has(t.id));
          if (relevant.length === 0) {
            nextCaches[key] = entry;
            continue;
          }
          const sortedRelevant = [...relevant].sort(
            (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
          );
          let j = 0;
          const nextItems = entry.items.map((t) => (order.has(t.id) ? sortedRelevant[j++] : t));
          nextCaches[key] = { ...entry, items: nextItems };
          changed = true;
        }
        return changed ? { caches: nextCaches } : state;
      });
    },

    clearCache: (matcher) => {
      if (!matcher) {
        set({ caches: {} });
        return;
      }

      set((state) => ({
        caches: Object.fromEntries(
          Object.entries(state.caches).filter(([, entry]) => !matcher(entry))
        ),
      }));
    },
  };
    },
    {
      name: "task-search-cache",
      version: 1,
      storage: createJSONStorage(() => idbStateStorage),
      // Only the resolved cache map is worth persisting.
      partialize: (state) => ({ caches: state.caches }),
      // Restored entries must not carry a stale `loading`/`error` state, or a
      // cache persisted mid-fetch would show a spinner forever after reload.
      merge: (persisted, current) => {
        const restored = (persisted as { caches?: Record<string, TaskSearchCacheEntry> } | undefined)?.caches ?? {};
        const caches: Record<string, TaskSearchCacheEntry> = {};
        for (const [key, entry] of Object.entries(restored)) {
          caches[key] = { ...entry, loading: false, error: null };
        }
        return { ...current, caches };
      },
    }
  )
);

export { getTaskSearchCacheKey, normalizeParams };
