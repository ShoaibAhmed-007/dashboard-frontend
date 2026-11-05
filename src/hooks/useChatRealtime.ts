"use client";

import { useEffect, useRef } from "react";
import { getChatSocket } from "@/lib/chat-socket";
import { getPresenceSocket } from "@/lib/presence-socket";
import { chatService } from "@/services/chat.service";
import { useChatStore } from "@/stores/chat.store";
import { useAuthStore } from "@/stores/auth.store";
import type {
  ChatMessage,
  ChatReaction,
  PresenceChangedEvent,
  ReadReceiptEvent,
} from "@/types/chat";

type ReactionEvent = {
  messageId: string;
  userId: string;
  emoji: string;
  reaction?: ChatReaction;
};
type TypingEvent = { channelId: string; userId: string };
type DeletedEvent = { messageId: string; deletedAt: string };
type PinnedEvent = { message: ChatMessage };
type UnpinnedEvent = { messageId: string };

/** Typing indicators self-expire — the stop event can be lost on a drop. */
const TYPING_TTL_MS = 3000;
const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

interface ChatSocketControls {
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  isConnected: () => boolean;
}

/**
 * The app's single chat + presence subscription.
 *
 * Replaces `useGlobalChatSocket` and `useGlobalChannelSocket`, which were
 * near-duplicates both listening on the *same* singleton socket — so every
 * message ran two handlers and channel messages leaked into the DM store.
 *
 * Mount exactly once, high enough in the tree to stay mounted while the user
 * is anywhere in the app: it keeps unread badges and presence current for
 * rooms that aren't on screen.
 */
