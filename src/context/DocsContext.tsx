"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Doc,
  CreateDocPayload,
  UpdateDocPayload,
  docsService,
} from "@/services/docs.service";
import { useWorkspace } from "@/context/WorkspaceContext";
import { queryKeys } from "@/queries/keys";

interface DocsContextValue {
  docs: Doc[];
  isLoading: boolean;
  createDoc: (payload: CreateDocPayload) => Promise<Doc>;
  updateDoc: (id: string, payload: UpdateDocPayload) => Promise<Doc>;
  deleteDoc: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
  upsertLocal: (doc: Doc) => void;
}

const DocsContext = createContext<DocsContextValue | null>(null);

export function DocsProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = activeWorkspace?.id ?? null;
  // Memoized so it's referentially stable across renders — queryKeys.docs()
  // returns a fresh array literal every call, which would otherwise cascade
  // into a new `setDocs`/`upsertLocal` identity every render and re-trigger
  // any effect (e.g. DocEditorPage's initial load) that depends on them.
  const queryKey = useMemo(() => queryKeys.docs(workspaceId), [workspaceId]);

  const query = useQuery({
    queryKey,
    queryFn: () => docsService.list({ workspaceId: workspaceId! }),
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });
  const docs = useMemo(() => query.data ?? [], [query.data]);

  const setDocs = useCallback(
    (updater: (prev: Doc[]) => Doc[]) => {
      queryClient.setQueryData<Doc[]>(queryKey, (prev) => updater(prev ?? []));
    },
    [queryClient, queryKey]
  );

  const fetchDocs = useCallback(async () => {
    if (!workspaceId) return;
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey, workspaceId]);

  const createDoc = useCallback(
    async (payload: CreateDocPayload) => {
      const doc = await docsService.create(payload);
      setDocs((prev) => [doc, ...prev]);
      return doc;
    },
    [setDocs]
  );

  const updateDoc = useCallback(
    async (id: string, payload: UpdateDocPayload) => {
      const doc = await docsService.update(id, payload);
      setDocs((prev) => prev.map((d) => (d.id === id ? doc : d)));
      return doc;
    },
    [setDocs]
  );

  const deleteDoc = useCallback(
    async (id: string) => {
      await docsService.delete(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    },
    [setDocs]
  );

  const upsertLocal = useCallback(
    (doc: Doc) => {
      setDocs((prev) => {
        const idx = prev.findIndex((d) => d.id === doc.id);
        if (idx === -1) return [doc, ...prev];
        const next = prev.slice();
        next[idx] = doc;
        return next;
      });
    },
    [setDocs]
  );

  const value = useMemo<DocsContextValue>(
    () => ({
      docs,
      isLoading: query.isLoading,
      createDoc,
      updateDoc,
      deleteDoc,
      refetch: fetchDocs,
      upsertLocal,
    }),
    [docs, query.isLoading, createDoc, updateDoc, deleteDoc, fetchDocs, upsertLocal]
  );

  return (
    <DocsContext.Provider value={value}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs(): DocsContextValue {
  const ctx = useContext(DocsContext);
  if (!ctx) throw new Error("useDocs must be used within <DocsProvider>");
  return ctx;
}

// Inert defaults for consumers that may render outside a <DocsProvider> —
// e.g. AppSidebar's DocsListSidebarSection, shared by the admin layout (has the
// provider) and the university layout (intentionally does NOT). Returns empty
// results / no-ops instead of throwing a client-side exception that
// white-screens the page.
const EMPTY_DOCS: Doc[] = [];
const NOOP_DOCS_CONTEXT: DocsContextValue = {
  docs: EMPTY_DOCS,
  isLoading: false,
  createDoc: async () => {
    throw new Error("createDoc is unavailable outside <DocsProvider>");
  },
  updateDoc: async () => {
    throw new Error("updateDoc is unavailable outside <DocsProvider>");
  },
  deleteDoc: async () => {},
  refetch: async () => {},
  upsertLocal: () => {},
};

/**
 * Like useDocs(), but returns inert defaults instead of throwing when there is
 * no <DocsProvider> above in the tree. Use in components that render in both
 * provider-wrapped and provider-less layouts.
 */
export function useOptionalDocs(): DocsContextValue {
  return useContext(DocsContext) ?? NOOP_DOCS_CONTEXT;
}
