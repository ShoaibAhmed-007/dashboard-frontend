"use client";

import { useState, useEffect } from "react";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";

const DISMISSED_KEY = "notification_prompt_dismissed";

export default function NotificationPermissionBanner() {
  const { permission, requestPermission } = useSystemNotifications();
  const [dismissed, setDismissed] = useState(true); // start hidden until we check localStorage
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem(DISMISSED_KEY) === "true";
    setDismissed(wasDismissed);
  }, []);

  const handleEnable = async () => {
    setRequesting(true);
    await requestPermission();
    setRequesting(false);
    setDismissed(true);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  if (dismissed || permission !== "default") return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-50 dark:bg-brand-900/20 border-b border-brand-100 dark:border-brand-800 shrink-0">
      <svg className="w-4 h-4 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <p className="flex-1 text-sm text-gray-700 dark:text-gray-300">
        Enable desktop notifications to get alerted about new messages, even when this tab is in the background.
      </p>
      <button
        onClick={handleEnable}
        disabled={requesting}
        className="px-3 py-1 text-xs font-medium rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60 transition-colors shrink-0"
      >
        {requesting ? "Enabling…" : "Enable Notifications"}
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
