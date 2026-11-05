import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Workspace {
  id: string;
  name: string;
  logoUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;

  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  setActiveWorkspaceId: (id: string) => void;
  clearWorkspaces: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaces: [],
      activeWorkspaceId: null,

      setWorkspaces: (workspaces) =>
        set((s) => ({
          workspaces,
          // Keep active workspace if it still exists, otherwise pick the first one
          activeWorkspaceId:
            workspaces.find((w) => w.id === s.activeWorkspaceId)?.id ??
            workspaces[0]?.id ??
            null,
        })),

      addWorkspace: (workspace) =>
        set((s) => ({
          workspaces: [...s.workspaces, workspace],
          // Auto-select the first created workspace if none is active
          activeWorkspaceId: s.activeWorkspaceId ?? workspace.id,
        })),

      updateWorkspace: (id, patch) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === id ? { ...w, ...patch } : w
          ),
        })),

      removeWorkspace: (id) =>
        set((s) => {
          const remaining = s.workspaces.filter((w) => w.id !== id);
          return {
            workspaces: remaining,
            activeWorkspaceId:
              s.activeWorkspaceId === id
                ? (remaining[0]?.id ?? null)
                : s.activeWorkspaceId,
          };
        }),

      setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),

      clearWorkspaces: () => set({ workspaces: [], activeWorkspaceId: null }),
    }),
    {
      name: "workspace-storage",
      partialize: (s) => ({ activeWorkspaceId: s.activeWorkspaceId }),
    }
  )
);

// Helpers for use outside React (e.g. axios interceptor)
export const getActiveWorkspaceId = () =>
  useWorkspaceStore.getState().activeWorkspaceId;
