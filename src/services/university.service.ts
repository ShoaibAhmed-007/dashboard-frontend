import { uGet, uGetPaginated, uPost, universityApi } from "@/lib/universityApi";

// ── Dashboard stats ───────────────────────────────────────────────────────────

export interface DashboardStats {
  coursesInProgress: number;
  completed: number;
  totalLearningSeconds: number;
  certificatesEarned: number;
  deltas: {
    windowDays: number;
    coursesInProgress: number;
    completed: number;
    totalLearningSeconds: number;
    certificatesEarned: number;
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return uGet<DashboardStats>("/lms/me/dashboard-stats");
}

// ── My courses ────────────────────────────────────────────────────────────────

export interface CourseProgress {
  percentage: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  isCompleted: boolean;
  completedRequiredLessons: number;
  totalRequiredLessons: number;
}

export interface MyCourse {
  enrollment: { id: string; status: string; enrolledAt: string };
  course: {
    id: string;
    title: string;
    slug: string;
    coverImageUrl: string | null;
    category: string | null;
    isMandatory: boolean;
    popular: boolean;
    isNew: boolean;
    instructor: { name: string; role?: string; bio?: string | null; avatarUrl?: string | null } | null;
    totalLessons: number;
    totalDurationSeconds: number | null;
  };
  myProgress: CourseProgress | null;
  lastPlayedLesson: { id: string; title: string } | null;
  lastActivityAt: string | null;
}

export async function getMyCourses(page = 1, pageSize = 3) {
  return uGetPaginated<MyCourse>("/lms/my-courses", { page, pageSize });
}

// ── Course catalog ────────────────────────────────────────────────────────────

export interface CatalogCourse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  category: string | null;
  isMandatory: boolean;
  popular: boolean;
  isNew: boolean;
  totalLessons: number;
  totalDurationSeconds: number | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  instructor: { name: string; role?: string; bio?: string | null; avatarUrl?: string | null } | null;
  myProgress: CourseProgress | null;
  isBookmarked: boolean;
}

export interface CoursesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  mandatory?: boolean;
  bookmarked?: boolean;
}

export async function getCourses(params: CoursesParams = {}) {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null)
  ) as Record<string, unknown>;
  return uGetPaginated<CatalogCourse>("/lms/courses", cleaned);
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatLearningTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function getCourseBadge(course: MyCourse["course"]): { label: string; className: string } {
  if (course.isMandatory) return { label: "MANDATORY", className: "bg-red-500" };
  if (course.popular)     return { label: "POPULAR",   className: "bg-amber-500" };
  if (course.isNew)       return { label: "NEW",        className: "bg-emerald-500" };
  return { label: "", className: "" };
}

export function getInstructorInitials(name: string | null | undefined): string {
  if (!name) return "??";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  return "Good evening,";
}

// ── Course detail ─────────────────────────────────────────────────────────────

export interface LessonSummary {
  id: string;
  title: string;
  sortOrder: number;
  lessonType: "VIDEO" | "RESOURCE";
  required: boolean;
  durationSeconds: number | null;
  mediaAsset: { id: string; status: "PENDING" | "READY" | "FAILED"; durationSeconds: number | null } | null;
  resource: { id: string; title: string } | null;
  isCompleted: boolean;
}

export interface ModuleSummary {
  id: string;
  title: string;
  sortOrder: number;
  lessons: LessonSummary[];
}

export interface CourseDetail extends CatalogCourse {
  modules: ModuleSummary[];
}

export async function getCourseDetail(courseId: string): Promise<CourseDetail> {
  return uGet<CourseDetail>(`/lms/courses/${courseId}`);
}

// POST /lms/courses/:courseId/enroll — idempotent, safe to repeat
export interface EnrollmentResult {
  id: string;
  status: string;
  enrolledAt: string;
  courseProgress: CourseProgress;
}

export async function enrollCourse(courseId: string): Promise<EnrollmentResult> {
  return uPost<EnrollmentResult>(`/lms/courses/${courseId}/enroll`);
}

// ── Playback session ──────────────────────────────────────────────────────────

export interface PlaybackSession {
  manifestUrl: string;
  durationSeconds: number | null;
  lastPositionSeconds: number;
  expiresAt: string;
}

export async function getPlaybackSession(lessonId: string): Promise<PlaybackSession> {
  return uPost<PlaybackSession>(`/lms/lessons/${lessonId}/playback-session`);
}

// ── Progress ticks ────────────────────────────────────────────────────────────

export interface ProgressTick {
  currentTime: number;
  duration: number;
  watchedFrom: number;
  watchedTo: number;
}

export interface LessonProgressResponse {
  lessonId: string;
  watchedSeconds: number;
  watchedPercentage: number;
  isCompleted: boolean;
  completedAt: string | null;
  lastPositionSeconds: number;
  courseProgress: CourseProgress;
}

export async function sendProgressTick(lessonId: string, tick: ProgressTick): Promise<LessonProgressResponse> {
  return uPost<LessonProgressResponse>(`/lms/lessons/${lessonId}/progress`, tick);
}

// ── Resource lessons ──────────────────────────────────────────────────────────

export interface ResourceUrl {
  url: string;
  expiresAt: string;
}

export async function getResourceUrl(lessonId: string, resourceId: string): Promise<ResourceUrl> {
  return uGet<ResourceUrl>(`/lms/lessons/${lessonId}/resource/${resourceId}/url`);
}

export async function completeLesson(lessonId: string): Promise<LessonProgressResponse> {
  return uPost<LessonProgressResponse>(`/lms/lessons/${lessonId}/complete`);
}

// ── Lesson notes ──────────────────────────────────────────────────────────────

export interface LessonNote {
  lessonId: string;
  courseId: string;
  content: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function getLessonNote(lessonId: string): Promise<LessonNote> {
  return uGet<LessonNote>(`/lms/lessons/${lessonId}/notes`);
}

export async function saveLessonNote(lessonId: string, content: string): Promise<LessonNote> {
  const res = await universityApi.put<{ data: LessonNote }>(`/lms/lessons/${lessonId}/notes`, { content });
  return res.data.data;
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export interface BookmarkResult {
  courseId: string;
  bookmarked: boolean;
}

export async function bookmarkCourse(courseId: string): Promise<BookmarkResult> {
  return uPost<BookmarkResult>(`/lms/courses/${courseId}/bookmark`);
}

export async function removeBookmark(courseId: string): Promise<BookmarkResult> {
  const res = await universityApi.delete<{ data: BookmarkResult }>(`/lms/courses/${courseId}/bookmark`);
  return res.data.data;
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface CourseReview {
  id: string;
  userId: string;
  courseId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewsPage {
  data: CourseReview[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function getCourseReviews(courseId: string, page = 1, pageSize = 5): Promise<ReviewsPage> {
  const res = await universityApi.get<ReviewsPage>(`/lms/courses/${courseId}/reviews`, { params: { page, pageSize } });
  return res.data;
}

export async function createReview(courseId: string, rating: number, comment?: string): Promise<CourseReview> {
  return uPost<CourseReview>(`/lms/courses/${courseId}/reviews`, { rating, ...(comment ? { comment } : {}) });
}

export async function updateReview(courseId: string, rating?: number, comment?: string | null): Promise<CourseReview> {
  const res = await universityApi.patch<{ data: CourseReview }>(`/lms/courses/${courseId}/reviews/mine`, { rating, comment });
  return res.data.data;
}

export async function deleteReview(courseId: string): Promise<void> {
  await universityApi.delete(`/lms/courses/${courseId}/reviews/mine`);
}
