"use client";

import {
  BookOpenIcon,
  Clock3Icon,
  PlaySquareIcon,
  TrophyIcon,
  UserCheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card/card";
import { Progress } from "@/components/ui/progress/progress";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUniversityDashboard } from "@/hooks/useUniversityDashboard";
import {
  formatLearningTime,
  formatDuration,
  getCourseBadge,
  getInstructorInitials,
  getGreeting,
} from "@/services/university.service";

export default function UniversityDashboard() {
  const { user } = useAuth();
  const { stats, myCourses, isLoading, error } = useUniversityDashboard();
  const router = useRouter();

  const firstName = user?.fullName?.split(" ")[0] ?? "there";
  const greeting = getGreeting();

  // ── Stat cards built from live data ──────────────────────────────────────
  const statCards = stats
    ? [
        {
          icon: BookOpenIcon,
          iconWrapperClassName: "bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400",
          value: String(stats.coursesInProgress),
          label: "Courses in Progress",
          badge: `${stats.deltas.coursesInProgress > 0 ? `↑ ${stats.deltas.coursesInProgress}` : stats.deltas.coursesInProgress} this week`,
          badgeClassName: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
        },
        {
          icon: UserCheckIcon,
          iconWrapperClassName: "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400",
          value: String(stats.completed),
          label: "Courses Completed",
          badge: `↑ ${stats.deltas.completed} this month`,
          badgeClassName: "bg-emerald-100 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400",
        },
        {
          icon: Clock3Icon,
          iconWrapperClassName: "bg-violet-50 text-violet-500 dark:bg-violet-900/30 dark:text-violet-400",
          value: formatLearningTime(stats.totalLearningSeconds),
          label: "Total Learning Time",
          badge: `↑ ${formatLearningTime(stats.deltas.totalLearningSeconds)} this week`,
          badgeClassName: "bg-emerald-100 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400",
        },
        {
          icon: TrophyIcon,
          iconWrapperClassName: "bg-orange-50 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400",
          value: String(stats.certificatesEarned),
          label: "Certificates Earned",
          badge: `↑ ${stats.deltas.certificatesEarned} this month`,
          badgeClassName: "bg-emerald-100 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400",
        },
      ]
    : null;

  return (
    <section className="relative w-full flex-1 self-stretch bg-white dark:bg-gray-900">
      <div className="mx-auto flex w-full max-w-full flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-10">
        <main className="flex w-full flex-col gap-6">

          {/* Hero banner */}
          <Card className="relative overflow-hidden rounded-2xl border-0 bg-[linear-gradient(137deg,rgba(46,31,94,1)_0%,rgba(74,52,155,1)_100%)] shadow-none">
            <div className="pointer-events-none absolute bottom-[-100px] right-[150px] h-[200px] w-[200px] rounded-[100px] [background:radial-gradient(50%_50%_at_50%_50%,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0)_70%)]" />
            <div className="pointer-events-none absolute right-[-50px] top-[-50px] h-[300px] w-[300px] rounded-[150px] [background:radial-gradient(50%_50%_at_50%_50%,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0)_70%)]" />
            <CardContent className="flex flex-col gap-6 px-6 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
              <div className="flex max-w-[560px] flex-col items-start gap-[7.3px]">
                <p className="font-['Inter',Helvetica] text-[14.4px] font-normal leading-[21.6px] tracking-[0] text-gray-300">
                  {greeting}
                </p>
                <h2 className="font-['Inter',Helvetica] text-[28.8px] font-bold leading-[normal] tracking-[0] text-white">
                  Ready to learn today, {firstName}?
                </h2>
                <p className="font-['Inter',Helvetica] text-[14.4px] font-normal leading-[21.6px] tracking-[0] text-gray-300">
                  {stats
                    ? `You have ${stats.coursesInProgress} course${stats.coursesInProgress !== 1 ? "s" : ""} in progress. Keep the momentum going!`
                    : "Keep the momentum going!"}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => router.push("/university/my-learning")}
                className="h-auto self-start rounded-lg border border-[#ffffff4c] bg-[#ffffff26] px-5 py-2.5 font-['Inter',Helvetica] text-[14.4px] font-medium tracking-[0] text-white backdrop-blur-[2px] backdrop-brightness-[100%] hover:bg-[#ffffff30] lg:self-center"
              >
                Continue Learning →
              </Button>
            </CardContent>
          </Card>

          {/* Stat cards */}
          <section
            aria-label="Dashboard statistics"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
          >
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="rounded-2xl border border-[#e8eaed] bg-white shadow-none dark:border-gray-700 dark:bg-gray-800">
                    <CardContent className="flex h-full flex-col items-start gap-1 p-6">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
                      <div className="h-8 w-16 mt-3 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                      <div className="h-4 w-32 mt-1 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                    </CardContent>
                  </Card>
                ))
              : (statCards ?? []).map((card) => {
                  const Icon = card.icon;
                  return (
                    <Card
                      key={card.label}
                      className="rounded-2xl border border-[#e8eaed] bg-[#f9f9f9] shadow-none dark:border-gray-700 dark:bg-gray-901"
                    >
                      <CardContent className="flex h-full flex-col items-start gap-1 p-6">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconWrapperClassName}`}>
                          <Icon className="h-[19.2px] w-[19.2px]" />
                        </div>
                        <div className="w-full pt-3">
                          <div className="font-['Inter',Helvetica] text-[32px] font-bold leading-[normal] tracking-[0] text-gray-800 dark:text-white">
                            {card.value}
                          </div>
                        </div>
                        <p className="font-['Inter',Helvetica] text-[13.6px] font-normal leading-[normal] tracking-[0] text-gray-500 dark:text-gray-400">
                          {card.label}
                        </p>
                        <div className={`mt-1 inline-flex items-start rounded px-2 py-1 font-['Inter',Helvetica] text-xs font-normal leading-[normal] tracking-[0] ${card.badgeClassName}`}>
                          {card.badge}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
          </section>

          {/* Continue Learning */}
          <section className="flex flex-col gap-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-['Inter',Helvetica] text-[17.6px] font-normal leading-[normal] tracking-[0] text-gray-800 dark:text-white">
                Continue Learning
              </h3>
              <button
                type="button"
                onClick={() => router.push("/university/course-library")}
                className="font-['Inter',Helvetica] text-[13.6px] font-medium leading-[normal] tracking-[0] text-[#8920fe]"
              >
                View Library →
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-none dark:border-gray-700 dark:bg-gray-800">
                      <div className="h-[140px] w-full bg-gray-100 dark:bg-gray-700 animate-pulse" />
                      <CardContent className="flex flex-col gap-3 p-5">
                        <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        <div className="h-1.5 w-full rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                      </CardContent>
                    </Card>
                  ))
                : myCourses.length === 0
                ? (
                    <p className="col-span-3 text-sm text-gray-500 dark:text-gray-400">
                      No courses in progress yet. Browse the library to get started.
                    </p>
                  )
                : myCourses.map((item) => {
                    const { course, myProgress } = item;
                    const badge = getCourseBadge(course);
                    const progress = myProgress?.percentage ?? 0;
                    const completed = myProgress?.completedRequiredLessons ?? 0;
                    const total = myProgress?.totalRequiredLessons ?? course.totalLessons;
                    const initials = getInstructorInitials(course.instructor?.name);
                    const duration = formatDuration(course.totalDurationSeconds);

                    return (
                      <Card
                        key={course.id}
                        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-none dark:border-gray-700 dark:bg-gray-901"
                      >
                        <CardContent className="p-0">
                          {/* Thumbnail */}
                          <div
                            className="relative h-[140px] w-full bg-cover bg-center bg-no-repeat bg-gray-200 dark:bg-gray-700"
                            style={course.coverImageUrl ? { backgroundImage: `url(${course.coverImageUrl})` } : undefined}
                          >
                            {badge.label && (
                              <div className={`absolute left-3 top-3 inline-flex items-start rounded px-2 py-1 ${badge.className}`}>
                                <span className="font-['Inter',Helvetica] text-[10.4px] font-bold leading-[normal] tracking-[0] text-white">
                                  {badge.label}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 p-5">
                            <div className="flex flex-col gap-2">
                              <p className="font-['Inter',Helvetica] text-[11.2px] font-normal leading-[normal] tracking-[0] text-indigo-500">
                                {course.category ?? "COURSE"}
                              </p>
                              <h4 className="font-['Inter',Helvetica] text-base font-normal leading-[normal] tracking-[0] text-gray-800 dark:text-white line-clamp-2">
                                {course.title}
                              </h4>
                            </div>

                            <div className="flex items-center gap-4 pt-1">
                              <div className="inline-flex items-center gap-1">
                                <PlaySquareIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                <span className="font-['Inter',Helvetica] text-[12.8px] font-normal leading-[normal] tracking-[0] text-gray-500 dark:text-gray-400">
                                  {course.totalLessons} lessons
                                </span>
                              </div>
                              {duration && (
                                <div className="inline-flex items-center gap-1">
                                  <Clock3Icon className="h-[12.8px] w-[12.8px] text-gray-500 dark:text-gray-400" />
                                  <span className="font-['Inter',Helvetica] text-[12.8px] font-normal leading-[normal] tracking-[0] text-gray-500 dark:text-gray-400">
                                    {duration}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2 py-2">
                              <Progress value={progress} className="h-1 rounded-sm bg-gray-100 dark:bg-gray-700" />
                              <div className="flex items-start justify-between">
                                <span className="font-['Inter',Helvetica] text-xs font-normal leading-[normal] tracking-[0] text-gray-500 dark:text-gray-400">
                                  {completed} of {total} completed
                                </span>
                                <span className="font-['Inter',Helvetica] text-xs font-normal leading-[normal] tracking-[0] text-indigo-500">
                                  {progress}%
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700">
                              <div className="inline-flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-blue-500">
                                  <span className="font-['Inter',Helvetica] text-[9.6px] font-bold leading-[normal] tracking-[0] text-white">
                                    {initials}
                                  </span>
                                </div>
                                <span className="font-['Inter',Helvetica] text-[12.8px] font-normal leading-[normal] tracking-[0] text-gray-500 dark:text-gray-400">
                                  {course.instructor?.name ?? "Instructor"}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => router.push(`/university/my-learning?courseId=${course.id}`)}
                                className="h-auto rounded-md bg-[#8b5cf629] px-3 py-1.5 font-['Inter',Helvetica] text-[12.8px] font-normal tracking-[0] text-violet-500 hover:bg-[#8b5cf640] hover:text-violet-500 dark:bg-violet-900/20 dark:hover:bg-violet-900/40"
                              >
                                Resume →
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
            </div>
          </section>

        </main>
      </div>
    </section>
  );
}