export function useChatRealtime() {
  useEffect(() => {
    const socket = getChatSocket();
    const store = useChatStore.getState;

    const onMessageNew = (msg: ChatMessage) => {
      store().upsertMessage(msg);

      /* A new message reopens a closed conversation. The server does not do
         this for us — `isArchived` is only ever written by the archive
         endpoint — so the flag is cleared on the server too, otherwise the
         room would sink back out of the list on the next reload. */
      if (store().archived.some((c) => c.id === msg.channelId)) {
        store().unarchiveChannel(msg.channelId);
        void chatService.setArchived(msg.channelId, false).catch(() => {});
      }

      /* Only the room the user isn't looking at gets a badge, and never for
         their own message. The server does not bump `unreadCount` on send, so
         this local increment is the only thing that moves it between reads. */
      const myId = useAuthStore.getState().user?.id;
      if (msg.senderId && msg.senderId === myId) return;
      if (msg.channelId === store().activeChannelId) return;
      store().incrementChannelUnread(msg.channelId);
    };

    /* A SYSTEM row is the only signal that a channel was frozen — there is no
       dedicated event — so the flag is set from it. Without this the composer
       stays live for everyone except the person who pressed delete, until
       their next refetch. */
    const onSystemEvent = (msg: ChatMessage) => {
      const event = (msg.contentJson as { event?: string })?.event;
      if (event === "channel_deleted") {
        store().patchChannel(msg.channelId, { deletedAt: msg.createdAt });
      }
    };

    const onMessageEdited = (msg: ChatMessage) => store().upsertMessage(msg);

    const onMessageDeleted = ({ messageId, deletedAt }: DeletedEvent) =>
      store().deleteMessage(messageId, deletedAt);

    const onMessagePinned = ({ message }: PinnedEvent) => {
      if (!message) return;
      store().upsertMessage({ ...message, isPinned: true });
    };

    const onMessageUnpinned = ({ messageId }: UnpinnedEvent) => {
      const { messagesByChannel } = store();
      for (const messages of Object.values(messagesByChannel)) {
        const found = messages.find((m) => m.id === messageId);
        if (found) {
          store().upsertMessage({ ...found, isPinned: false, pinnedAt: null });
          return;
        }
      }
    };

    const onReactionAdded = (event: ReactionEvent) => {
      /* The event payload is thin — synthesize the row the store expects when
         the server didn't send a full reaction object. */
      const reaction: ChatReaction = event.reaction ?? {
        id: `${event.messageId}:${event.userId}:${event.emoji}`,
        messageId: event.messageId,
        userId: event.userId,
        emoji: event.emoji,
        createdAt: new Date().toISOString(),
        user: { id: event.userId, fullName: "", avatarUrl: null },
      };
      store().addReaction(event.messageId, reaction);
    };

    const onReactionRemoved = ({ messageId, userId, emoji }: ReactionEvent) =>
      store().removeReaction(messageId, userId, emoji);

    /* Applied for *every* member, not just the current user — the previous
       implementation discarded other people's receipts, which is why "seen by"
       was impossible to build. Only our own receipt moves our badge. */
    const onMemberRead = (event: ReadReceiptEvent) => {
      const myId = useAuthStore.getState().user?.id;
      if (event.userId === myId) {
        store().updateChannelUnread(
          event.channelId,
          event.unreadCount,
          event.lastReadMessageId
        );
        return;
      }
      const channel = store().channels.find((c) => c.id === event.channelId);
      if (!channel) return;
      store().patchChannel(event.channelId, {
        members: channel.members.map((m) =>
          m.userId === event.userId
            ? { ...m, lastReadMessageId: event.lastReadMessageId }
            : m
        ),
      });
    };

    const onTypingStarted = ({ channelId, userId }: TypingEvent) => {
      store().setTyping(channelId, userId, true);
      const key = `${channelId}:${userId}`;
      const existing = typingTimeouts.get(key);
      if (existing) clearTimeout(existing);
      typingTimeouts.set(
        key,
        setTimeout(() => {
          store().setTyping(channelId, userId, false);
          typingTimeouts.delete(key);
        }, TYPING_TTL_MS)
      );
    };

    const onTypingStopped = ({ channelId, userId }: TypingEvent) => {
      store().setTyping(channelId, userId, false);
      const key = `${channelId}:${userId}`;
      const existing = typingTimeouts.get(key);
      if (existing) {
        clearTimeout(existing);
        typingTimeouts.delete(key);
      }
    };

    socket.on("message:new", onMessageNew);
    socket.on("system:event", onMessageNew);
    socket.on("system:event", onSystemEvent);
    socket.on("message:edited", onMessageEdited);
    socket.on("message:deleted", onMessageDeleted);
    socket.on("message:pinned", onMessagePinned);
    socket.on("message:unpinned", onMessageUnpinned);
    socket.on("reaction:added", onReactionAdded);
    socket.on("reaction:removed", onReactionRemoved);
    socket.on("member:read", onMemberRead);
    socket.on("typing:user-started", onTypingStarted);
    socket.on("typing:user-stopped", onTypingStopped);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("system:event", onMessageNew);
      socket.off("system:event", onSystemEvent);
      socket.off("message:edited", onMessageEdited);
      socket.off("message:deleted", onMessageDeleted);
      socket.off("message:pinned", onMessagePinned);
      socket.off("message:unpinned", onMessageUnpinned);
      socket.off("reaction:added", onReactionAdded);
      socket.off("reaction:removed", onReactionRemoved);
      socket.off("member:read", onMemberRead);
      socket.off("typing:user-started", onTypingStarted);
      socket.off("typing:user-stopped", onTypingStopped);
    };
  }, []);

  // Presence rides its own namespace, but shares this hook's lifetime.
  useEffect(() => {
    const socket = getPresenceSocket();
    const onPresence = ({
      userId,
      isOnline,
      lastSeenAt,
    }: PresenceChangedEvent) =>
      useChatStore.getState().setOnline(userId, isOnline, lastSeenAt);

    const subscribe = () => socket.emit("presence:subscribe");
    if (socket.connected) subscribe();

    socket.on("connect", subscribe);
    socket.on("presence:changed", onPresence);
    return () => {
      socket.off("connect", subscribe);
      socket.off("presence:changed", onPresence);
    };
  }, []);
}

/**
 * Per-room controls: announces the active channel and sends typing pings.
 *
 * The socket auto-joins every room the user belongs to on connect, so
 * `chat:join` here is mostly an explicit "this is the active view" signal and
 * covers rooms joined mid-session.
 */
export function useChatChannel(channelId: string | null): ChatSocketControls {
  const channelIdRef = useRef(channelId);

  useEffect(() => {
    channelIdRef.current = channelId;
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;
    const socket = getChatSocket();
    const join = () => socket.emit("chat:join", { channelId });
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
    };
  }, [channelId]);

  return {
    sendTypingStart: () => {
      const id = channelIdRef.current;
      if (id) getChatSocket().emit("chat:typing-start", { channelId: id });
    },
    sendTypingStop: () => {
      const id = channelIdRef.current;
      if (id) getChatSocket().emit("chat:typing-stop", { channelId: id });
    },
    isConnected: () => getChatSocket().connected,
  };
}
