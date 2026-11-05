"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { chatService } from "@/services/chat.service";
import { parseApiError } from "@/lib/api";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useChatChannel } from "@/hooks/useChatRealtime";
import { useChatStore } from "@/stores/chat.store";
import { useAuthStore } from "@/stores/auth.store";
import { countMatches, groupMessages } from "@/lib/chat/format";
import ChatMessageRow from "./ChatMessageRow";
import ChatComposer from "./ChatComposer";
import { LuCircleSlash } from "react-icons/lu";
import type { ChatChannel, ChatMessage } from "@/types/chat";

/**
 * The scrolling message list plus composer, shared by channels and DMs.
 *
 * Everything that differs between the two — header, onboarding, member
 * sidebar — lives in the panel that renders this, so the timeline itself has
 * exactly one implementation.
 */
export default function ChatThreadView({
  room,
  searchQuery = "",
  activeMatchIndex = 0,
  onMatchCountChange,
}: {
  room: ChatChannel;
  /* The query lives in the header alongside the input; the matching lives
     here, because only this component holds the loaded messages. The count
     is reported back so the header can render "3/12". */
  searchQuery?: string;
  activeMatchIndex?: number;
  onMatchCountChange?: (count: number) => void;
}) {
  const { messages, isLoading, hasMore, loadOlder } = useChatMessages(room.id);
  const { sendTypingStart, sendTypingStop } = useChatChannel(room.id);
  const selfId = useAuthStore((s) => s.user?.id);
  const typingUsers = useChatStore((s) => s.typingByChannel[room.id]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  /* Reads the channel's own flag rather than a local one, so a delete that
     lands over the socket while the thread is open takes effect immediately. */
  const isFrozen = Boolean(room.deletedAt);

  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);

  /* Member names resolve SYSTEM message text and @-mentions. */
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of room.members) map.set(m.userId, m.user.fullName);
    return map;
  }, [room.members]);

  const resolveName = useCallback(
    (id: string) => nameById.get(id) ?? "Someone",
    [nameById]
  );

  const mentionMembers = useMemo(
    () =>
      room.members.map((m) => ({
        userId: m.userId,
        fullName: m.user.fullName,
        avatarUrl: m.user.avatarUrl,
      })),
    [room.members]
  );

  const canModerate = useMemo(() => {
    const role = room.viewerMembership?.role;
    return role === "OWNER" || role === "ADMIN";
  }, [room.viewerMembership]);

  // Follow the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Infinite scroll upward for older history.
  useEffect(() => {
    const node = topSentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadOlder();
      },
      { rootMargin: "80px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadOlder]);

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    try {
      // One route toggles both ways; the socket echo updates the store.
      await chatService.toggleReaction(messageId, emoji);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't react.");
    }
  }, []);

  const handlePin = useCallback(async (message: ChatMessage) => {
    try {
      if (message.isPinned) await chatService.unpinMessage(message.id);
      else await chatService.pinMessage(message.id);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't update pin.");
    }
  }, []);

  const handleDelete = useCallback(async (message: ChatMessage) => {
    try {
      await chatService.deleteMessage(message.id);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't delete message.");
    }
  }, []);

  const groups = useMemo(() => groupMessages(messages), [messages]);

  /* ── In-conversation search ──────────────────────────────────────────────
     Matches are counted per message and flattened into one ordered list, so
     the arrows step through every *occurrence* rather than every message —
     a message containing the term three times is three stops, as in WhatsApp.

     Scoped to messages already loaded: the thread pages backwards on scroll,
     so an old hit is reachable only once its page is in. `/chat/search` with
     a channelId covers the whole history and is the sidebar's job. */
  const matches = useMemo(() => {
    const needle = searchQuery.trim();
    if (!needle) return [] as { messageId: string; ordinal: number }[];
    const flat: { messageId: string; ordinal: number }[] = [];
    for (const message of messages) {
      if (message.deletedAt) continue;
      const count = countMatches(message.plaintext, needle);
      for (let i = 0; i < count; i += 1) {
        flat.push({ messageId: message.id, ordinal: i });
      }
    }
    return flat;
  }, [messages, searchQuery]);

  /* Where each message's occurrences begin in the flat list, so a row can
     tell whether *its* nth match is the active one. */
  const matchOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    matches.forEach((m, index) => {
      if (offsets[m.messageId] === undefined) offsets[m.messageId] = index;
    });
    return offsets;
  }, [matches]);

  const activeMatch = matches[activeMatchIndex] ?? null;

  /* The header owns the counter but cannot compute it — it has no messages. */
  useEffect(() => {
    onMatchCountChange?.(matches.length);
  }, [matches.length, onMatchCountChange]);

  /* Scrolls the active hit into view. Keyed on the match rather than the
     index so re-running the same search does not re-scroll, and centred
     because a hit pinned to the top edge reads as cut off. */
  const activeMatchId = activeMatch?.messageId;
  const activeMatchOrdinal = activeMatch?.ordinal;
  useEffect(() => {
    if (!activeMatchId) return;
    const node = document.querySelector(`[data-message-id="${activeMatchId}"]`);
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeMatchId, activeMatchOrdinal]);

  const typingNames = useMemo(() => {
    if (!typingUsers?.size) return [];
    return Array.from(typingUsers)
      .filter((id) => id !== selfId)
      .map((id) => resolveName(id));
  }, [typingUsers, selfId, resolveName]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div ref={topSentinel} />
        {isLoading && messages.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">
            Loading messages…
          </p>
        )}

        {groups.map((group) => (
          <div key={group.label}>
            <div className="my-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <span className="text-[11px] font-medium text-gray-400">
                {group.label}
              </span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            </div>
            {group.messages.map((message) => (
              <ChatMessageRow
                key={message.id}
                message={message}
                selfUserId={selfId}
                resolveName={resolveName}
                canModerate={canModerate}
                isDm={room.kind === "DM"}
                isFrozen={isFrozen}
                searchQuery={searchQuery}
                activeMatchOrdinal={
                  activeMatch?.messageId === message.id
                    ? activeMatch.ordinal
                    : undefined
                }
                matchStartOrdinal={matchOffsets[message.id]}
                onReact={handleReact}
                onReply={setReplyingTo}
                onPin={handlePin}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {typingNames.length > 0 && (
        <p className="px-4 pb-1 text-xs italic text-gray-400">
          {typingNames.join(", ")}{" "}
          {typingNames.length === 1 ? "is" : "are"} typing…
        </p>
      )}

      {/* A frozen channel keeps its history but takes no new messages — the
          server 403s them — so the composer is replaced rather than disabled,
          which would leave a text box that silently fails on Enter. */}
      {isFrozen ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-gray-100 px-4 py-4 text-center dark:border-gray-800">
          <LuCircleSlash className="h-4 w-4 shrink-0 text-gray-400" />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This channel was deleted by its owner. You can still read the
            history, but no new messages can be sent.
          </p>
        </div>
      ) : (
        <ChatComposer
          channelId={room.id}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          onTypingStart={sendTypingStart}
          onTypingStop={sendTypingStop}
          /* Mentions are offered in channels, where there is a roster worth
             picking from. In a two-person DM the other party is implicit. */
          enableMentions={room.kind === "CHANNEL"}
          members={mentionMembers}
        />
      )}
    </div>
  );
}
