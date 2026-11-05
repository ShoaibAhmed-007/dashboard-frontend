import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del, createStore, type UseStore } from "idb-keyval";

// Bump this when the persisted query shapes change in a way that makes old
// cached data unsafe to restore. It is passed to React Query as the persist
// `buster`, so a change discards any previously persisted cache on load.
// v3: project visibility replaced password locking. Cached project lists from
// before the change carry the old shape (`locked`/`passwordUpdatedAt`, no
// `visibility`) and — worse — reflect the *old* access rules, so a user who
// couldn't see a project when it was private kept seeing it missing for up to
// 24h after it went public.
export const QUERY_CACHE_BUSTER = "v3";

// Single IDB entry holding the dehydrated React Query cache.
const CACHE_ENTRY_KEY = "dashboard-query-cache";

let idbStore: UseStore | undefined;
function getStore(): UseStore | undefined {
  // idb-keyval touches `indexedDB`, which doesn't exist during SSR.
  if (typeof indexedDB === "undefined") return undefined;
  if (!idbStore) idbStore = createStore("dashboard-query", "cache");
  return idbStore;
}

/**
 * IndexedDB-backed persister for the React Query cache. Preferred over
 * localStorage because the full task/list/board dataset can exceed the ~5 MB
 * synchronous-storage cap.
 */
export function createIDBPersister() {
  return createAsyncStoragePersister({
    key: CACHE_ENTRY_KEY,
    throttleTime: 1000,
    storage: {
      getItem: async (key) => {
        const store = getStore();
        if (!store) return null;
        return (await get<string>(key, store)) ?? null;
      },
      setItem: async (key, value) => {
        const store = getStore();
        if (!store) return;
        await set(key, value, store);
      },
      removeItem: async (key) => {
        const store = getStore();
        if (!store) return;
        await del(key, store);
      },
    },
  });
}

/**
 * Drop the persisted cache from IndexedDB. Call on logout / workspace switch so
 * a different user or workspace can't read another's persisted task data on the
 * next load.
 */
export async function clearPersistedQueryCache(): Promise<void> {
  const store = getStore();
  if (!store) return;
  try {
    await del(CACHE_ENTRY_KEY, store);
  } catch {
    // Best-effort — a failure here must never block logout/switch.
  }
}
