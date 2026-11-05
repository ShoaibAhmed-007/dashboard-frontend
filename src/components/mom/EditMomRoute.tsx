"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LuArrowLeft, LuCalendarDays } from "react-icons/lu";
import EditMomPage from "./EditMomPage";
import { useMomAccessGuard } from "./useMomAccessGuard";
import { momService } from "@/services/mom.service";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { meetingsListHref } from "./momRoutes";

function Notice({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
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
        onClick={onAction}
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <LuArrowLeft className="h-4 w-4" />
        {actionLabel}
      </button>
    </div>
  );
}

/**
 * Resolves `/meetings/[momId]/edit`.
 *
 * Two gates, because the API has two: OWNER/MANAGER for the module at all, and
 * **creator-only** for update. A manager who did not create this meeting can
 * read it but would get a 403 on save, so they are told here rather than after
 * filling the form in.
 */
export default function EditMomRoute() {
  const params = useParams<{ momId: string }>();
  const router = useRouter();
  const blocked = useMomAccessGuard();
  const selfId = useAuthStore((state) => state.user?.id);

  const query = useQuery({
    queryKey: queryKeys.mom(params.momId),
    queryFn: () => momService.getById(params.momId),
    enabled: Boolean(params.momId) && !blocked,
    staleTime: 60_000,
    retry: (failureCount, error) =>
      parseApiError(error).code === "NOT_FOUND" ? false : failureCount < 2,
  });

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
      <Notice
        title={notFound ? "Meeting not found" : "Couldn't load this meeting"}
        description={
          notFound
            ? "It may have been deleted, or the link is out of date."
            : "Something went wrong fetching it. Try again from the list."
        }
        actionLabel="All meetings"
        onAction={() => router.push(meetingsListHref())}
      />
    );
  }

  /* Mirrors the server's own rule rather than guessing at it: `createdBy` is
     the creator's user id, and update/delete are creator-only. */
  if (query.data.createdBy !== selfId) {
    return (
      <Notice
        title="Only the creator can edit this meeting"
        description={`${query.data.creator.fullName} created it. You can still read it and open its follow-up tasks.`}
        actionLabel="Back to meeting"
        onAction={() => router.push(`/meetings/${params.momId}`)}
      />
    );
  }

  return <EditMomPage meeting={query.data} />;
}
