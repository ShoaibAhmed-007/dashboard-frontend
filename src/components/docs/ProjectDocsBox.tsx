"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LuFileText, LuPlus } from "react-icons/lu";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useDocs } from "@/context/DocsContext";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";

export default function ProjectDocsBox({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { docs: allDocs, isLoading: loading, createDoc } = useDocs();
  const [creating, setCreating] = useState(false);

  // DocsContext already fetches all of the workspace's docs (GET /docs?workspaceId=X) —
  // filter client-side instead of firing a second, project-scoped /docs request.
  const docs = useMemo(
    () => allDocs.filter((d) => d.projectId === projectId && d.scope === "PROJECT"),
    [allDocs, projectId]
  );

  const createAndOpen = useCallback(async () => {
    if (!activeWorkspace || creating) return;
    setCreating(true);
    try {
      const doc = await createDoc({
        title: "Untitled",
        scope: "PROJECT",
        workspaceId: activeWorkspace.id,
        projectId,
      });
      router.push(`/projects/${projectId}/docs/${doc.id}`);
    } catch (e) {
      toast.error(parseApiError(e).message);
      setCreating(false);
    }
  }, [activeWorkspace, createDoc, creating, projectId, router]);

  return (
    <div className="flex h-72 flex-col rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-901">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h3 className="text-base font-normal text-gray-800 dark:text-white">Docs</h3>
        <button
          type="button"
          onClick={createAndOpen}
          disabled={creating}
          className="flex items-center gap-1 text-sm font-normal text-brand-500 dark:text-gray-200 dark:hover:text-gray-000 hover:text-brand-600 disabled:opacity-50"
        >
          {creating ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          ) : (
            <LuPlus className="h-3.5 w-3.5" />
          )}
          Add a Doc
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
            <LuFileText className="h-5 w-5" />
          </span>
          <p className="mb-3 text-sm text-gray-400">
            There are no Docs in this location yet.
          </p>
          <button
            type="button"
            onClick={createAndOpen}
            disabled={creating}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-normal text-white disabled:opacity-50 dark:bg-gray-000 dark:hover:bg-gray-200 dark:text-gray-900"
          >
            {creating ? "Creating…" : "Add a Doc"}
          </button>
        </div>
      ) : (
        <ul className="flex-1 space-y-1 overflow-y-auto pr-1">
          {docs.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/docs/${d.id}`)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <LuFileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="truncate">{d.title || "Untitled"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
