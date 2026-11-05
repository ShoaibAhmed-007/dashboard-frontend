"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuChevronDown, LuChevronUp, LuUserPlus, LuX } from "react-icons/lu";
import { toast } from "sonner";
import { useWorkspace } from "@/context/WorkspaceContext";
import { parseApiError } from "@/lib/api";
import { workspaceService, WorkspaceInviteRole } from "@/services/workspace.service";

interface InvitePeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Only the roles `POST /workspaces/:id/invite` actually accepts — its DTO is
 * `z.enum(['MANAGER', 'MEMBER'])`.
 *
 * `OWNER` is deliberately absent: it is written in exactly one place
 * server-side (when the workspace is created) and no invite, add-member or
 * role-change path can produce a second one. MANAGER is the role that carries
 * the rights people used to reach for "Owner" to grant — it has full parity
 * with OWNER on every workspace-management action.
 *
 * `ADMIN` also exists in the Prisma `Role` enum and is honoured by the
 * authorization layer (project archive/restore, deleting others' attachments),
 * but no code path can grant it and this endpoint rejects it with 422, so it
 * stays off the list rather than being faked.
 */
type UiRoleKey = "MEMBER" | "MANAGER";

const ROLE_OPTIONS: Array<{
  key: UiRoleKey;
  label: string;
  description: string;
  badge?: string;
}> = [
  {
    key: "MEMBER",
    label: "Member",
    description: "Can access all public items in your Workspace.",
  },
  {
    key: "MANAGER",
    label: "Manager",
    description: "Full control: manages People and workspace settings.",
  },
];

function parseEmails(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\s,]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .filter((email) => {
      if (seen.has(email)) return false;
      seen.add(email);
      return true;
    });
}

