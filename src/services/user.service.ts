import { api } from "@/lib/api";
/* `import type` matters here: useProfile imports this service back, and a
   value import would make that cycle real at runtime. Types are erased. */
import type { UserProfile } from "@/hooks/useProfile";

/** What the server will accept for an avatar — mirrors AVATAR_ALLOWED_MIME_TYPES. */
export const AVATAR_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** Advisory server-side, enforced here so the user hears about it before the
 *  upload rather than after. */
export const AVATAR_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export type PresignAvatarResponse = {
  uploadUrl: string;
  s3Key: string;
  /** The permanent public URL — this is what PATCH /user/profile wants. */
  publicUrl: string;
  expiresAt: string;
};

export const userService = {
  getById: async (userId: string): Promise<UserProfile> => {
    const { data } = await api.get<UserProfile>(`/user/${userId}`);
    return data;
  },

  logoutAll: () => api.post("/user/logout-all"),

  presignAvatar: async (
    mimeType: string,
    fileName?: string,
    fileSize?: number
  ): Promise<PresignAvatarResponse> => {
    const { data } = await api.post<PresignAvatarResponse>(
      "/user/profile/avatar/presign",
      { mimeType, fileName, fileSize }
    );
    return data;
  },

  updateProfile: async (patch: Record<string, unknown>): Promise<UserProfile> => {
    const { data } = await api.patch<UserProfile>("/user/profile", patch);
    return data;
  },

  /**
   * Upload → apply, as the API documents it: presign, PUT the bytes, then
   * PATCH the returned `publicUrl` onto the profile. The presign step alone
   * does not change the avatar.
   *
   * Unlike the chat attachment upload, the PUT **does** send `Content-Type`:
   * it is not part of the signed request, but S3 stores whatever it is given
   * and serves it back on read — omit it and the image comes back as
   * `binary/octet-stream` and will not render in an `<img>`.
   */
  uploadAvatar: async (file: File): Promise<UserProfile> => {
    const presign = await userService.presignAvatar(
      file.type,
      file.name,
      file.size
    );

    const res = await fetch(presign.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
    }

    return userService.updateProfile({ profilePicture: presign.publicUrl });
  },

  /** Reverts to a generated initials avatar — the API's own null equivalent,
   *  since `profilePicture` rejects an empty string. */
  removeAvatar: async (fullName: string): Promise<UserProfile> => {
    const letters = (fullName.trim().match(/[A-Za-z]/g) ?? ["U"])
      .slice(0, 2)
      .join("");
    return userService.updateProfile({ profilePicture: `initials:${letters}` });
  },
};
