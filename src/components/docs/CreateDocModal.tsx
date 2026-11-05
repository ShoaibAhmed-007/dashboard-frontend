"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuX, LuLock, LuUsers, LuFolder } from "react-icons/lu";
import { toast } from "sonner";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useOptionalDocs } from "@/context/DocsContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { parseApiError } from "@/lib/api";
import type { DocScope } from "@/services/docs.service";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (docId: string) => void;
  /** When provided, scope is locked to PROJECT and projectId is preset. */
  fixedProjectId?: string;
  /** When provided, scope is locked to this value. */
  fixedScope?: DocScope;
}

export default function CreateDocModal({
  isOpen,
  onClose,
  onCreated,
  fixedProjectId,
  fixedScope,
}: Props) {
  const { activeWorkspace } = useWorkspace();
  const { createDoc } = useOptionalDocs();
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, isOpen);

  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<DocScope>(
    fixedProjectId ? "PROJECT" : fixedScope ?? "WORKSPACE"
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setScope(fixedProjectId ? "PROJECT" : fixedScope ?? "WORKSPACE");
    }
  }, [isOpen, fixedProjectId, fixedScope]);

  if (!isOpen) return null;
  if (typeof window === "undefined") return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const doc = await createDoc({
        title: title.trim() || "Untitled",
        scope,
        workspaceId: activeWorkspace.id,
        projectId: scope === "PROJECT" ? fixedProjectId ?? null : null,
      });
      toast.success("Doc created");
      onCreated?.(doc.id);
      onClose();
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const scopeLocked = !!(fixedProjectId || fixedScope);

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4">
      <div
        ref={containerRef}
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-901"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            New document
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
              className="w-full rounded-md border border-gray-200  bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-905 dark:focus:border-gray-000 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {!scopeLocked && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Scope
              </label>
              <div className="grid grid-cols-2 gap-2">
                <ScopeOption
                  active={scope === "WORKSPACE"}
                  onClick={() => setScope("WORKSPACE")}
                  icon={<LuUsers className="h-4 w-4" />}
                  label="Workspace"
                  desc="Visible to all members"
                />
                <ScopeOption
                  active={scope === "PERSONAL"}
                  onClick={() => setScope("PERSONAL")}
                  icon={<LuLock className="h-4 w-4" />}
                  label="Personal"
                  desc="Only you can see"
                />
              </div>
            </div>
          )}

          {scope === "PROJECT" && fixedProjectId && (
            <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              <LuFolder className="h-3.5 w-3.5" />
              Project document
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !activeWorkspace}
              className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white dark:bg-gray-000 dark:text-black hover:bg-brand-600 dark:hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function ScopeOption({
  active,
  onClick,
  icon,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors ${
        active
          ? "border-brand-500 dark:border-gray-000 bg-brand-50 dark:bg-brand-900/30"
          : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
        {icon}
        {label}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
    </button>
  );
}
