"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCourseLibrary } from "@/hooks/useCourseLibrary";
import { useInvalidateUniversityCache } from "@/hooks/useInvalidateUniversityCache";
import { formatDuration, enrollCourse, bookmarkCourse, removeBookmark, type CatalogCourse } from "@/services/university.service";

// Label → exact backend CourseCategory enum value
const CATEGORIES: { label: string; value: string | null }[] = [
  { label: "All Courses",   value: null },
  { label: "Cybersecurity", value: "CYBERSECURITY" },
  { label: "Leadership",    value: "LEADERSHIP" },
  { label: "Technical",     value: "TECHNICAL" },
  { label: "HR & Culture",  value: "HR_CULTURE" },
  { label: "Onboarding",    value: "ONBOARDING" },
  { label: "Sales",         value: "SALES" },
  { label: "Communication", value: "COMMUNICATION" },
  { label: "Technology",    value: "TECHNOLOGY" },
];

export default function CourseLibrary() {
  const [activeCategoryValue, setActiveCategoryValue] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const params = {
    page,
    pageSize: 9,
    ...(activeCategoryValue ? { category: activeCategoryValue } : {}),
  };

  const { courses, total, totalPages, isLoading, error } = useCourseLibrary(params);

  const handleCategory = useCallback((value: string | null) => {
    setActiveCategoryValue(value);
    setPage(1);
  }, []);

  return (
    <div className="p-6">
      {/* Category filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            onClick={() => handleCategory(cat.value)}
           className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
              activeCategoryValue === cat.value
                ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#7C3AED] hover:text-[#7C3AED]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Course grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <div className="h-40 bg-gray-100 dark:bg-gray-700 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                  <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                  <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                </div>
              </div>
            ))
          : courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
      </div>

      {/* Empty state */}
      {!isLoading && courses.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          No courses found in this category.
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} course{total !== 1 ? "s" : ""} found
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:border-[#7C3AED] hover:text-[#7C3AED] transition-colors"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:border-[#7C3AED] hover:text-[#7C3AED] transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Course card ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  LEADERSHIP:    "text-purple-600 dark:text-purple-400",
  TECHNICAL:     "text-blue-600 dark:text-blue-400",
  CYBERSECURITY: "text-indigo-600 dark:text-indigo-400",
  HR_CULTURE:    "text-green-600 dark:text-green-400",
  ONBOARDING:    "text-teal-600 dark:text-teal-400",
  SALES:         "text-amber-600 dark:text-amber-400",
  COMMUNICATION: "text-rose-600 dark:text-rose-400",
  TECHNOLOGY:    "text-cyan-600 dark:text-cyan-400",
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  LEADERSHIP:    "from-[#1a1040] to-[#3d2060]",
  TECHNICAL:     "from-[#0a2040] to-[#1a4060]",
  CYBERSECURITY: "from-[#1a2040] to-[#2d3a6e]",
  HR_CULTURE:    "from-[#0a2a1a] to-[#1a4a2a]",
  ONBOARDING:    "from-[#002a2a] to-[#004a4a]",
  SALES:         "from-[#2a1a00] to-[#6e4a00]",
  COMMUNICATION: "from-[#2a1010] to-[#6e1a1a]",
  TECHNOLOGY:    "from-[#0a2030] to-[#0a4050]",
};

function CourseCard({ course }: { course: CatalogCourse }) {
  const router = useRouter();
  const { invalidateDashboard, invalidateLibrary } = useInvalidateUniversityCache();
  const [enrolling, setEnrolling] = useState(false);
  const [bookmarked, setBookmarked] = useState(course.isBookmarked);
  const [bookmarking, setBookmarking] = useState(false);

  const cat = course.category ?? "";
  const tagColor = CATEGORY_COLORS[cat] ?? "text-gray-500 dark:text-gray-400";
  const gradient = CATEGORY_GRADIENTS[cat] ?? "from-gray-700 to-gray-900";
  const duration = formatDuration(course.totalDurationSeconds);

  const badge = course.isMandatory
    ? { label: "MANDATORY", className: "bg-red-500" }
    : course.popular
    ? { label: "POPULAR", className: "bg-orange-500" }
    : course.isNew
    ? { label: "NEW", className: "bg-green-500" }
    : null;

  const progress = course.myProgress;
  const isEnrolled = !!progress;

  async function handleBookmark(e: React.MouseEvent) {
    e.stopPropagation();
    if (bookmarking) return;
    setBookmarking(true);
    try {
      const result = bookmarked
        ? await removeBookmark(course.id)
        : await bookmarkCourse(course.id);
      setBookmarked(result.bookmarked);
    } finally {
      setBookmarking(false);
    }
  }

  async function handleWatch() {
    setEnrolling(true);
    try {
      await enrollCourse(course.id);
      invalidateDashboard();
      invalidateLibrary();
      router.push(`/university/my-learning?courseId=${course.id}`);
    } catch {
      setEnrolling(false);
    }
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group flex flex-col h-[365px]">
      {/* Thumbnail */}
      <div
        className={`relative h-40 shrink-0 overflow-hidden ${!course.coverImageUrl ? `bg-linear-to-br ${gradient} flex items-center justify-center` : ""}`}
      >
        {course.coverImageUrl && (
          <Image
            src={course.coverImageUrl}
            alt={course.title}
            fill
            className="object-cover"
          />
        )}
        {!course.coverImageUrl && (
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" opacity="0.25">
            <circle cx="26" cy="26" r="22" stroke="white" strokeWidth="2"/>
            <path d="M22 18l14 8-14 8V18z" fill="white"/>
          </svg>
        )}
        {badge && (
          <span className={`absolute top-3 left-3 rounded px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide ${badge.className}`}>
            {badge.label}
          </span>
        )}
        <button
          onClick={handleBookmark}
          disabled={bookmarking}
          className={`absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full transition-all ${
            bookmarked ? "bg-white/20 text-white" : "bg-black/30 text-white/50 hover:text-white hover:bg-white/20"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
            <path d="M3 2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v13l-5-3-5 3V2z"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 min-h-0">
        <p className={`text-[11px] font-bold tracking-widest mb-1.5 uppercase ${tagColor}`}>
          {cat || "Course"}
        </p>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-[#7C3AED] transition-colors">
          {course.title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          {course.description || ""}
        </p>

      </div>

      {/* Pinned progress bar — sits just above footer */}
      {progress && (
        <div className="absolute bottom-[52px] left-0 right-0 px-4 pb-2 bg-white dark:bg-gray-901">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>{progress.completedRequiredLessons} of {progress.totalRequiredLessons} completed</span>
            <span className="text-[#7C3AED]">{progress.percentage}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
            <div className="h-1.5 rounded-full bg-[#7C3AED]" style={{ width: `${progress.percentage}%` }} />
          </div>
        </div>
      )}

      {/* Pinned footer — always at bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3 5h6M3 7.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {course.totalLessons} lessons
          </span>
          {duration && (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M6 3.5v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {duration}
            </span>
          )}
        </div>
        <button
          onClick={handleWatch}
          disabled={enrolling}
          className="rounded-lg bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 text-xs font-medium text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition-colors disabled:opacity-60"
        >
          {enrolling ? "Loading…" : isEnrolled ? "Continue" : "Watch Now"}
        </button>
      </div>
    </div>
  );
}


