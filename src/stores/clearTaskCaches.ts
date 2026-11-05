import { useTaskSearchStore } from "./task-search.store";
import { useTaskStore } from "./task.store";

/**
 * Wipe the persisted task caches (both the task-search and task Zustand stores),
 * in memory and in IndexedDB. Call on logout (so the next user on this browser
 * can't restore another user's tasks) and on a real workspace switch (so stale
 * cross-workspace task data isn't restored after a reload).
 */
export function clearPersistedTaskCaches(): void {
  try {
    useTaskSearchStore.getState().clearCache();
    void useTaskSearchStore.persist.clearStorage();
  } catch {
    // Best-effort — never block logout/switch.
  }
  try {
    useTaskStore.setState({ tasksByList: {}, subtasksByParent: {} });
    void useTaskStore.persist.clearStorage();
  } catch {
    // Best-effort — never block logout/switch.
  }
}
