import { create } from "zustand";
import type {
  ChatChannel,
  ChatMessage,
  ChatReaction,
  LastMessage,
} from "@/types/chat";

interface OnlineStatus {
  isOnline: boolean;
  lastSeenAt: string | null;
}

/**
 * One store for every chat room — channels and DMs alike.
 *
 * Replaces the old `dm.store` + `channel.store` pair, which were ~90%
 * identical and, worse, both subscribed to the same singleton socket: every
 * `message:new` ran both handlers, and channel messages landed in the DM store
 * unfiltered. Rooms are keyed by `channelId` here, so a message can only ever
 * belong to one place.
 *
 * Messages are held oldest → newest, the opposite of the API's newest-first
 * ordering — `setMessages`/`prependMessages` do that flip.
 */
interface ChatState {
  channels: ChatChannel[];
  channelsLoading: boolean;
  channelsError: string | null;

  /* Archived rooms live in their own slice rather than in `channels` with a
     flag. The list endpoints exclude archived rooms by default, so a single
     array would silently lose them on every reload — and any consumer that
     forgot to filter would show a closed conversation as open. */
  archived: ChatChannel[];
  archivedLoading: boolean;
  archivedLoaded: boolean;

  /** Which room the user is looking at, so unread isn't bumped for it. */
  activeChannelId: string | null;

  messagesByChannel: Record<string, ChatMessage[]>;
  nextCursorByChannel: Record<string, string | null>;
  messagesLoadingByChannel: Record<string, boolean>;
  hasMoreByChannel: Record<string, boolean>;
  pinnedByChannel: Record<string, ChatMessage[]>;

  typingByChannel: Record<string, Set<string>>;
  onlineStatus: Record<string, OnlineStatus>;
  /** Resolves "open a DM with this person" to an existing room. */
  userToChannelId: Record<string, string>;

  setChannels: (channels: ChatChannel[]) => void;
  upsertChannel: (channel: ChatChannel) => void;
  patchChannel: (channelId: string, patch: Partial<ChatChannel>) => void;
  removeChannel: (channelId: string) => void;
  setArchived: (channels: ChatChannel[]) => void;
  setArchivedLoading: (loading: boolean) => void;
  /** Moves a room out of the active list and into the archived one. */
  archiveChannel: (channelId: string) => void;
  /** The reverse — back into the active list. */
  unarchiveChannel: (channelId: string) => void;
  setChannelsLoading: (loading: boolean) => void;
  setChannelsError: (error: string | null) => void;
  setActiveChannel: (channelId: string | null) => void;

  updateChannelUnread: (
    channelId: string,
    unreadCount: number,
    lastReadMessageId: string
  ) => void;
  clearChannelUnread: (channelId: string, lastReadMessageId?: string) => void;
  incrementChannelUnread: (channelId: string) => void;

  setMessages: (
    channelId: string,
    messages: ChatMessage[],
    nextCursor: string | null
  ) => void;
  prependMessages: (
    channelId: string,
    messages: ChatMessage[],
    nextCursor: string | null
  ) => void;
  upsertMessage: (message: ChatMessage) => void;
  deleteMessage: (messageId: string, deletedAt: string) => void;
  setMessagesLoading: (channelId: string, loading: boolean) => void;
  setPinned: (channelId: string, messages: ChatMessage[]) => void;

  addReaction: (messageId: string, reaction: ChatReaction) => void;
  removeReaction: (messageId: string, userId: string, emoji: string) => void;

  setTyping: (channelId: string, userId: string, isTyping: boolean) => void;
  setOnline: (
    userId: string,
    isOnline: boolean,
    lastSeenAt: string | null
  ) => void;
  setUserToChannelId: (userId: string, channelId: string) => void;
}

/** Applies a change to one message wherever it lives. */
function mapMessage(
  byChannel: Record<string, ChatMessage[]>,
  messageId: string,
  fn: (message: ChatMessage) => ChatMessage
): Record<string, ChatMessage[]> {
  const next: Record<string, ChatMessage[]> = {};
  for (const [channelId, messages] of Object.entries(byChannel)) {
    next[channelId] = messages.map((m) => (m.id === messageId ? fn(m) : m));
  }
  return next;
}

