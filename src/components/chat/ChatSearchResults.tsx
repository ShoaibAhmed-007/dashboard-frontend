"use client";

import { useEffect, useState } from "react";
import { LuHash, LuLock, LuSearch } from "react-icons/lu";
import ChatAvatar from "./ChatAvatar";
import { chatService } from "@/services/chat.service";
import { useAuthStore } from "@/stores/auth.store";
import {
  highlightMatches,
  roomAvatarUrl,
  roomTitle,
} from "@/lib/chat/format";
import type { ChatMessage, GlobalSearchResult } from "@/types/chat";

/** Long enough that a single keystroke does not fire a workspace-wide query. */
const DEBOUNCE_MS = 250;

/**
 * Results for the sidebar's search box — People above Messages.
 *
 * Both halves come back on every call and neither gates the other, so an
 * empty People list means "nothing matched a name", not "no results".
 */
export default function ChatSearchResults({
  query,
  onSelectRoom,
  onSelectMessage,
}: {
  query: string;
  onSelectRoom: (channelId: string) => void;
  /** Opens the room and scrolls to the hit. */
  onSelectMessage: (message: ChatMessage) => void;
}) {
  const selfId = useAuthStore((s) => s.user?.id);
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const needle = query.trim();
    // Nothing to clear here: an empty query is handled during render, so no
    // state write is needed (and a synchronous one in an effect re-renders).
    if (!needle) return;

    /* Debounced, and every in-flight response is checked against `cancelled`
       before it lands — otherwise a slow early query can overwrite the
       results of a later, faster one. */
    let cancelled = false;
    const timer = window.setTimeout(() => {
      /* Inside the timer rather than synchronously in the effect body: a
         synchronous setState here re-renders before the debounce has even
         started, for every keystroke. */
      setLoading(true);
      chatService
        .searchGlobal(needle)
        .then((r) => {
          if (!cancelled) setResult(r);
        })
        .catch(() => {
          if (!cancelled) setResult(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  /* The stale result of a previous query is ignored rather than cleared, so
     the panel empties the instant the box does. */
  const shown = query.trim() ? result : null;
  const people = shown?.people ?? [];
  const messages = shown?.messages.items ?? [];
  const nothing =
    !loading && shown !== null && !people.length && !messages.length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {loading && !shown && (
        <p className="px-4 py-6 text-center text-xs text-gray-400">Searching…</p>
      )}

      {nothing && (
        <div className="px-6 py-10 text-center">
          <LuSearch className="mx-auto h-6 w-6 text-gray-300 dark:text-gray-600" />
          <p className="mt-2 text-xs text-gray-400">
            No chats or messages match “{query.trim()}”.
          </p>
        </div>
      )}

      {people.length > 0 && (
        <>
          <p className="px-4 pb-1 pt-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
            People
          </p>
          {people.map((room) => {
            const title = roomTitle(room, selfId);
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onSelectRoom(room.id)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-905/70"
              >
                <ChatAvatar
                  name={title}
                  avatarUrl={roomAvatarUrl(room, selfId)}
                  size={32}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-100">
                  {highlightMatches(title, query)}
                </span>
              </button>
            );
          })}
        </>
      )}

      {messages.length > 0 && (
        <>
          <p className="px-4 pb-1 pt-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
            Messages
          </p>
          {messages.map((message) => {
            const room = message.channel;
            const label =
              room?.kind === "CHANNEL"
                ? room.name ?? "Channel"
                : message.sender?.fullName ?? "Direct message";
            return (
              <button
                key={message.id}
                type="button"
                onClick={() => onSelectMessage(message)}
                className="flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-905/70"
              >
                {room?.kind === "CHANNEL" ? (
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
                    {room.privacy === "PRIVATE" ? (
                      <LuLock className="h-3.5 w-3.5" />
                    ) : (
                      <LuHash className="h-3.5 w-3.5" />
                    )}
                  </span>
                ) : (
                  <ChatAvatar
                    name={message.sender?.fullName ?? "?"}
                    avatarUrl={message.sender?.avatarUrl}
                    size={32}
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                      {label}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {new Date(message.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="mt-0.5 block break-words text-xs text-gray-500 dark:text-gray-400">
                    {highlightMatches(message.plaintext, query)}
                  </span>
                </span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
