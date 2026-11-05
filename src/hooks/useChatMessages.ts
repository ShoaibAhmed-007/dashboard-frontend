"use client";

import { useCallback, useEffect, useRef } from "react";
import { chatService } from "@/services/chat.service";
import { useChatStore } from "@/stores/chat.store";
import type { ChatMessage } from "@/types/chat";

/** Don't hammer the read endpoint while the user scrolls. */
const MARK_READ_DEBOUNCE_MS = 800;

/**
 * Loads a room's history, keeps it live, and marks it read.
 *
 * Pagination is cursor-based and newest-first server-side; the store flips it
 * to oldest-first for display, so "load older" prepends.
 */
/* Stable empty array. A `?? []` inside the selector allocates a fresh array on
   every call, so zustand sees a new reference each render, re-renders, and
   loops — "The result of getSnapshot should be cached". One shared frozen
   constant keeps the reference identical between renders. */
const NO_MESSAGES: ChatMessage[] = [];

export function useChatMessages(channelId: string | null) {
  const messages = useChatStore((s) =>
    channelId ? s.messagesByChannel[channelId] ?? NO_MESSAGES : NO_MESSAGES
  );
  const isLoading = useChatStore((s) =>
    channelId ? s.messagesLoadingByChannel[channelId] ?? false : false
  );
  const hasMore = useChatStore((s) =>
    channelId ? s.hasMoreByChannel[channelId] ?? false : false
  );
  const markReadTimer = useRef<number | null>(null);

  // Initial page, once per room.
  useEffect(() => {
    if (!channelId) return;
    const store = useChatStore.getState();
    if (store.messagesByChannel[channelId]) return;

    let cancelled = false;
    store.setMessagesLoading(channelId, true);
    chatService
      .getMessages(channelId)
      .then(({ items, nextCursor }) => {
        if (!cancelled) store.setMessages(channelId, items, nextCursor);
      })
      .catch(() => {
        /* Leave the thread empty — the list still renders and a retry happens
           on the next open. */
      })
      .finally(() => {
        if (!cancelled) store.setMessagesLoading(channelId, false);
      });

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const loadOlder = useCallback(async () => {
    if (!channelId) return;
    const store = useChatStore.getState();
    const cursor = store.nextCursorByChannel[channelId];
    if (!cursor || store.messagesLoadingByChannel[channelId]) return;

    store.setMessagesLoading(channelId, true);
    try {
      const { items, nextCursor } = await chatService.getMessages(
        channelId,
        cursor
      );
      store.prependMessages(channelId, items, nextCursor);
    } finally {
      store.setMessagesLoading(channelId, false);
    }
  }, [channelId]);

  /* Debounced: the server recomputes the unread count and broadcasts
     `member:read` on every call, so this shouldn't fire per scroll tick. */
  const newestId = messages.length ? messages[messages.length - 1].id : null;

  useEffect(() => {
    if (!channelId || !newestId) return;

    const store = useChatStore.getState();
    const room = store.channels.find((c) => c.id === channelId);
    if (!room) return;
    if (room.lastReadMessageId === newestId) return;
    if (room.unreadCount === 0 && room.lastReadMessageId !== null) return;

    if (markReadTimer.current) window.clearTimeout(markReadTimer.current);
    markReadTimer.current = window.setTimeout(() => {
      void chatService.markRead(channelId, newestId).catch(() => {});
      /* Passing the id is what stops this effect re-running: the guard above
         compares `lastReadMessageId` to the newest message, so clearing the
         count alone would leave the condition permanently true. */
      store.clearChannelUnread(channelId, newestId);
    }, MARK_READ_DEBOUNCE_MS);

    return () => {
      if (markReadTimer.current) window.clearTimeout(markReadTimer.current);
    };
  }, [channelId, newestId]);

  return { messages, isLoading, hasMore, loadOlder };
}
