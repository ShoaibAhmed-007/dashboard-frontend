"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Workspace } from "@/stores/workspace.store";
import { LuSettings, LuUsers, LuCheck, LuPlus } from "react-icons/lu";

// ── Helpers ──────────────────────────────────────────────────────────────────

function workspaceInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

// Deterministic color from workspace id
const COLORS = [
  "bg-brand-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-teal-500",
];
function workspaceColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

// ── WorkspaceAvatar ───────────────────────────────────────────────────────────

function WorkspaceAvatar({
  workspace,
  size = "md",
}: {
  workspace: Pick<Workspace, "id" | "name" | "logoUrl">;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "sm" ? "w-6 h-6 text-[10px]" : size === "lg" ? "w-12 h-12 text-lg" : "w-8 h-8 text-sm";

  if (workspace.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={workspace.logoUrl}
        alt={workspace.name}
        className={`${sizeClass} rounded-lg object-cover shrink-0`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} ${workspaceColor(workspace.id)} flex items-center justify-center rounded-lg text-white font-normal shrink-0`}
    >
      {workspaceInitial(workspace.name)}
    </span>
  );
}

// ── Main WorkspaceSwitcher ────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreateWorkspace: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export default function WorkspaceSwitcher({ isOpen, onClose, onCreateWorkspace, anchorRef }: Props) {
  const router = useRouter();
  const { workspaces, activeWorkspace, switchWorkspace, isLoading } = useWorkspace();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position from anchor
  useEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, left: rect.left });
  }, [isOpen, anchorRef]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose, anchorRef]);

  const handleSwitch = (id: string) => {
    switchWorkspace(id);
    onClose();
  };

  const handleOpenWorkspaceSettings = () => {
    onClose();
    router.push("/settings");
  };

  const dropdown = isOpen ? (
    <div
      ref={panelRef}
      style={{ top: position.top, left: position.left }}
      className="fixed w-72 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl z-9999 overflow-hidden"
    >
      {/* Active workspace header */}
      {activeWorkspace && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <WorkspaceAvatar workspace={activeWorkspace} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-normal text-gray-900 dark:text-gray-100 truncate">
              {activeWorkspace.name}
            </p>
            <p className="text-xs text-gray-400">Free Forever · <span className="text-brand-500 dark:text-gray-000 cursor-pointer hover:underline">Upgrade</span></p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={handleOpenWorkspaceSettings}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-normal text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#282626] transition-colors"
        >
          <LuSettings className="w-3.5 h-3.5" />
          Settings
        </button>
        <button
          type="button"
          onClick={() => { onClose(); router.push("/settings?tab=people"); }}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-normal text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#282626] transition-colors"
        >
          <LuUsers className="w-3.5 h-3.5" />
          People
        </button>
      </div>

      {/* Workspace list */}
      <div className="py-1.5 px-2 space-y-1 max-h-52 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <p className="px-4 pt-1 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">
              Your Workspaces
            </p>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                className={`flex w-full items-center rounded-lg gap-3 px-4 py-2  text-sm transition-colors
                  ${ws.id === activeWorkspace?.id
                    ? "bg-gray-200 dark:bg-gray-905 text-gray-900 dark:text-gray-100"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#282626]"
                  }`}
              >
                <WorkspaceAvatar workspace={ws} size="sm" />
                <span className="flex-1 text-left truncate font-normal">{ws.name}</span>
                {ws.id === activeWorkspace?.id && (
                  <LuCheck className="w-4 h-4 text-brand-500 dark:text-gray-000  shrink-0" />
                )}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Create workspace */}
      <div className="border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onCreateWorkspace}
          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-normal text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <LuPlus className="w-4 h-4" />
          Create Workspace
        </button>
      </div>
    </div>
  ) : null;

  return createPortal(dropdown, document.body);
}
