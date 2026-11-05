import { api } from "@/lib/api";
import type {
  GlobalSearchResult,
  ChannelAttachments,
  ChatChannel,
  ChatMessage,
  DmChannel,
  PaginatedMessages,
  PresignResponse,
} from "@/types/chat";

/** Toggle result from `POST /chat/messages/:id/reactions`. */
export type ReactionToggleResult = {
  action: "added" | "removed";
  messageId: string;
  userId: string;
  emoji: string;
};

export const chatService = {
  /**
   * The caller's DMs. `archived` defaults to `false` server-side, so omitting
   * it hides archived rooms; pass `true` for the Archived view. Omit
   * `favourite` for no filter.
   */
  getDms: async (params?: {
    archived?: boolean;
    favourite?: boolean;
  }): Promise<DmChannel[]> => {
    const { data } = await api.get<{ data: DmChannel[] }>("/chat/dms", {
      params,
    });
    return data.data;
  },

  createOrGetDm: async (targetUserId: string): Promise<DmChannel> => {
    const { data } = await api.post<{ data: DmChannel }>("/chat/dm", {
      targetUserId,
    });
    return data.data;
  },

  getMessages: async (
    channelId: string,
    cursor?: string | null,
    limit = 50
  ): Promise<PaginatedMessages> => {
    const params: Record<string, string | number> = { limit };
    if (cursor) params.cursor = cursor;
    const { data } = await api.get<{ data: PaginatedMessages }>(
      `/chat/channels/${channelId}/messages`,
      { params }
    );
    return data.data;
  },

  sendMessage: async (
    channelId: string,
    contentJson: Record<string, unknown>,
    attachmentIds?: string[],
    mentionedUserIds?: string[],
    replyToMessageId?: string
  ): Promise<ChatMessage> => {
    const body: Record<string, unknown> = { contentJson };
    if (attachmentIds?.length) body.attachmentIds = attachmentIds;
    if (mentionedUserIds?.length) body.mentionedUserIds = mentionedUserIds;
    if (replyToMessageId) body.replyToMessageId = replyToMessageId;
    const { data } = await api.post<{ data: ChatMessage }>(
      `/chat/channels/${channelId}/messages`,
      body
    );
    return data.data;
  },

  editMessage: async (
    messageId: string,
    contentJson: Record<string, unknown>
  ): Promise<ChatMessage> => {
    const { data } = await api.patch<{ data: ChatMessage }>(
      `/chat/messages/${messageId}`,
      { contentJson }
    );
    return data.data;
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    await api.delete(`/chat/messages/${messageId}`);
  },

  markRead: async (
    channelId: string,
    lastReadMessageId: string
  ): Promise<void> => {
    await api.post(`/chat/channels/${channelId}/read`, { lastReadMessageId });
  },

  presignAttachment: async (
    channelId: string,
    mimeType: string,
    fileName: string,
    fileSize: number
  ): Promise<PresignResponse> => {
    const { data } = await api.post<{ data: PresignResponse }>(
      "/attachments/presign",
      {
        scope: "channel-message",
        channelId,
        mimeType,
        fileName,
        fileSize,
      }
    );
    return data.data;
  },

  uploadToS3: async (uploadUrl: string, file: File): Promise<void> => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      // intentionally no Content-Type header — S3 presigned URL requires none
    });
    if (!res.ok) {
      throw new Error(`S3 upload failed: ${res.status} ${res.statusText}`);
    }
  },

  // ── Reactions ──────────────────────────────────────────────────────────────

  /**
   * One route does both directions — sending the same emoji twice removes it.
   * The response says which happened, so don't assume "added".
   */
  toggleReaction: async (
    messageId: string,
    emoji: string
  ): Promise<ReactionToggleResult> => {
    const { data } = await api.post<{ data: ReactionToggleResult }>(
      `/chat/messages/${messageId}/reactions`,
      { emoji }
    );
    return data.data;
  },

  // ── Pinning (channel OWNER/ADMIN only) ─────────────────────────────────────

  pinMessage: async (messageId: string): Promise<ChatMessage> => {
    const { data } = await api.post<{ data: ChatMessage }>(
      `/chat/messages/${messageId}/pin`
    );
    return data.data;
  },

  unpinMessage: async (messageId: string): Promise<void> => {
    await api.delete(`/chat/messages/${messageId}/pin`);
  },

  getPinnedMessages: async (channelId: string): Promise<ChatMessage[]> => {
    const { data } = await api.get<{ data: ChatMessage[] }>(
      `/chat/channels/${channelId}/messages/pinned`
    );
    return data.data;
  },

  // ── Per-viewer room state ──────────────────────────────────────────────────
  // All four flip a flag on the caller's own membership row only. Archiving or
  // favouriting a DM is invisible to the other participant.

  setMuted: async (channelId: string, muted: boolean): Promise<void> => {
    await api.post(`/chat/channels/${channelId}/${muted ? "mute" : "unmute"}`);
  },

  /** Also backs "Close DM" — there is no separate hide/delete concept. */
  setArchived: async (channelId: string, archived: boolean): Promise<void> => {
    await api.post(
      `/chat/channels/${channelId}/${archived ? "archive" : "unarchive"}`
    );
  },

  setFavourite: async (
    channelId: string,
    favourite: boolean
  ): Promise<void> => {
    await api.post(
      `/chat/channels/${channelId}/${favourite ? "favourite" : "unfavourite"}`
    );
  },

  // ── Attachments ────────────────────────────────────────────────────────────

  /**
   * Every attachment ever shared in a room, grouped by type.
   *
   * Scans the whole message history and signs fresh S3 URLs on each call, so
   * only fetch it when the user actually opens the media panel — not alongside
   * every message load. The returned URLs expire in 15 minutes and must not be
   * cached; call again when the panel reopens.
   */
  getChannelAttachments: async (
    channelId: string
  ): Promise<ChannelAttachments> => {
    const { data } = await api.get<{ data: ChannelAttachments }>(
      `/chat/channels/${channelId}/attachments`
    );
    return data.data;
  },

  // ── Search & jump-to-message ───────────────────────────────────────────────

  /**
   * The sidebar's search box: matching DMs **and** matching messages, both
   * computed on every call.
   *
   * Not a fallback chain — an empty `people` does not mean "no results", it
   * means that half matched nothing, and `messages` is never conditional on
   * it. `people` only covers DMs the caller already has; starting a brand-new
   * conversation goes through the workspace member list instead.
   */
  searchGlobal: async (
    q: string,
    limit = 20
  ): Promise<GlobalSearchResult> => {
    const { data } = await api.get<{ data: GlobalSearchResult }>(
      "/chat/search/global",
      { params: { q, limit } }
    );
    return data.data;
  },

  /** Case-insensitive substring over `plaintext`, scoped to the caller's rooms. */
  searchMessages: async (
    q: string,
    options?: { channelId?: string; cursor?: string | null; limit?: number }
  ): Promise<PaginatedMessages> => {
    const { data } = await api.get<{ data: PaginatedMessages }>(
      "/chat/search",
      { params: { q, ...options } }
    );
    return data.data;
  },

  /**
   * A window of messages around `messageId`, in chronological order — used to
   * hydrate the thread after jumping to a search hit.
   */
  getMessageContext: async (
    channelId: string,
    messageId: string,
    options?: { before?: number; after?: number }
  ): Promise<{
    items: ChatMessage[];
    anchorMessageId: string;
    hasBefore: boolean;
    hasAfter: boolean;
  }> => {
    const { data } = await api.get<{
      data: {
        items: ChatMessage[];
        anchorMessageId: string;
        hasBefore: boolean;
        hasAfter: boolean;
      };
    }>(`/chat/channels/${channelId}/messages/context`, {
      params: { messageId, ...options },
    });
    return data.data;
  },
};

/**
 * A DM's title and the person it is with. DMs carry `name: null` server-side,
 * so both have to be derived from the member list.
 */
export function otherDmMember(channel: ChatChannel, selfUserId: string) {
  return channel.members.find((m) => m.userId !== selfUserId) ?? null;
}

export function buildContentJson(text: string): Record<string, unknown> {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}
