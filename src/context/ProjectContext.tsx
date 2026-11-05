"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Project,
  CreateProjectPayload,
  UpdateProjectPayload,
  projectService,
} from "@/services/project.service";
import { useWorkspace } from "@/context/WorkspaceContext";
import { queryKeys } from "@/queries/keys";

interface ProjectContextValue {
  projects: Project[];
  isLoading: boolean;
  createProject: (payload: CreateProjectPayload) => Promise<Project>;
  updateProject: (id: string, payload: UpdateProjectPayload) => Promise<void>;
  patchLocalProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
  fetchArchivedProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = activeWorkspace?.id ?? null;
  // Memoized so it's referentially stable across renders — queryKeys.projects()
  // returns a fresh array literal every call, which would otherwise cascade
  // into a new callback identity every render for anything depending on it.
  const queryKey = useMemo(() => queryKeys.projects(workspaceId), [workspaceId]);

  const query = useQuery({
    queryKey,
    queryFn: () => projectService.list(),
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });
  const projects = useMemo(() => query.data ?? [], [query.data]);

  const setProjects = useCallback(
    (updater: (prev: Project[]) => Project[]) => {
      queryClient.setQueryData<Project[]>(queryKey, (prev) => updater(prev ?? []));
    },
    [queryClient, queryKey]
  );

  const fetchProjects = useCallback(async () => {
    if (!workspaceId) return;
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey, workspaceId]);

  const createProject = useCallback(
    async (payload: CreateProjectPayload) => {
      const project = await projectService.create(payload);
      setProjects((prev) => [...prev, project]);
      return project;
    },
    [setProjects]
  );

  const updateProject = useCallback(
    async (id: string, payload: UpdateProjectPayload) => {
      const updated = await projectService.update(id, payload);
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    },
    [setProjects]
  );

  const patchLocalProject = useCallback(
    (id: string, patch: Partial<Project>) => {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    [setProjects]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await projectService.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    },
    [setProjects]
  );

  const fetchArchivedProjects = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const archived = await projectService.listArchived();
      setProjects((prev) => {
        const activeIds = new Set(prev.filter((p) => !p.isArchived).map((p) => p.id));
        const merged = [...prev.filter((p) => !p.isArchived)];
        for (const p of archived) {
          if (!activeIds.has(p.id)) merged.push(p);
        }
        return merged;
      });
    } catch {
      // silently fail — archived projects are optional display
    }
  }, [workspaceId, setProjects]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      isLoading: query.isLoading,
      createProject,
      updateProject,
      patchLocalProject,
      deleteProject,
      refetch: fetchProjects,
      fetchArchivedProjects,
    }),
    [
      projects,
      query.isLoading,
      createProject,
      updateProject,
      patchLocalProject,
      deleteProject,
      fetchProjects,
      fetchArchivedProjects,
    ]
  );

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx)
    throw new Error("useProjects must be used within <ProjectProvider>");
  return ctx;
}

// Safe defaults for consumers that may render outside a <ProjectProvider> —
// e.g. AppSidebar, which is shared by the admin layout (has the provider) and
// the university layout (intentionally does NOT, to avoid fetching /projects
// there). In that case the project-related UI simply renders empty instead of
// throwing a client-side exception that white-screens the whole page.
const EMPTY_PROJECTS: Project[] = [];
const NOOP_PROJECT_CONTEXT: ProjectContextValue = {
  projects: EMPTY_PROJECTS,
  isLoading: false,
  createProject: async () => {
    throw new Error("createProject is unavailable outside <ProjectProvider>");
  },
  updateProject: async () => {},
  patchLocalProject: () => {},
  deleteProject: async () => {},
  refetch: async () => {},
  fetchArchivedProjects: async () => {},
};

/**
 * Like useProjects(), but returns inert defaults instead of throwing when there
 * is no <ProjectProvider> above in the tree. Use this in components that render
 * in both provider-wrapped and provider-less layouts.
 */
export function useOptionalProjects(): ProjectContextValue {
  return useContext(ProjectContext) ?? NOOP_PROJECT_CONTEXT;
}
