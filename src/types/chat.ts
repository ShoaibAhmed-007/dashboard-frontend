export type ChatUserSummary = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
};

export type ChatReaction = {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user: ChatUserSummary;
};

/**
 * A file shared in chat.
 *
 * `url` and `downloadUrl` are **separately signed** links to the same S3
 * object, both valid for 15 minutes from the response that produced them:
 * `url` renders inline (use for `<img>`/`<video>` src), `downloadUrl` carries
 * `Content-Disposition: attachment` so the browser saves it.
 *
 * Never cache either — re-fetch when the user opens the panel again. A plain
 * `<a download>` will not force a save here, because the link is cross-origin.
 */
export type ChatAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  s3Key: string;
  fileSize?: number;
  url?: string;
  downloadUrl?: string;
  expiresAt?: string;
  createdAt?: string;
};

/**
 * Every attachment ever shared in a room, grouped by `mimeType` prefix —
 * backs the "Media, Links and docs" panel.
 */
export type ChannelAttachments = {
  images: ChatAttachment[];
  videos: ChatAttachment[];
  /** Everything that is not an image or video — PDFs, docs, archives. */
  files: ChatAttachment[];
};

export type ChatReplyPreview = {
  id: string;
  senderId: string | null;
  kind: "USER" | "SYSTEM";
  plaintext: string;
  deletedAt: string | null;
  sender: ChatUserSummary | null;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  senderId: string | null;
  kind: "USER" | "SYSTEM";
  contentJson: Record<string, unknown>;
  plaintext: string;
  replyToMessageId: string | null;
  isEdited: boolean;
  editedAt: string | null;
  isPinned: boolean;
  pinnedAt: string | null;
  pinnedById: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sender: ChatUserSummary | null;
  pinnedBy: ChatUserSummary | null;
  mentions: ChatUserSummary[];
  reactions: ChatReaction[];
  attachments: ChatAttachment[];
  replyTo: ChatReplyPreview | null;
  /** Only populated on search results, so a hit can be labelled with the room
   *  it came from without a second lookup. */
  channel?: {
    id: string;
    workspaceId: string;
    kind: "CHANNEL" | "DM";
    privacy: "PUBLIC" | "PRIVATE";
    name: string | null;
  };
};

export type ChannelMember = {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  isMuted: boolean;
  /** Per-member, never per-room: archiving hides the room from this person's
   *  own list only. The other participant's list is untouched. */
  isArchived: boolean;
  /** Per-member, same as `isArchived`. */
  isFavourite: boolean;
  unreadCount: number;
  lastReadMessageId: string | null;
  joinedAt: string;
  user: ChatUserSummary;
};

/**
 * Preview of a room's most recent message, for the conversation list.
 *
 * Only `GET /chat/dms` and `POST /chat/dm` populate this — the channel list
 * route does not, so it is optional on {@link ChatChannel}.
 */
export type LastMessage = {
  id: string;
  senderId: string | null;
  kind: "USER" | "SYSTEM";
  /** Empty string when the message was deleted — check `deletedAt` rather
   *  than treating "" as "no content". */
  plaintext: string;
  createdAt: string;
  deletedAt: string | null;
  sender: ChatUserSummary | null;
};

/**
 * A chat room. DMs and channels are the same entity server-side, discriminated
 * by `kind` — a DM is just a two-person `Channel` with `name: null`.
 *
 * Caller-scoped fields (`isMuted`/`isArchived`/`isFavourite`/`unreadCount`) are
 * this viewer's own state. NOTE: the channel-list endpoint omits
 * `isArchived`/`isFavourite` at the top level but does return them inside
 * `viewerMembership`, so prefer that when they are absent here.
 */
export type ChatChannel = {
  id: string;
  workspaceId: string;
  kind: "CHANNEL" | "DM";
  privacy: "PUBLIC" | "PRIVATE";
  /** Always null for DMs — derive the title from `members`. */
  name: string | null;
  description: string | null;
  projectId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Set when the OWNER "deleted" the channel — a freeze, not a destroy. The
   * row, its members and its whole history stay, and it keeps appearing in
   * listings; only new messages are rejected (403). Always null for DMs,
   * which cannot be deleted this way.
   */
  deletedAt?: string | null;
  isMember: boolean;
  isMuted: boolean;
  isArchived?: boolean;
  isFavourite?: boolean;
  unreadCount: number;
  lastReadMessageId: string | null;
  lastMessage?: LastMessage | null;
  viewerMembership: ChannelMember | null;
  members: ChannelMember[];
};

/**
 * @deprecated Use {@link ChatChannel} — DMs and channels share one shape,
 * discriminated on `kind`. Kept as an alias so existing imports keep working.
 */
export type DmChannel = ChatChannel;

export type PresignResponse = {
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
  attachmentId: string;
};

export type PaginatedMessages = {
  items: ChatMessage[];
  nextCursor: string | null;
};

export type ReadReceiptEvent = {
  channelId: string;
  userId: string;
  lastReadMessageId: string;
  unreadCount: number;
  readAt: string;
};

export type PresenceChangedEvent = {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
};

/**
 * What the sidebar search box gets back. Both halves are always present:
 * `people` are DMs the caller already has whose other participant matches,
 * `messages` are hits across every room they belong to.
 */
export type GlobalSearchResult = {
  people: ChatChannel[];
  messages: { items: ChatMessage[]; nextCursor: string | null };
};
