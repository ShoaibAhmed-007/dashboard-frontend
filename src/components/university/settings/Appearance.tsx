"use client";

import { useState } from "react";
import { toast } from "sonner";

type Theme = "Light" | "Dark" | "System";
type SidebarWidth = "Compact" | "Default" | "Wide";

export default function Appearance() {
  const [theme, setTheme] = useState<Theme>("Light");
  const [sidebarWidth, setSidebarWidth] = useState<SidebarWidth>("Default");

  const apply = () => {
    if (theme === "Dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "Light") {
      document.documentElement.classList.remove("dark");
    }
    toast.success("Appearance settings applied.");
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#7C3AED" strokeWidth="1.8"/>
            <path d="M10 2v4M10 14v4M2 10h4M14 10h4M4.93 4.93l2.83 2.83M12.24 12.24l2.83 2.83M4.93 15.07l2.83-2.83M12.24 7.76l2.83-2.83" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Appearance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Customise how LearnSpace looks for you</p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme</p>
        <div className="flex gap-2">
          {(["Light", "Dark", "System"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                theme === t
                  ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#7C3AED] hover:text-[#7C3AED]"
              }`}
            >
              {t === "Light" && <span>☀️</span>}
              {t === "Dark" && <span>🌙</span>}
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Sidebar width</p>
        <div className="flex gap-2">
          {(["Compact", "Default", "Wide"] as SidebarWidth[]).map((w) => (
            <button
              key={w}
              onClick={() => setSidebarWidth(w)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                sidebarWidth === w
                  ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#7C3AED] hover:text-[#7C3AED]"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={apply}
          className="rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors"
        >
          Apply Changes
        </button>
      </div>
    </div>
  );
}
