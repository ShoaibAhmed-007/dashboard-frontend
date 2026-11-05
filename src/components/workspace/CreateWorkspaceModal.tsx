"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { workspaceService, WorkspaceUse, WorkspaceManagementType } from "@/services/workspace.service";
import { parseApiError } from "@/lib/api";
import { toast } from "sonner";
import { LuX, LuChevronLeft, LuChevronRight, LuCheck } from "react-icons/lu";
import Image from "next/image";

const WORKSPACE_USE_OPTIONS: { label: string; value: WorkspaceUse }[] = [
  { label: "Work", value: "WORK" },
  { label: "Personal", value: "PERSONAL" },
  { label: "School", value: "SCHOOL" },
];

const MANAGEMENT_TYPE_OPTIONS: { label: string; value: WorkspaceManagementType }[] = [
  { label: "HR & Recruiting", value: "HR_RECRUITING" },
  { label: "Creative & Design", value: "CREATIVE_DESIGN" },
  { label: "Professional Services", value: "PROFESSIONAL_SERVICES" },
  { label: "Finance & Accounting", value: "FINANCE_ACCOUNTING" },
  { label: "Operations", value: "OPERATIONS" },
  { label: "Software Development", value: "SOFTWARE_DEVELOPMENT" },
  { label: "IT", value: "IT" },
  { label: "Sales & CRM", value: "SALES_CRM" },
  { label: "Personal Use", value: "PERSONAL_USE" },
  { label: "Support", value: "SUPPORT" },
  { label: "Startup", value: "STARTUP" },
  { label: "PMO", value: "PMO" },
  { label: "Marketing", value: "MARKETING" },
  { label: "Other", value: "OTHER" },
];

interface Props {
  isOpen: boolean;
  onClose?: () => void;
}

export default function CreateWorkspaceModal({ isOpen, onClose }: Props) {
  const { createWorkspace } = useWorkspace();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [workspaceUse, setWorkspaceUse] = useState<WorkspaceUse | null>(null);
  const [managementType, setManagementType] = useState<WorkspaceManagementType | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (step === 4) nameInputRef.current?.focus();
    if (step === 3) emailInputRef.current?.focus();
  }, [step]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setWorkspaceUse(null);
      setManagementType(null);
      setEmails([]);
      setEmailInput("");
      setName("");
    }
  }, [isOpen]);

  function parseEmails(raw: string): string[] {
    return raw
      .split(/[\s,;\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));
  }

  function commitEmailInput() {
    const parsed = parseEmails(emailInput);
    if (parsed.length === 0) return;
    setEmails((prev) => Array.from(new Set([...prev, ...parsed])));
    setEmailInput("");
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      commitEmailInput();
    } else if (e.key === "Backspace" && emailInput === "" && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  }

  function removeEmail(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email));
  }

  async function handleFinish() {
    const trimmedName = name.trim();
    if (!trimmedName || !workspaceUse || !managementType) return;

    // Commit any pending email input before finishing
    const allEmails = [...emails, ...parseEmails(emailInput)];

    setLoading(true);
    try {
      const workspace = await createWorkspace(trimmedName, workspaceUse, managementType);

      if (allEmails.length > 0) {
        try {
          await workspaceService.inviteBulk(workspace.id, { emails: allEmails, role: "MEMBER" });
        } catch {
          toast.warning("Workspace created, but some invites failed to send.");
        }
      }

      toast.success(`Workspace "${trimmedName}" created`);
      onClose?.();
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const modal = (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose ? () => onClose() : undefined}
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-[780px] rounded-2xl bg-white dark:bg-gray-900 shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-0">
          <Image src="/images/logo/logo.svg" alt="Dashboard" width={136} height={36} />
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Welcome, {user.fullName}!
              </span>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <LuX className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-10 min-h-[340px]">
          {step === 1 && (
            <div>
              <h2 className="text-3xl font-normal text-gray-900 dark:text-white mb-8">
                What will you use this Workspace for?
              </h2>
              <div className="flex flex-wrap gap-3">
                {WORKSPACE_USE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWorkspaceUse(opt.value)}
                    className={`rounded-full border px-6 py-2.5 text-sm font-normal transition-colors ${
                      workspaceUse === opt.value
                        ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-500 dark:border-gray-600 dark:bg-transparent dark:text-gray-300 dark:hover:border-gray-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-3xl font-normal text-gray-900 dark:text-white mb-8">
                What would you like to manage?
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {MANAGEMENT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setManagementType(opt.value)}
                    className={`rounded-full border px-4 py-2 text-sm font-normal transition-colors ${
                      managementType === opt.value
                        ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-500 dark:border-gray-600 dark:bg-transparent dark:text-gray-300 dark:hover:border-gray-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-3xl font-normal text-gray-900 dark:text-white mb-8">
                Invite people to your Workspace:
              </h2>
              <div
                className="min-h-12 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 flex flex-wrap gap-2 cursor-text"
                onClick={() => emailInputRef.current?.focus()}
              >
                {emails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-sm text-gray-700 dark:text-gray-200"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <LuX className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  ref={emailInputRef}
                  type="text"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  onBlur={commitEmailInput}
                  placeholder={emails.length === 0 ? "Enter email addresses (or paste multiple)" : ""}
                  className="flex-1 min-w-[200px] bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
                />
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="text-green-500">◉</span>
                Don&apos;t do it alone - Invite your team to{" "}
                <strong className="text-gray-700 dark:text-gray-200">get started 200% faster.</strong>
              </p>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-3xl font-normal text-gray-900 dark:text-white mb-8">
                Lastly, what would you like to name your Workspace?
              </h2>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) handleFinish(); }}
                placeholder="Your workspace name"
                maxLength={100}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-base text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-colors"
              />
              <p className="mt-2 text-sm text-gray-400">Try the name of your company or organization.</p>
            </div>
          )}
        </div>

        {/* Footer: progress bar + navigation */}
        <div className="px-8 pb-8">
          {/* Progress bar */}
          <div className="mb-6 h-1 w-full rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-1 rounded-full bg-gray-900 dark:bg-white transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-normal text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <LuChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                disabled={
                  (step === 1 && !workspaceUse) ||
                  (step === 2 && !managementType)
                }
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 dark:bg-white px-4 py-2.5 text-sm font-normal text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <LuChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!name.trim() || loading}
                onClick={handleFinish}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 dark:bg-white px-4 py-2.5 text-sm font-normal text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating..." : <><LuCheck className="w-4 h-4" /> Finish</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