export const useChatStore = create<ChatState>((set) => ({
  channels: [],
  channelsLoading: false,
  channelsError: null,
  archived: [],
  archivedLoading: false,
  archivedLoaded: false,
  activeChannelId: null,
  messagesByChannel: {},
  nextCursorByChannel: {},
  messagesLoadingByChannel: {},
  hasMoreByChannel: {},
  pinnedByChannel: {},
  typingByChannel: {},
  onlineStatus: {},
  userToChannelId: {},

  setChannels: (channels) => set({ channels }),

  upsertChannel: (channel) =>
    set((s) => {
      const idx = s.channels.findIndex((c) => c.id === channel.id);
      if (idx < 0) return { channels: [...s.channels, channel] };
      const next = [...s.channels];
      next[idx] = channel;
      return { channels: next };
    }),

  patchChannel: (channelId, patch) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId ? { ...c, ...patch } : c
      ),
    })),

  removeChannel: (channelId) =>
    set((s) => ({
      channels: s.channels.filter((c) => c.id !== channelId),
      archived: s.archived.filter((c) => c.id !== channelId),
    })),

  setArchived: (archived) => set({ archived, archivedLoaded: true }),
  setArchivedLoading: (archivedLoading) => set({ archivedLoading }),

  /* Both moves carry the room across rather than refetching, so the Archived
     view is correct immediately even before it has ever been opened. A room
     already on the far side is not duplicated. */
  archiveChannel: (channelId) =>
    set((s) => {
      const room = s.channels.find((c) => c.id === channelId);
      if (!room) return s;
      return {
        channels: s.channels.filter((c) => c.id !== channelId),
        archived: [
          { ...room, isArchived: true },
          ...s.archived.filter((c) => c.id !== channelId),
        ],
      };
    }),

  unarchiveChannel: (channelId) =>
    set((s) => {
      const room = s.archived.find((c) => c.id === channelId);
      if (!room) return s;
      return {
        archived: s.archived.filter((c) => c.id !== channelId),
        channels: [
          ...s.channels.filter((c) => c.id !== channelId),
          { ...room, isArchived: false },
        ],
      };
    }),

  setChannelsLoading: (channelsLoading) => set({ channelsLoading }),
  setChannelsError: (channelsError) => set({ channelsError }),
  setActiveChannel: (activeChannelId) => set({ activeChannelId }),

  updateChannelUnread: (channelId, unreadCount, lastReadMessageId) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId ? { ...c, unreadCount, lastReadMessageId } : c
      ),
    })),

  /* Takes the message that was read, not just the channel: leaving
     `lastReadMessageId` stale made the mark-read effect re-fire forever,
     since its "already read this" guard compares against that field. */
  clearChannelUnread: (channelId, lastReadMessageId) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId
          ? {
              ...c,
              unreadCount: 0,
              lastReadMessageId: lastReadMessageId ?? c.lastReadMessageId,
            }
          : c
      ),
    })),

  /* The server only recomputes `unreadCount` inside markRead — it never bumps
     it on send — so the badge has to be advanced locally from `message:new`.
     Treat the value from the list endpoint as a load-time baseline. */
  incrementChannelUnread: (channelId) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId ? { ...c, unreadCount: c.unreadCount + 1 } : c
      ),
    })),

  setMessages: (channelId, messages, nextCursor) =>
    set((s) => ({
      // API returns newest-first; the timeline renders oldest-first.
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: [...messages].reverse(),
      },
      nextCursorByChannel: {
        ...s.nextCursorByChannel,
        [channelId]: nextCursor,
      },
      hasMoreByChannel: {
        ...s.hasMoreByChannel,
        [channelId]: nextCursor !== null,
      },
    })),

  prependMessages: (channelId, messages, nextCursor) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: [
          ...[...messages].reverse(),
          ...(s.messagesByChannel[channelId] ?? []),
        ],
      },
      nextCursorByChannel: {
        ...s.nextCursorByChannel,
        [channelId]: nextCursor,
      },
      hasMoreByChannel: {
        ...s.hasMoreByChannel,
        [channelId]: nextCursor !== null,
      },
    })),

  upsertMessage: (message) =>
    set((s) => {
      const existing = s.messagesByChannel[message.channelId] ?? [];
      const idx = existing.findIndex((m) => m.id === message.id);
      const updated =
        idx >= 0
          ? existing.map((m, i) => (i === idx ? message : m))
          : [...existing, message];

      /* The list row's preview comes from `lastMessage`, which only the DM
         fetch populates — so without this it would sit stale until a reload.
         Rebuilt from the message itself, since `ChatMessage` is a superset of
         `LastMessage`. Guarded on recency so an edit to an older message, or
         a late-arriving one, cannot displace a newer preview. */
      const isNewer = (room: ChatChannel) =>
        !room.lastMessage ||
        new Date(message.createdAt).getTime() >=
          new Date(room.lastMessage.createdAt).getTime();

      const asLast: LastMessage = {
        id: message.id,
        senderId: message.senderId,
        kind: message.kind,
        plaintext: message.plaintext,
        createdAt: message.createdAt,
        deletedAt: message.deletedAt,
        sender: message.sender,
      };

      const withPreview = (rooms: ChatChannel[]) =>
        rooms.map((room) =>
          room.id === message.channelId && isNewer(room)
            ? { ...room, lastMessage: asLast }
            : room
        );

      return {
        messagesByChannel: {
          ...s.messagesByChannel,
          [message.channelId]: updated,
        },
        channels: withPreview(s.channels),
        archived: withPreview(s.archived),
      };
    }),

  /* Tombstone in place rather than removing the row — the timeline still shows
     "Message deleted" where it was. */
  deleteMessage: (messageId, deletedAt) =>
    set((s) => {
      /* If the deleted message was a room's preview, the row would otherwise
         keep showing text that no longer exists. `lastMessagePreview` renders
         "Message deleted" off `deletedAt`. */
      const tombstonePreview = (rooms: ChatChannel[]) =>
        rooms.map((room) =>
          room.lastMessage?.id === messageId
            ? {
                ...room,
                lastMessage: { ...room.lastMessage, deletedAt, plaintext: "" },
              }
            : room
        );

      return {
        messagesByChannel: mapMessage(s.messagesByChannel, messageId, (m) => ({
          ...m,
          deletedAt,
          contentJson: { deleted: true },
          plaintext: "",
        })),
        channels: tombstonePreview(s.channels),
        archived: tombstonePreview(s.archived),
      };
    }),

  setMessagesLoading: (channelId, loading) =>
    set((s) => ({
      messagesLoadingByChannel: {
        ...s.messagesLoadingByChannel,
        [channelId]: loading,
      },
    })),

  setPinned: (channelId, messages) =>
    set((s) => ({
      pinnedByChannel: { ...s.pinnedByChannel, [channelId]: messages },
    })),

  /* Reaction events carry no channelId, so these scan every loaded room. */
  addReaction: (messageId, reaction) =>
    set((s) => ({
      messagesByChannel: mapMessage(s.messagesByChannel, messageId, (m) =>
        m.reactions.some((r) => r.id === reaction.id)
          ? m
          : { ...m, reactions: [...m.reactions, reaction] }
      ),
    })),

  removeReaction: (messageId, userId, emoji) =>
    set((s) => ({
      messagesByChannel: mapMessage(s.messagesByChannel, messageId, (m) => ({
        ...m,
        reactions: m.reactions.filter(
          (r) => !(r.userId === userId && r.emoji === emoji)
        ),
      })),
    })),

  setTyping: (channelId, userId, isTyping) =>
    set((s) => {
      const next = new Set(s.typingByChannel[channelId] ?? []);
      if (isTyping) next.add(userId);
      else next.delete(userId);
      return { typingByChannel: { ...s.typingByChannel, [channelId]: next } };
    }),

  setOnline: (userId, isOnline, lastSeenAt) =>
    set((s) => ({
      onlineStatus: { ...s.onlineStatus, [userId]: { isOnline, lastSeenAt } },
    })),

  setUserToChannelId: (userId, channelId) =>
    set((s) => ({
      userToChannelId: { ...s.userToChannelId, [userId]: channelId },
    })),
}));
