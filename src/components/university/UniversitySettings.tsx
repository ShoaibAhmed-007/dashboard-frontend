"use client";

import { useState } from "react";
import ProfileInfo from "./settings/ProfileInfo";
import PasswordSecurity from "./settings/PasswordSecurity";
import Notifications from "./settings/Notifications";
import Preferences from "./settings/Preferences";
import Appearance from "./settings/Appearance";
import PrivacyData from "./settings/PrivacyData";
import Account from "./settings/Account";

type Section =
  | "profile"
  | "password"
  | "notifications"
  | "preferences"
  | "appearance"
  | "privacy"
  | "account";

interface NavItem {
  key: Section;
  label: string;
  icon: React.ReactNode;
  group: string;
  danger?: boolean;
}

const navItems: NavItem[] = [
  {
    key: "profile",
    label: "Profile Info",
    group: "ACCOUNT",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M2 14a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: "password",
    label: "Password & Security",
    group: "ACCOUNT",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="3" y="6.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M5.5 6.5V4.5a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: "notifications",
    label: "Notifications",
    group: "ACCOUNT",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1.5A4.5 4.5 0 0 0 3 6v2.5l-1.5 2H13.5l-1.5-2V6A4.5 4.5 0 0 0 7.5 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M6 11.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    key: "preferences",
    label: "Preferences",
    group: "LEARNING",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1.5A6 6 0 1 0 13.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M7.5 4V7.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: "appearance",
    label: "Appearance",
    group: "LEARNING",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M7.5 1.5v2M7.5 11.5v2M1.5 7.5h2M11.5 7.5h2M3.7 3.7l1.4 1.4M9.9 9.9l1.4 1.4M3.7 11.3l1.4-1.4M9.9 5.1l1.4-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: "privacy",
    label: "Privacy & Data",
    group: "OTHER",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1L2 3.5v4C2 10.5 4.5 13.5 7.5 14.5c3-1 5.5-4 5.5-7V3.5L7.5 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: "account",
    label: "Account",
    group: "OTHER",
    danger: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 2v6M7.5 10v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
  },
];

const GROUPS = ["ACCOUNT", "LEARNING", "OTHER"];

const CONTENT: Record<Section, React.ComponentType> = {
  profile: ProfileInfo,
  password: PasswordSecurity,
  notifications: Notifications,
  preferences: Preferences,
  appearance: Appearance,
  privacy: PrivacyData,
  account: Account,
};

export default function UniversitySettings() {
  const [active, setActive] = useState<Section>("profile");
  const ActiveComponent = CONTENT[active];

  return (
    <div className="flex min-h-full">
      {/* Settings nav sidebar */}
      <aside className="w-[220px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-5">
        {GROUPS.map((group) => {
          const items = navItems.filter((n) => n.group === group);
          return (
            <div key={group}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActive(item.key)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors ${
                      active === item.key
                        ? item.danger
                          ? "bg-red-50 dark:bg-red-900/20 text-red-500"
                          : "bg-[#7C3AED]/10 text-[#7C3AED]"
                        : item.danger
                        ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 p-6 bg-white dark:bg-gray-800">
        <ActiveComponent />
      </div>
    </div>
  );
}
