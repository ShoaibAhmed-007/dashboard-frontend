"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, parseApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { userService } from "@/services/user.service";
import { queryKeys } from "@/queries/keys";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  designation: string | null;
  profilePicture: string | null;
  status: "ONLINE" | "OFFLINE";
  bio: string | null;
  timezone: string | null;
  showLocalTime: boolean;
  localTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateProfilePayload = Partial<
  Pick<UserProfile, "fullName" | "designation" | "bio" | "timezone" | "showLocalTime" | "status">
>;

export function useProfile() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: async () => {
      const { data } = await api.get<UserProfile>("/user/profile");
      return data;
    },
    enabled: !!accessToken,
    staleTime: 5 * 60_000,
  });

  const fetch = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
  };

  const update = async (payload: UpdateProfilePayload) => {
    const { data } = await api.patch<UserProfile>("/user/profile", payload);
    queryClient.setQueryData(queryKeys.profile(), data);
  };

  const reset = () => queryClient.removeQueries({ queryKey: queryKeys.profile() });

  /* Presign → PUT → PATCH, then keep the two copies of the avatar in step:
     the profile cache (what most of the app reads) and the auth store's
     session user (read by the header before the profile has loaded). Without
     the second write the old picture lingers in the corner until sign-in. */
  const syncAuthAvatar = (avatarUrl: string | null) => {
    const { user, accessToken: token, role, setAuth } = useAuthStore.getState();
    if (!user || !token) return;
    setAuth(token, { ...user, avatarUrl }, role ?? undefined);
  };

  const uploadAvatar = async (file: File) => {
    const updated = await userService.uploadAvatar(file);
    queryClient.setQueryData(queryKeys.profile(), updated);
    syncAuthAvatar(updated.profilePicture);
    return updated;
  };

  const removeAvatar = async () => {
    const name = query.data?.fullName ?? "User";
    const updated = await userService.removeAvatar(name);
    queryClient.setQueryData(queryKeys.profile(), updated);
    syncAuthAvatar(updated.profilePicture);
    return updated;
  };

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error ? parseApiError(query.error).message : null,
    fetch,
    update,
    uploadAvatar,
    removeAvatar,
    reset,
  };
}

// Preserved alias — some call sites import useProfileStore directly.
export const useProfileStore = useProfile;