export default function InvitePeopleModal({
  isOpen,
  onClose,
}: InvitePeopleModalProps) {
  const { activeWorkspace } = useWorkspace();
  const [emailsInput, setEmailsInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<UiRoleKey>("MEMBER");
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  // Independent of `selectedRole` — a MEMBER can be an IT Manager, and a
  // MANAGER isn't one by default (doc §1.1). This is also the only path
  // where a MANAGER, not just the OWNER, can grant IT Manager access: it
  // applies the moment the invite is accepted.
  const [makeItManager, setMakeItManager] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEmailsInput("");
    setSelectedRole("MEMBER");
    setIsRoleOpen(false);
    setMakeItManager(false);
    setInputError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSending) {
        // Escape closes an open dropdown first, and only closes the modal
        // itself once it isn't open.
        if (isRoleOpen) {
          setIsRoleOpen(false);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isRoleOpen, isSending, onClose]);

  useEffect(() => {
    if (!isOpen || !isRoleOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!roleMenuRef.current?.contains(target)) setIsRoleOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen, isRoleOpen]);

  const parsedEmails = useMemo(() => parseEmails(emailsInput), [emailsInput]);
  const currentRole = ROLE_OPTIONS.find((r) => r.key === selectedRole) ?? ROLE_OPTIONS[0];
  // 1:1 with the API now that the UI only offers roles it accepts — no
  // translation layer to drift out of sync.
  const backendRole: WorkspaceInviteRole = selectedRole;

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!activeWorkspace) {
      toast.error("No active workspace selected.");
      return;
    }

    if (parsedEmails.length === 0) {
      setInputError("Enter at least one email address.");
      return;
    }

    const invalidEmails = parsedEmails.filter((email) => !EMAIL_REGEX.test(email));
    if (invalidEmails.length > 0) {
      setInputError(`Invalid email: ${invalidEmails[0]}`);
      return;
    }

    setInputError(null);
    setIsSending(true);
    try {
      const results = await Promise.allSettled(
        parsedEmails.map((email) =>
          workspaceService.invite(activeWorkspace.id, {
            email,
            role: backendRole,
            isItManager: makeItManager,
          })
        )
      );

      const failedEmails: string[] = [];
      let firstFailureMessage = "";
      let sentCount = 0;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          sentCount += 1;
          return;
        }
        failedEmails.push(parsedEmails[index]);
        if (!firstFailureMessage) {
          firstFailureMessage = parseApiError(result.reason).message;
        }
      });

      if (sentCount > 0) {
        toast.success(
          sentCount === 1
            ? "Invite sent successfully."
            : `${sentCount} invites sent successfully.`
        );
      }

      if (failedEmails.length > 0) {
        setEmailsInput(failedEmails.join(", "));
        setInputError(firstFailureMessage || "Some invites failed. Try again.");
        return;
      }

      onClose();
    } finally {
      setIsSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={() => {
          if (!isSending) onClose();
        }}
      />

      <div className="relative z-10 mx-4 w-full max-w-[500px] rounded-xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-800 dark:bg-[#17181C] sm:p-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isSending}
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-60 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15 dark:hover:text-white"
        >
          <LuX className="h-3.5 w-3.5" />
        </button>

        <h2 className="text-2xl font-normal tracking-tight text-gray-900 dark:text-white">
          Invite people for free
        </h2>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-normal text-gray-700 dark:text-gray-300">
            Invite by email
          </p>
          <input
            value={emailsInput}
            onChange={(e) => {
              setEmailsInput(e.target.value);
              if (inputError) setInputError(null);
            }}
            placeholder="Email, comma or space separated"
            className={`h-9 w-full rounded-md border bg-white px-2.5 text-sm leading-none text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:bg-[#111216] dark:text-gray-100 dark:placeholder:text-gray-500 ${
              inputError
                ? "border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500"
                : "border-gray-300 focus:border-brand-500 focus:ring-brand-500/25 dark:border-white/20 dark:focus:border-brand-400"
            }`}
          />
          {inputError && (
            <p className="mt-2 text-sm text-red-500 dark:text-red-400">{inputError}</p>
          )}
        </div>

        <div ref={roleMenuRef} className="relative mt-3">
          <p className="mb-1.5 text-xs font-normal text-gray-700 dark:text-gray-300">
            Invite as
          </p>
          <button
            type="button"
            onClick={() => setIsRoleOpen((v) => !v)}
            className="flex w-full items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-left hover:border-violet-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-gray-000"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-300">
              <LuUserPlus className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <p className="text-base font-normal leading-none text-gray-900 dark:text-white">
                {currentRole.label}
              </p>
              <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
                {currentRole.description}
              </p>
            </div>
            {isRoleOpen ? (
              <LuChevronUp className="mt-1 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
            ) : (
              <LuChevronDown className="mt-1 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
            )}
          </button>

          {isRoleOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-3 py-2.5 dark:border-gray-800">
                <div>
                  <p className="text-xs font-normal text-gray-900 dark:text-gray-100">
                    {currentRole.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {currentRole.description}
                  </p>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
                {ROLE_OPTIONS.filter((option) => option.key !== selectedRole).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setSelectedRole(option.key);
                      setIsRoleOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/70"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-normal text-gray-900 dark:text-gray-100">
                        {option.label}
                      </p>
                      {option.badge && (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-normal text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
            Workspace: {activeWorkspace?.name ?? "No workspace selected"}
          </p>
        </div>

        <label className="mt-3 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-white/10 dark:bg-white/[0.03]">
          <input
            type="checkbox"
            checked={makeItManager}
            onChange={(e) => setMakeItManager(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-brand-500 focus:ring-brand-500/25 dark:border-white/20 dark:bg-white/[0.03]"
          />
          <span>
            <span className="block text-xs font-normal text-gray-900 dark:text-white">
              Also make them an IT Manager
            </span>
            <span className="mt-0.5 block text-[11px] text-gray-600 dark:text-gray-400">
              Grants access to the IT Management module (Assets, Employees, Requests, Bills) the moment they accept.
            </span>
          </span>
        </label>

        <div className="mt-4 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="rounded-full px-3 py-1.5 text-xs font-normal text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !activeWorkspace}
            className="rounded-md bg-violet-500 dark:bg-gray-000 dark:text-black dark:hover:bg-gray-200 px-3 py-1.5 text-xs font-normal text-white transition-colors hover:bg-violet-600  disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send free invite"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
