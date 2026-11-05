"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Workspace, useWorkspaceStore } from "@/stores/workspace.store";
import { workspaceService, WorkspaceUse, WorkspaceManagementType } from "@/services/workspace.service";
import { useAuth } from "@/context/AuthContext";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  switchWorkspace: (id: string) => void;
  createWorkspace: (name: string, workspaceUse: WorkspaceUse, managementType: WorkspaceManagementType, logoUrl?: string) => Promise<Workspace>;
  updateWorkspace: (
    id: string,
    payload: { name?: string; logoUrl?: string | null }
  ) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    workspaces,
    activeWorkspaceId,
    setWorkspaces,
    addWorkspace,
    updateWorkspace: patchStore,
    removeWorkspace,
    setActiveWorkspaceId,
    clearWorkspaces,
  } = useWorkspaceStore();

  const [isLoading, setIsLoading] = useState(false);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await workspaceService.list();
      setWorkspaces(data);
    } catch {
      // Silently fail — user may have no workspaces yet
    } finally {
      setIsLoading(false);
    }
  }, [setWorkspaces]);

  // Fetch workspaces once auth is ready
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      clearWorkspaces();
      return;
    }
    fetchWorkspaces();
  }, [isAuthenticated, authLoading, fetchWorkspaces, clearWorkspaces]);

  const switchWorkspace = useCallback(
    (id: string) => {
      setActiveWorkspaceId(id);
    },
    [setActiveWorkspaceId]
  );

  const createWorkspace = useCallback(
    async (name: string, workspaceUse: WorkspaceUse, managementType: WorkspaceManagementType, logoUrl?: string) => {
      const workspace = await workspaceService.create(
        logoUrl ? { name, workspaceUse, managementType, logoUrl } : { name, workspaceUse, managementType }
      );
      addWorkspace(workspace);
      setActiveWorkspaceId(workspace.id);
      return workspace;
    },
    [addWorkspace, setActiveWorkspaceId]
  );

  const updateWorkspace = useCallback(
    async (id: string, payload: { name?: string; logoUrl?: string | null }) => {
      const updated = await workspaceService.update(id, payload);
      patchStore(id, updated);
    },
    [patchStore]
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      await workspaceService.delete(id);
      removeWorkspace(id);
    },
    [removeWorkspace]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        switchWorkspace,
        createWorkspace,
        updateWorkspace,
        deleteWorkspace,
        refetch: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used within <WorkspaceProvider>");
  return ctx;
}
