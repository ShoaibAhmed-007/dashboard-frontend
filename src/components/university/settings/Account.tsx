"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  confirmClass,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Account() {
  const { logout } = useAuth();
  const [modal, setModal] = useState<"signout" | "reset" | "deactivate" | null>(null);

  const actions = [
    {
      key: "signout" as const,
      title: "Sign out of all devices",
      description: "This will end all active sessions on every device. You'll need to sign in again.",
      buttonLabel: "Sign Out All",
      confirmTitle: "Sign out everywhere?",
      confirmMessage: "All active sessions will be terminated. You will need to sign in again on all devices.",
      confirmLabel: "Sign Out All",
      confirmClass: "bg-red-500 hover:bg-red-600",
      onConfirm: () => { logout(); },
    },
    {
      key: "reset" as const,
      title: "Reset all learning progress",
      description: "This will permanently erase your course history, quiz scores, and certificates. This cannot be undone.",
      buttonLabel: "Reset Progress",
      confirmTitle: "Reset all learning progress?",
      confirmMessage: "This permanently deletes all course history, quiz scores, and certificates. This action cannot be reversed.",
      confirmLabel: "Reset Progress",
      confirmClass: "bg-red-500 hover:bg-red-600",
      onConfirm: () => { setModal(null); },
    },
    {
      key: "deactivate" as const,
      title: "Deactivate account",
      description: "Your account will be disabled. Contact HR to reactivate. All data is preserved for 90 days.",
      buttonLabel: "Deactivate",
      confirmTitle: "Deactivate your account?",
      confirmMessage: "Your account will be disabled immediately. All your data is preserved for 90 days. Contact HR to reactivate.",
      confirmLabel: "Deactivate Account",
      confirmClass: "bg-red-500 hover:bg-red-600",
      onConfirm: () => { setModal(null); },
    },
  ];

  const active = actions.find((a) => a.key === modal);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3v8M10 14v1" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
            <path d="M10 18A8 8 0 1 0 10 2a8 8 0 0 0 0 16z" stroke="#EF4444" strokeWidth="1.8"/>
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Account Actions</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Irreversible actions — proceed with caution</p>
        </div>
      </div>

      <div className="space-y-4">
        {actions.map((action) => (
          <div
            key={action.key}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 p-5"
          >
            <div>
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">{action.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{action.description}</p>
            </div>
            <button
              onClick={() => setModal(action.key)}
              className="flex-shrink-0 rounded-lg border border-red-300 dark:border-red-700 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              {action.buttonLabel}
            </button>
          </div>
        ))}
      </div>

      {active && (
        <ConfirmModal
          open
          title={active.confirmTitle}
          message={active.confirmMessage}
          confirmLabel={active.confirmLabel}
          confirmClass={active.confirmClass}
          onConfirm={active.onConfirm}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
