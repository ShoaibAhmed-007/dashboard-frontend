"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/keys";
import { projectService } from "@/services/project.service";
import { useProjects } from "@/context/ProjectContext";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import type { MemberOption } from "@/components/projects/AssigneePicker";

/**
 * The people who may be assigned to a task, or @-mentioned, in one project.
 *
 * On a PUBLIC project that's the whole workspace, exactly as before. On a
 * PRIVATE one the backend rejects any assignee who isn't a project member
 * (`USER_NOT_PROJECT_MEMBER`), so offering the full roster would let the user
 * pick someone the server then refuses — this narrows the list to match.
 *
 * PUBLIC costs no extra requests. Visibility is read from the project list
 * already in the React Query cache (`ProjectContext` holds it with a 5-minute
 * staleTime), so there's no request to *learn* the visibility, and the
 * `/members` call is skipped entirely unless the project is private.
 */
export function useProjectMembers(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { projects } = useProjects();
  const {
    members: workspaceMembers,
    isLoading: isWorkspaceLoading,
    refetch: refetchWorkspace,
  } = useWorkspaceMembers();

  const project = projects.find((p) => p.id === projectId) ?? null;
  const isPrivate = project?.visibility === "PRIVATE";

  const query = useQuery({
    queryKey: queryKeys.projectMembers(projectId ?? ""),
    queryFn: () => projectService.listMembers(projectId!),
    enabled: Boolean(projectId) && isPrivate,
    staleTime: 60_000,
  });

  /* Flattened to the shape the pickers consume. While the project list is
     still loading `project` is null, so this falls back to the workspace
     roster — a brief over-permissive window in the picker only; the backend
     still rejects an invalid assignee, and callers surface that. */
  const members = useMemo<MemberOption[]>(() => {
    if (!isPrivate) return workspaceMembers;
    return (query.data ?? []).map((m) => ({
      id: m.user.id,
      fullName: m.user.fullName,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      avatarColor: m.user.avatarColor ?? "#6366f1",
    }));
  }, [isPrivate, workspaceMembers, query.data]);

  return {
    members,
    isPrivate,
    isLoading: isPrivate ? query.isLoading : isWorkspaceLoading,
    /** Refreshes whichever list is actually in play, so callers that pass this
     *  straight to an `onOpen` handler keep working on both project types. */
    refetch: () =>
      isPrivate && projectId
        ? queryClient.invalidateQueries({
            queryKey: queryKeys.projectMembers(projectId),
          })
        : refetchWorkspace(),
  };
}
