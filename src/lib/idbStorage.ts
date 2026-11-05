import { get, set, del, createStore, type UseStore } from "idb-keyval";
import { type StateStorage } from "zustand/middleware";

// IndexedDB-backed storage for Zustand `persist`. Used instead of localStorage
// because persisted task caches can be large (all task items across scopes).
let store: UseStore | undefined;
function getStore(): UseStore | undefined {
  if (typeof indexedDB === "undefined") return undefined; // SSR guard
  if (!store) store = createStore("dashboard-zustand", "state");
  return store;
}

export const idbStateStorage: StateStorage = {
  getItem: async (name) => {
    const s = getStore();
    if (!s) return null;
    return (await get<string>(name, s)) ?? null;
  },
  setItem: async (name, value) => {
    const s = getStore();
    if (!s) return;
    await set(name, value, s);
  },
  removeItem: async (name) => {
    const s = getStore();
    if (!s) return;
    await del(name, s);
  },
};
