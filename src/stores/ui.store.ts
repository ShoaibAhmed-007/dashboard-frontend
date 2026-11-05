import { create } from "zustand";

interface UiState {
  profilePanelOpen: boolean;
  openProfilePanel: () => void;
  closeProfilePanel: () => void;
  toggleProfilePanel: () => void;

  // View another user's profile
  viewingUserId: string | null;
  openUserPanel: (userId: string) => void;
  closeUserPanel: () => void;

  // Active DM thread (for sidebar highlight)
  activeDmUserId: string | null;
  openDmThread: (userId: string) => void;
  closeDmThread: () => void;

  // Triggers sidebar favorites section to re-fetch
  favoritesRefreshKey: number;
  invalidateFavorites: () => void;

  // Tracks task favorite state changes made outside TaskDetailModal (e.g. sidebar inline unfavorite)
  taskFavoriteOverrides: Record<string, boolean>;
  setTaskFavoriteOverride: (taskId: string, isFavorite: boolean) => void;
  clearTaskFavoriteOverride: (taskId: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  profilePanelOpen: false,
  openProfilePanel: () => set({ profilePanelOpen: true }),
  closeProfilePanel: () => set({ profilePanelOpen: false }),
  toggleProfilePanel: () => set((s) => ({ profilePanelOpen: !s.profilePanelOpen })),

  viewingUserId: null,
  openUserPanel: (userId: string) => set({ viewingUserId: userId, profilePanelOpen: false }),
  closeUserPanel: () => set({ viewingUserId: null }),

  activeDmUserId: null,
  openDmThread: (userId: string) => set({ activeDmUserId: userId }),
  closeDmThread: () => set({ activeDmUserId: null }),

  favoritesRefreshKey: 0,
  invalidateFavorites: () => set((s) => ({ favoritesRefreshKey: s.favoritesRefreshKey + 1 })),

  taskFavoriteOverrides: {},
  setTaskFavoriteOverride: (taskId, isFavorite) =>
    set((s) => ({ taskFavoriteOverrides: { ...s.taskFavoriteOverrides, [taskId]: isFavorite } })),
  clearTaskFavoriteOverride: (taskId) =>
    set((s) => {
      const next = { ...s.taskFavoriteOverrides };
      delete next[taskId];
      return { taskFavoriteOverrides: next };
    }),
}));
