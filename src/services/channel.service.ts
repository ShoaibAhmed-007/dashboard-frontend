import { api } from "@/lib/api";
import type { Channel } from "@/types/channel";
import type { ChannelMember, ChatChannel } from "@/types/chat";

/**
 * Roles as the **write** API expects them — lowercase. Responses come back
 * uppercase on `ChannelMember.role`; the two are deliberately different
 * casings server-side, so don't unify them without checking both directions.
 */
export type ChannelMemberRoleInput = "admin" | "member";

export type ChannelJoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ChannelJoinRequest = {
  id: string;
  channelId: string;
  userId: string;
  status: ChannelJoinRequestStatus;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; fullName: string; avatarUrl: string | null };
};

export const channelService = {
  getChannels: async (workspaceId: string): Promise<Channel[]> => {
    const { data } = await api.get<{ data: Channel[] }>(
      `/channels/workspaces/${workspaceId}`
    );
    return data.data;
  },

  createChannel: async (
    name: string,
    privacy: "PUBLIC" | "PRIVATE",
    description?: string
  ): Promise<Channel> => {
    const body: Record<string, unknown> = { name, privacy };
    if (description?.trim()) body.description = description.trim();
    const { data } = await api.post<{ data: Channel }>("/channels", body);
    return data.data;
  },

  /**
   * Rename, re-describe, or change a channel's privacy. OWNER/ADMIN only —
   * each change also emits its own SYSTEM message into the channel.
   */
  updateChannel: async (
    channelId: string,
    patch: { name?: string; description?: string; privacy?: "PUBLIC" | "PRIVATE" }
  ): Promise<ChatChannel> => {
    const { data } = await api.patch<{ data: ChatChannel }>(
      `/channels/${channelId}`,
      patch
    );
    return data.data;
  },

  // ── Join requests (PUBLIC channels only — PRIVATE is invite-only) ──────────

  /** 400 if already pending, already a member, or rejected within 24h. */
  requestToJoin: async (channelId: string): Promise<ChannelJoinRequest> => {
    const { data } = await api.post<{ data: ChannelJoinRequest }>(
      `/channels/${channelId}/join-requests`
    );
    return data.data;
  },

  /** OWNER/ADMIN only. */
  listJoinRequests: async (
    channelId: string,
    status?: ChannelJoinRequestStatus
  ): Promise<ChannelJoinRequest[]> => {
    const { data } = await api.get<{ data: ChannelJoinRequest[] }>(
      `/channels/${channelId}/join-requests`,
      { params: status ? { status } : undefined }
    );
    return data.data;
  },

  /** The caller's own latest request in any state, or null if never asked. */
  getMyJoinRequest: async (
    channelId: string
  ): Promise<ChannelJoinRequest | null> => {
    const { data } = await api.get<{ data: ChannelJoinRequest | null }>(
      `/channels/${channelId}/join-requests/me`
    );
    return data.data;
  },

  /** OWNER/ADMIN only. Approving adds the member and emits `member_joined`. */
  decideJoinRequest: async (
    channelId: string,
    requestId: string,
    decision: "approve" | "reject"
  ): Promise<ChannelJoinRequest> => {
    const { data } = await api.patch<{ data: ChannelJoinRequest }>(
      `/channels/${channelId}/join-requests/${requestId}`,
      { decision }
    );
    return data.data;
  },

  addMember: async (
    channelId: string,
    userId: string,
    role: ChannelMemberRoleInput = "member"
  ): Promise<ChannelMember> => {
    const { data } = await api.post<{ data: ChannelMember }>(
      `/channels/${channelId}/members`,
      { userId, role }
    );
    return data.data;
  },

  addMembers: async (
    channelId: string,
    members: { userId: string; role: "admin" | "member" }[]
  ): Promise<ChannelMember[]> => {
    const { data } = await api.post<{ data: ChannelMember[] }>(
      `/channels/${channelId}/members/bulk`,
      { members }
    );
    return data.data;
  },

  /**
   * Freezes a channel: OWNER only, and nothing is destroyed. The row, its
   * members and its full history remain and it stays in the listings — only
   * `POST .../messages` starts returning 403. Idempotent, and 400 on a DM.
   *
   * Returns nothing, so callers patch `deletedAt` locally rather than waiting
   * for the channel list to refetch.
   */
  deleteChannel: async (channelId: string): Promise<void> => {
    await api.delete(`/channels/${channelId}`);
  },

  removeMember: async (channelId: string, memberId: string): Promise<void> => {
    await api.delete(`/channels/${channelId}/members/${memberId}`);
  },
};
