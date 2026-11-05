"use client";

import { BellIcon, MoonIcon, SearchIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useUniversityStore } from "@/stores/university.store";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/university": {
    title: "Dashboard",
    subtitle: new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  },
  "/university/course-library": {
    title: "Course Library",
    subtitle: "Browse and enrol in courses",
  },
  "/university/my-learning": {
    title: "Now Playing",
    subtitle: "Information Security Essentials 2026",
  },
  "/university/certificates": {
    title: "Certificates",
    subtitle: "Your earned certificates",
  },
  "/university/reports": {
    title: "Reports",
    subtitle: "Learning analytics & insights",
  },
  "/university/settings": {
    title: "Settings",
    subtitle: "Manage your account and preferences",
  },
};

export default function UniversityHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { activeCoursTitle, activeCourseDescription } = useUniversityStore();

  const isMyLearning = pathname === "/university/my-learning";
  const isMyLearningLoading = isMyLearning && !activeCoursTitle;
  const page = isMyLearning && activeCoursTitle
    ? { title: activeCoursTitle, subtitle: activeCourseDescription ?? "" }
    : PAGE_TITLES[pathname] ?? { title: "University", subtitle: "Dashboard University" };

  return (
    <header className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between px-4 pb-4 pt-6 sm:px-6 lg:px-10 bg-[#f5f7fa] dark:bg-gray-900">
      <div className="flex flex-col gap-1">
        {isMyLearningLoading ? (
          <>
            <div className="h-7 w-48 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-4 w-72 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mt-1" />
          </>
        ) : (
          <>
            <h1 className="font-['Inter',Helvetica] text-2xl font-bold leading-none tracking-[0] text-gray-800 dark:text-white">
              {page.title}
            </h1>
            {page.subtitle && (
              <p className="font-['Inter',Helvetica] text-[13.6px] font-normal leading-[normal] tracking-[0] text-gray-500 dark:text-gray-400">
                {page.subtitle}
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex w-full flex-col gap-4 lg:w-auto lg:flex-row lg:items-center lg:justify-end lg:gap-6">
        <div className="relative w-full lg:w-[250px]">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[13.6px] w-[13.6px] -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <Input
            defaultValue=""
            placeholder="Search courses, topics..."
            className="h-auto rounded-[20px] border border-gray-200 bg-white py-2.5 pl-9 pr-4 font-['Inter',Helvetica] text-[13.6px] font-normal tracking-[0] text-[#757575] placeholder:text-[#757575] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:placeholder:text-gray-500"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="inline-flex h-[39px] items-center rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md px-2.5 py-[5px] font-['Inter',Helvetica] text-[13px] font-normal leading-[normal] tracking-[0] text-gray-500 dark:text-gray-400"
            >
              Tasks
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-[#8920fe] px-3.5 py-[5px] font-['Inter',Helvetica] text-[13px] font-medium leading-[normal] tracking-[0] text-white"
            >
              LSM
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-[20px] border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:dark:bg-gray-700"
          >
            <BellIcon className="h-[13.3px] w-[13.3px]" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="h-10 w-10 rounded-[20px] border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:dark:bg-gray-700"
          >
            {theme === "dark" ? (
              <SunIcon className="h-[13.3px] w-[13.3px]" />
            ) : (
              <MoonIcon className="h-[13.3px] w-[13.3px]" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
