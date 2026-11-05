"use client";

import { useState } from "react";
import { toast } from "sonner";

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-[#7C3AED]" : "bg-gray-200 dark:bg-gray-600"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function PrivacyData() {
  const [prefs, setPrefs] = useState({
    leaderboard: true,
    shareProgress: true,
    analytics: true,
    recommendations: true,
  });

  const toggle = (key: keyof typeof prefs) => {
    setPrefs({ ...prefs, [key]: !prefs[key] });
    toast.success("Privacy settings updated.");
  };

  const items = [
    {
      key: "leaderboard" as const,
      label: "Show my profile on the leaderboard",
      sub: "Your name and rank are visible to company colleagues",
    },
    {
      key: "shareProgress" as const,
      label: "Share learning progress with my manager",
      sub: "Your manager can view your course completion and quiz scores",
    },
    {
      key: "analytics" as const,
      label: "Allow analytics to improve platform",
      sub: "Anonymised usage data helps us improve LearnSpace for everyone",
    },
    {
      key: "recommendations" as const,
      label: "Personalised course recommendations",
      sub: "Use your learning history to suggest relevant courses",
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L3 5v5c0 4 3 7.5 7 9 4-1.5 7-5 7-9V5l-7-3z" stroke="#7C3AED" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Privacy & Data</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Control what data is collected and who sees your activity</p>
        </div>
      </div>

      <div className="mb-6 divide-y divide-gray-100 dark:divide-gray-700">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.sub}</p>
            </div>
            <Toggle enabled={prefs[item.key]} onChange={() => toggle(item.key)} />
          </div>
        ))}
      </div>

      <button className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2h10v10H2z" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 5h6M4 7h6M4 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        Privacy Policy
      </button>
    </div>
  );
}
