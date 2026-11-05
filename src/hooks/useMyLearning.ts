"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { useUniversityStore } from "@/stores/university.store";
import { useInvalidateUniversityCache } from "@/hooks/useInvalidateUniversityCache";
import { queryKeys } from "@/queries/keys";
import {
  getMyCourses,
  getCourseDetail,
  getPlaybackSession,
  sendProgressTick,
  getLessonNote,
  saveLessonNote,
  getResourceUrl,
  completeLesson,
  type MyCourse,
  type LessonSummary,
  type LessonProgressResponse,
} from "@/services/university.service";

export function useMyLearning() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const searchParams = useSearchParams();
  const targetCourseId = searchParams.get("courseId");
  const { setActiveCourse, clearActiveCourse } = useUniversityStore();
  const { invalidateDashboard } = useInvalidateUniversityCache();
  const queryClient = useQueryClient();

  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<LessonSummary | null>(null);
  const [lessonProgress, setLessonProgress] = useState<Record<string, LessonProgressResponse>>({});
  const [resourceOpened, setResourceOpened] = useState<Record<string, boolean>>({});
  const [isSavingNote, setIsSavingNote] = useState(false);

  // ── Step 1: Enrolled courses ─────────────────────────────────────────────────
  const coursesQuery = useQuery({
    queryKey: queryKeys.universityMyCourses(),
    queryFn: () => getMyCourses(1, 20),
    enabled: !!accessToken,
    staleTime: 5 * 60_000,
  });
  const myCourses = coursesQuery.data?.data ?? [];

  useEffect(() => {
    if (!coursesQuery.data || activeCourseId) return;
    const courses = coursesQuery.data.data;
    const active =
      (targetCourseId ? courses.find((c) => c.course.id === targetCourseId) : null) ??
      courses[0] ??
      null;
    if (active) setActiveCourseId(active.course.id);
  }, [coursesQuery.data, targetCourseId, activeCourseId]);

  useEffect(() => clearActiveCourse, [clearActiveCourse]);

  const activeCourse: MyCourse | null =
    myCourses.find((c) => c.course.id === activeCourseId) ?? null;

  // ── Step 2: Course detail for the active course ─────────────────────────────
  const courseDetailQuery = useQuery({
    queryKey: queryKeys.universityCourseDetail(activeCourseId ?? ""),
    queryFn: () => getCourseDetail(activeCourseId!),
    enabled: !!activeCourseId,
    staleTime: 5 * 60_000,
  });
  const courseDetail = courseDetailQuery.data ?? null;

  // Pick the default lesson (lastPlayedLesson, or first lesson) whenever the
  // course detail changes to a new course.
  useEffect(() => {
    if (!courseDetail) return;
    setActiveCourse(courseDetail.title, courseDetail.description ?? null);

    const lastId = activeCourse?.lastPlayedLesson?.id;
    let defaultLesson: LessonSummary | null = null;
    for (const mod of courseDetail.modules) {
      for (const lesson of mod.lessons) {
        if (!defaultLesson) defaultLesson = lesson;
        if (lesson.id === lastId) {
          defaultLesson = lesson;
          break;
        }
      }
    }
    setActiveLesson(defaultLesson);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseDetail]);

  // ── Step 3: Playback session + note for the active lesson ──────────────────
  const isVideoReady =
    activeLesson?.lessonType === "VIDEO" && activeLesson.mediaAsset?.status === "READY";

  const playbackQuery = useQuery({
    queryKey: queryKeys.universityPlaybackSession(activeLesson?.id ?? ""),
    queryFn: () => getPlaybackSession(activeLesson!.id),
    enabled: !!activeLesson && isVideoReady,
  });
  const playbackSession = isVideoReady ? playbackQuery.data ?? null : null;

  const noteQuery = useQuery({
    queryKey: queryKeys.universityLessonNote(activeLesson?.id ?? ""),
    queryFn: () => getLessonNote(activeLesson!.id),
    enabled: !!activeLesson,
  });
  const note = noteQuery.data ?? null;

  // Progress ticks read from `watchedFromRef.current`, which must reflect the
  // server's last known position as soon as a fresh playback session loads.
  const watchedFromRef = useRef<number>(0);
  const lastTickAtRef = useRef<number>(0);
  const activeLessonRef = useRef<LessonSummary | null>(null);
  useEffect(() => {
    activeLessonRef.current = activeLesson;
  }, [activeLesson]);
  useEffect(() => {
    if (playbackQuery.data) watchedFromRef.current = playbackQuery.data.lastPositionSeconds;
  }, [playbackQuery.data]);

  const applyProgressResult = useCallback(
    (lessonId: string, res: LessonProgressResponse) => {
      setLessonProgress((p) => ({ ...p, [lessonId]: res }));
      if (activeCourseId) {
        queryClient.setQueryData(
          queryKeys.universityMyCourses(),
          (prev: Awaited<ReturnType<typeof getMyCourses>> | undefined) =>
            prev && {
              ...prev,
              data: prev.data.map((c) =>
                c.course.id === activeCourseId ? { ...c, myProgress: res.courseProgress } : c
              ),
            }
        );
      }
      invalidateDashboard();
    },
    [activeCourseId, invalidateDashboard, queryClient]
  );

  // ── Progress tick flush ─────────────────────────────────────────────────────
  const flushTick = useCallback(
    (currentTime: number, duration: number) => {
      const lesson = activeLessonRef.current;
      if (!lesson || lesson.lessonType !== "VIDEO") return;

      const watchedFrom = watchedFromRef.current;
      const watchedTo = Math.min(currentTime, watchedFrom + 60); // max 60s per interval

      if (watchedTo <= watchedFrom) return;

      // Rate limit: skip if last tick was < 5s ago
      const now = Date.now();
      if (now - lastTickAtRef.current < 5000) return;
      lastTickAtRef.current = now;

      watchedFromRef.current = currentTime;

      sendProgressTick(lesson.id, { currentTime, duration, watchedFrom, watchedTo })
        .then((res) => applyProgressResult(lesson.id, res))
        .catch(() => {}); // silent — ticks are best-effort
    },
    [applyProgressResult]
  );

  // ── Player event handlers (passed to VideoPlayer) ───────────────────────────
  const onTimeUpdate = useCallback((currentTime: number, duration: number) => {
    if (currentTime - watchedFromRef.current >= 10) {
      flushTick(currentTime, duration);
    }
  }, [flushTick]);

  const onPause = useCallback((currentTime: number, duration: number) => {
    flushTick(currentTime, duration);
  }, [flushTick]);

  const onSeeked = useCallback((currentTime: number, duration: number) => {
    watchedFromRef.current = currentTime; // reset watched start on seek
    flushTick(currentTime, duration);
  }, [flushTick]);

  const onEnded = useCallback((duration: number) => {
    // Bypass rate limit for final flush on video end
    lastTickAtRef.current = 0;
    flushTick(duration, duration);

    const lesson = activeLessonRef.current;
    if (!lesson) return;

    // Explicitly complete both VIDEO and RESOURCE lessons when the media ends.
    // VIDEO also auto-completes server-side at 90% via ticks; the call is idempotent.
    completeLesson(lesson.id)
      .then((res) => applyProgressResult(lesson.id, res))
      .catch(() => {});
  }, [flushTick, applyProgressResult]);

  // ── Select lesson ───────────────────────────────────────────────────────────
  const selectLesson = useCallback((lesson: LessonSummary) => {
    setActiveLesson(lesson);
    watchedFromRef.current = 0;
  }, []);

  // ── Select course ───────────────────────────────────────────────────────────
  const selectCourse = useCallback((course: MyCourse) => {
    setActiveCourseId(course.course.id);
  }, []);

  // ── Save note ───────────────────────────────────────────────────────────────
  const saveNote = useCallback(
    async (content: string) => {
      if (!activeLesson) return;
      setIsSavingNote(true);
      try {
        const updated = await saveLessonNote(activeLesson.id, content);
        queryClient.setQueryData(queryKeys.universityLessonNote(activeLesson.id), updated);
      } finally {
        setIsSavingNote(false);
      }
    },
    [activeLesson, queryClient]
  );

  // ── Open resource ───────────────────────────────────────────────────────────
  const openResource = useCallback(async (lessonId: string, resourceId: string) => {
    const { url } = await getResourceUrl(lessonId, resourceId);
    window.open(url, "_blank", "noopener,noreferrer");
    // Record that the resource URL was opened — required precondition before /complete
    setResourceOpened((p) => ({ ...p, [lessonId]: true }));
  }, []);

  // ── Explicit lesson completion (RESOURCE and VIDEO) ─────────────────────────
  const completeResourceLesson = useCallback(
    async (lessonId: string) => {
      const res = await completeLesson(lessonId);
      applyProgressResult(lessonId, res);
    },
    [applyProgressResult]
  );

  const isLoadingCourses = coursesQuery.isLoading;
  const isLoadingDetail = courseDetailQuery.isLoading;
  const isLoadingPlayback = isVideoReady && playbackQuery.isLoading;
  const error =
    coursesQuery.error
      ? "Failed to load your courses"
      : courseDetailQuery.error
      ? "Failed to load course details"
      : null;

  return {
    myCourses,
    activeCourse,
    courseDetail,
    activeLesson,
    playbackSession,
    lessonProgress,
    resourceOpened,
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
    completeResourceLesson,
    onTimeUpdate,
    onPause,
    onSeeked,
    onEnded,
  };
}
