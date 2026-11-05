"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useMyLearning } from "@/hooks/useMyLearning";
import { useAuthStore } from "@/stores/auth.store";
import {
  formatDuration,
  getInstructorInitials,
  bookmarkCourse,
  removeBookmark,
  getCourseReviews,
  createReview,
  updateReview,
  deleteReview,
  type CourseReview,
} from "@/services/university.service";

const VideoPlayer = dynamic(() => import("./VideoPlayer"), { ssr: false });

export default function MyLearning() {
  const {
    myCourses,
    activeCourse,
    courseDetail,
    activeLesson,
    playbackSession,
    lessonProgress,
    note,
    isLoadingCourses,
    isLoadingDetail,
    isLoadingPlayback,
    isSavingNote,
    error,
    selectLesson,
    selectCourse,
    saveNote,
    openResource,
    onTimeUpdate,
    onPause,
    onSeeked,
    onEnded,
  } = useMyLearning();

  const currentUserId = useAuthStore((s) => s.user?.id);

  // Derived — declared first so hooks below can reference them
  const course = activeCourse?.course;
  const progress = activeCourse?.myProgress;
  const instructor = courseDetail?.instructor;
  const upNext = myCourses.filter((c) => c.course.id !== course?.id).slice(0, 2);
  const currentNote = note?.content ?? "";

  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");

  // ── Bookmark ─────────────────────────────────────────────────────────────────
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  useEffect(() => {
    setIsBookmarked(false);
  }, [course?.id]);

  useEffect(() => {
    if (courseDetail) {
      setIsBookmarked((courseDetail as unknown as { isBookmarked?: boolean }).isBookmarked ?? false);
    }
  }, [courseDetail]);

  const handleBookmark = useCallback(async () => {
    if (!course?.id || bookmarking) return;
    setBookmarking(true);
    try {
      const result = isBookmarked
        ? await removeBookmark(course.id)
        : await bookmarkCourse(course.id);
      setIsBookmarked(result.bookmarked);
    } finally {
      setBookmarking(false);
    }
  }, [course?.id, isBookmarked, bookmarking]);

  // ── Reviews ───────────────────────────────────────────────────────────────────
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [myReview, setMyReview] = useState<CourseReview | null>(null);
  const [reviewMode, setReviewMode] = useState<"view" | "write">("view");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const loadReviews = useCallback(async (courseId: string) => {
    setReviewsLoading(true);
    try {
      const res = await getCourseReviews(courseId);
      setReviews(res.data);
      setReviewsTotal(res.meta.total);
      const mine = res.data.find((r) => r.userId === currentUserId) ?? null;
      if (mine) {
        setMyReview(mine);
        setReviewRating(mine.rating);
        setReviewComment(mine.comment ?? "");
      }
    } finally {
      setReviewsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!course?.id) return;
    setMyReview(null);
    setReviewMode("view");
    setReviewRating(5);
    setReviewComment("");
    loadReviews(course.id);
  }, [course?.id, loadReviews]);

  const handleSubmitReview = useCallback(async () => {
    if (!course?.id || reviewSubmitting) return;
    setReviewSubmitting(true);
    try {
      let saved: CourseReview;
      if (myReview) {
        saved = await updateReview(course.id, reviewRating, reviewComment || null);
      } else {
        try {
          saved = await createReview(course.id, reviewRating, reviewComment || undefined);
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 409) {
            saved = await updateReview(course.id, reviewRating, reviewComment || null);
          } else throw err;
        }
      }
      setMyReview(saved);
      setReviewMode("view");
      await loadReviews(course.id);
    } finally {
      setReviewSubmitting(false);
    }
  }, [course?.id, myReview, reviewRating, reviewComment, reviewSubmitting, loadReviews]);

  const handleDeleteReview = useCallback(async () => {
    if (!course?.id || !myReview) return;
    await deleteReview(course.id);
    setMyReview(null);
    setReviewRating(5);
    setReviewComment("");
    await loadReviews(course.id);
  }, [course?.id, myReview, loadReviews]);

  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoadingCourses) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7C3AED] border-t-transparent" />
      </div>
    );
  }

  if (!activeCourse || myCourses.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-gray-500 dark:text-gray-400">You have no enrolled courses yet.</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">Browse the Course Library to get started.</p>
      </div>
    );
  }

  return (
    <div className="my-learning-root flex flex-col lg:flex-row lg:h-[calc(100vh-3rem)] lg:overflow-hidden">
      {/* Hide the outer <main> scrollbar for the My Learning page only.
          This <style> unmounts on navigation, so it stays scoped to this page. */}
      <style>{`
        main:has(> div > .my-learning-root) { scrollbar-width: none; -ms-overflow-style: none; }
        main:has(> div > .my-learning-root)::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 p-6 space-y-6 lg:overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Video player */}
        {isLoadingPlayback ? (
          <div className="rounded-xl overflow-hidden bg-[#1a1a2e] shadow-lg">
            <div className="aspect-video flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#7C3AED] border-t-transparent" />
            </div>
          </div>
        ) : playbackSession ? (
          <VideoPlayer
            key={playbackSession.manifestUrl}
            manifestUrl={playbackSession.manifestUrl}
            lastPositionSeconds={playbackSession.lastPositionSeconds}
            onTimeUpdate={onTimeUpdate}
            onPause={onPause}
            onSeeked={onSeeked}
            onEnded={onEnded}
          />
        ) : activeLesson?.lessonType === "RESOURCE" && activeLesson.resource ? (
          <div className="rounded-xl overflow-hidden bg-[#1a1a2e] shadow-lg">
            <div className="aspect-video flex flex-col items-center justify-center gap-4">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.4">
                <rect x="8" y="4" width="32" height="40" rx="3" stroke="white" strokeWidth="2"/>
                <path d="M16 16h16M16 24h16M16 32h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="text-white/60 text-sm">Resource Lesson</p>
              <button
                onClick={() => openResource(activeLesson.id, activeLesson.resource!.id)}
                className="rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors"
              >
                Open Resource
              </button>
              {(lessonProgress[activeLesson.id]?.isCompleted ?? activeLesson.isCompleted) && (
                <p className="text-green-400 text-xs">✓ Completed</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden bg-[#1a1a2e] shadow-lg">
            <div className="aspect-video flex flex-col items-center justify-center gap-2">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.25">
                <circle cx="24" cy="24" r="20" stroke="white" strokeWidth="2"/>
                <path d="M20 17l12 7-12 7V17z" fill="white"/>
              </svg>
              <p className="text-white/40 text-sm mt-2">
                {activeLesson ? "Media not ready yet" : "Select a lesson to begin"}
              </p>
            </div>
          </div>
        )}

        {/* Course info card */}
        <div className="rounded-xl bg-white dark:bg-gray-901 border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          {isLoadingDetail ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-700" />
              <div className="h-6 w-3/4 rounded bg-gray-100 dark:bg-gray-700" />
              <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-700" />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase">
                  {course?.category ?? "Course"}
                </p>
                <button
                  onClick={handleBookmark}
                  disabled={bookmarking}
                  title={isBookmarked ? "Remove bookmark" : "Bookmark course"}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isBookmarked
                      ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-amber-500"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v13l-5-3-5 3V2z"/>
                  </svg>
                  {isBookmarked ? "Bookmarked" : "Bookmark"}
                </button>
              </div>

              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{course?.title}</h2>

              {courseDetail?.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{courseDetail.description}</p>
              )}

              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: "Lessons", value: String(course?.totalLessons ?? "—") },
                  { label: "Duration", value: formatDuration(course?.totalDurationSeconds ?? null) || "—" },
                  { label: "Rating", value: courseDetail?.ratingAvg ? `${courseDetail.ratingAvg.toFixed(1)} ★` : "—" },
                ].map((s) => (
                  <div key={s.label} className="text-center rounded-lg bg-gray-50 dark:bg-gray-700/50 py-3">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="mb-5">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">Your progress</span>
                  <span className="font-semibold text-[#7C3AED] dark:text-gray-000">{progress?.percentage ?? 0}% complete</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className="h-2 rounded-full bg-[#7C3AED] transition-all" style={{ width: `${progress?.percentage ?? 0}%` }} />
                </div>
              </div>

              <button
                onClick={() => activeLesson && selectLesson(activeLesson)}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#7C3AED] dark:bg-gray-000 dark:text-black px-5 py-3 text-sm font-semibold text-white hover:bg-[#6d28d9] dark:hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4 text-white dark:text-black" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 2l10 6-10 6V2z" fill="currentColor"/>
                </svg>
                {activeCourse?.lastPlayedLesson ? `Continue: ${activeCourse.lastPlayedLesson.title}` : "Start Course"}
              </button>
            </>
          )}
        </div>

        {/* Curriculum */}
        <div className="rounded-xl bg-white px-2  dark:bg-gray-901 border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Course Curriculum
            </h3>
          </div>

          {isLoadingDetail ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-6 py-4 animate-pulse">
                  <div className="h-4 w-48 rounded bg-gray-100 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700 space-y-1 space-x-1">
              {courseDetail?.modules.map((mod, idx) => {
                const isExpanded = expandedModule === mod.id || (expandedModule === null && idx === 0);
                return (
                  <div className="" key={mod.id}>
                    <button
                      onClick={() => setExpandedModule(isExpanded ? "" : mod.id)}
                      className="w-full flex items-center rounded-lg justify-between px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-905 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-bold">
                          {idx + 1}
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white text-left">{mod.title}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-400">{mod.lessons.length} lessons</span>
                        <svg
                          width="14" height="14" viewBox="0 0 14 14" fill="none"
                          className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        >
                          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-6 pb-3 space-y-1">
                        {mod.lessons.map((lesson) => {
                          const lp = lessonProgress[lesson.id];
                          const isActive = activeLesson?.id === lesson.id;
                          const isCompleted = lp?.isCompleted ?? lesson.isCompleted;
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => selectLesson(lesson)}
                              className={`w-full flex items-center justify-between py-2 pl-10 pr-2 rounded-lg transition-colors ${
                                isActive ? "bg-[#7C3AED]/10 dark:bg-gray-905" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <LessonIcon type={lesson.lessonType} isCompleted={isCompleted} isActive={isActive} />
                                <span className={`text-sm text-left ${isActive ? "text-[#7C3AED] font-medium" : "text-gray-700 dark:text-gray-300"}`}>
                                  {lesson.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {lesson.durationSeconds && (
                                  <span className="text-xs text-gray-400">{formatDuration(lesson.durationSeconds)}</span>
                                )}
                                {isCompleted && (
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <circle cx="7" cy="7" r="6" fill="#22C55E"/>
                                    <path d="M4.5 7l2 2 3-3" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right sidebar ──────────────────────────────────────────────────── */}
      <div className="lg:w-80 shrink-0 p-6 space-y-5 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 bg-[#f9f9f9] dark:bg-gray-901 lg:h-full lg:overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">

        {/* My Notes */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-700/50 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="12" height="12" rx="2"/>
              <path d="M5 6h6M5 9h4" strokeLinecap="round"/>
            </svg>
            My Notes
          </h4>
          <textarea
            value={noteContent || currentNote}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={4}
            placeholder={activeLesson ? "Add notes for this lesson..." : "Select a lesson to take notes"}
            disabled={!activeLesson}
            className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] dark:focus:border-gray-000 disabled:opacity-50"
          />
          <button
            onClick={() => saveNote(noteContent || currentNote)}
            disabled={isSavingNote || !activeLesson}
            className="mt-3 w-full rounded-lg bg-[#7C3AED] dark:bg-gray-000 dark:text-black px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {isSavingNote ? "Saving…" : "Save Note"}
          </button>
        </div>

        {/* Reviews */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-700/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-amber-400">
                <path d="M8 1l2.06 4.18L15 6.18l-3.5 3.41.83 4.82L8 12.1l-4.33 2.31.83-4.82L1 6.18l4.94-.72z"/>
              </svg>
              Reviews {reviewsTotal > 0 && <span className="text-gray-400 font-normal">({reviewsTotal})</span>}
            </h4>
            {reviewMode === "view" && !myReview && (
              <button
                onClick={() => setReviewMode("write")}
                className="text-xs text-[#7C3AED] dark:text-gray-000 hover:underline"
              >
                + Add
              </button>
            )}
          </div>

          {/* Write / Edit form */}
          {reviewMode === "write" && (
            <div className="mb-4 space-y-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setReviewRating(star)} className="text-xl leading-none">
                    <span className={star <= reviewRating ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}>★</span>
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Share your thoughts (optional)…"
                className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] dark:focus:border-gray-000"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSubmitReview}
                  disabled={reviewSubmitting}
                  className="flex-1 rounded-lg bg-[#7C3AED] dark:bg-gray-000 dark:text-black px-3 py-2 text-xs font-medium text-white hover:bg-[#6d28d9] dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {reviewSubmitting ? "Saving…" : myReview ? "Update" : "Submit"}
                </button>
                <button
                  onClick={() => setReviewMode("view")}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:border-gray-400 transition-colors"
                >
                  Cancel
                </button>
                {myReview && (
                  <button
                    onClick={handleDeleteReview}
                    className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}

          {/* My submitted review */}
          {reviewMode === "view" && myReview && (
            <div className="mb-3 rounded-lg border border-[#7C3AED]/20 bg-[#7C3AED]/5 p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map((s) => (
                    <span key={s} className={`text-sm ${s <= myReview.rating ? "text-amber-400" : "text-gray-300"}`}>★</span>
                  ))}
                </div>
                <button
                  onClick={() => setReviewMode("write")}
                  className="text-[10px] text-[#7C3AED] hover:underline"
                >
                  Edit
                </button>
              </div>
              {myReview.comment && (
                <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">{myReview.comment}</p>
              )}
              {!myReview.comment && (
                <p className="text-xs text-gray-400 italic">No comment added.</p>
              )}
            </div>
          )}

          {/* Review list */}
          {reviewsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse space-y-1.5">
                  <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-600" />
                  <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-600" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">No reviews yet. Be the first!</p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
              {reviews.filter((r) => r.id !== myReview?.id).map((r) => (
                <div key={r.id} className="border-b border-gray-100 dark:border-gray-600 pb-2 last:border-0 last:pb-0">
                  <div className="flex gap-0.5 mb-1">
                    {[1,2,3,4,5].map((s) => (
                      <span key={s} className={`text-xs ${s <= r.rating ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}`}>★</span>
                    ))}
                  </div>
                  {r.comment && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{r.comment}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructor */}
        {instructor && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-700/50 p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Instructor</h4>
            <div className="flex items-start gap-3 mb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {getInstructorInitials(instructor.name)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{instructor.name}</p>
                {instructor.role && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{instructor.role}</p>
                )}
              </div>
            </div>
            {instructor.bio && (
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-4">
                {instructor.bio}
              </p>
            )}
          </div>
        )}

        {/* Up Next */}
        {upNext.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Up Next</h4>
            <div className="space-y-3">
              {upNext.map((item) => (
                <button
                  key={item.course.id}
                  onClick={() => selectCourse(item)}
                  className="w-full flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 p-3 hover:border-[#7C3AED] transition-colors text-left"
                >
                  <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded bg-[#7C3AED]/10">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="#7C3AED" strokeWidth="1.5"/>
                      <path d="M6 5l6 3-6 3V5z" fill="#7C3AED"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.course.title}</p>
                    <p className="text-[11px] text-gray-400">
                      {item.course.category ?? "Course"} • {formatDuration(item.course.totalDurationSeconds) || "—"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LessonIcon({ type, isCompleted, isActive }: { type: "VIDEO" | "RESOURCE"; isCompleted: boolean; isActive: boolean }) {
  const color = isActive ? "#7C3AED" : isCompleted ? "#22C55E" : "currentColor";
  if (type === "RESOURCE") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-400 shrink-0">
        <rect x="2" y="1" width="10" height="12" rx="1.5" stroke={color} strokeWidth="1.2"/>
        <path d="M4 5h6M4 7.5h6M4 10h4" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-400 shrink-0">
      <circle cx="7" cy="7" r="6" stroke={color} strokeWidth="1.2"/>
      <path d="M5.5 4.5l5 2.5-5 2.5v-5z" fill={color}/>
    </svg>
  );
}
