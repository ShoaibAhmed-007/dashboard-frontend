"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LuArrowLeft, LuCalendarDays } from "react-icons/lu";
import MomDetailPage from "./MomDetailPage";
import { momService } from "@/services/mom.service";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { useMomAccessGuard } from "./useMomAccessGuard";
import { meetingsListHref } from "./momRoutes";

/** Shared chrome for "there is nothing to show", whatever the reason. */
function MomNotice({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
        <LuCalendarDays className="h-7 w-7 text-gray-400" />
      </span>
      <div>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <LuArrowLeft className="h-4 w-4" />
        All meetings
      </button>
    </div>
  );
}

/**
 * Resolves `/meetings/[momId]` to a meeting.
 *
 * Split from `MomDetailPage` so that component takes a `Meeting` and knows
 * nothing about routing or fetching — the fetch lives here alone.
 */
export default function MomDetailRoute() {
  const params = useParams<{ momId: string }>();
  const router = useRouter();
  const blocked = useMomAccessGuard();

  const query = useQuery({
    queryKey: queryKeys.mom(params.momId),
    queryFn: () => momService.getById(params.momId),
    enabled: Boolean(params.momId) && !blocked,
    staleTime: 60_000,
    /* Progress and "late" are computed from the tasks' own statuses, which are
       changed on other screens (task panel, board) that never touch this
       cache. Refetch on every visit — the cached copy still paints instantly. */
    refetchOnMount: "always",
    /* A missing meeting is an answer, not a transient failure — retrying a
       404 three times just delays the empty state. */
    retry: (failureCount, error) =>
      parseApiError(error).code === "NOT_FOUND" ? false : failureCount < 2,
  });

  // The guard is redirecting; render nothing rather than flashing a 403.
  if (blocked) return null;

  if (query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    const notFound = parseApiError(query.error).code === "NOT_FOUND";
    return (
      <MomNotice
        title={notFound ? "Meeting not found" : "Couldn't load this meeting"}
        description={
          notFound
            ? "It may have been deleted, or the link is out of date."
            : "Something went wrong fetching it. Try again from the list."
        }
        onBack={() => router.push(meetingsListHref())}
      />
    );
  }

  return <MomDetailPage mom={query.data} />;
}
