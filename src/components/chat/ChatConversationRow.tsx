"use client";

import { LuStar } from "react-icons/lu";
import { toast } from "sonner";
import ChatAvatar from "./ChatAvatar";
import { chatService } from "@/services/chat.service";
import { parseApiError } from "@/lib/api";
import { useChatStore } from "@/stores/chat.store";
import { lastMessagePreview, roomAvatarUrl, roomTitle } from "@/lib/chat/format";
import type { ChatChannel } from "@/types/chat";

/** Relative day label for the list — "Yesterday", "Sunday", or a date. */
function formatListTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000
  );
  if (days === 0) {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * One row in the conversation list: avatar, name, last-message preview, and a
 * right-hand column carrying the timestamp above any unread badge.
 */
export default function ChatConversationRow({
  conversation,
  selfUserId,
  isActive,
  onClick,
  showFavourite = true,
}: {
  conversation: ChatChannel;
  /** Needed to work out a DM's title — DMs have no `name` of their own. */
  selfUserId: string | undefined;
  isActive: boolean;
  onClick: () => void;
  /** Off in the Archived list, where the row already carries a restore
   *  control and starring a closed conversation is a confusing pairing. */
  showFavourite?: boolean;
}) {
  const { unreadCount, lastMessage } = conversation;
  const name = roomTitle(conversation, selfUserId);
  const preview = lastMessagePreview(conversation);
  const timestamp = lastMessage ? formatListTimestamp(lastMessage.createdAt) : "";
  const isFavourite = Boolean(conversation.isFavourite);
  const patchChannel = useChatStore((s) => s.patchChannel);

  /* Optimistic: the star fills on click and is put back if the call fails —
     this is a per-person flag, so nobody else sees the difference either way. */
  const toggleFavourite = async (event: React.MouseEvent) => {
    // The row underneath is a button; without this, favouriting also opens it.
    event.stopPropagation();
    const next = !isFavourite;
    patchChannel(conversation.id, { isFavourite: next });
    try {
      await chatService.setFavourite(conversation.id, next);
    } catch (err) {
      patchChannel(conversation.id, { isFavourite: !next });
      toast.error(parseApiError(err).message || "Couldn't update favourite.");
    }
  };

  return (
    /* The star cannot live inside the row: the row is itself a button, and
       nesting one is invalid HTML. It is overlaid in the corner instead. */
    <div className="group/row relative">
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
        isActive
          ? "bg-gray-100 dark:bg-gray-905"
          : "hover:bg-gray-50 dark:hover:bg-gray-905/70"
      }`}
    >
      <ChatAvatar
        name={name}
        avatarUrl={roomAvatarUrl(conversation, selfUserId)}
        size={40}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {name}
        </span>
        {/* No read receipt here: the API exposes no per-message delivered or
            seen state, so a tick could only ever mean "I sent this" — which
            reads as a receipt it cannot back up. */}
        <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
          {preview}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {/* Hidden while hovering so the star can take this corner without the
            two overlapping. An already-favourited row keeps its star visible,
            so the timestamp yields to it permanently there. */}
        <span
          className={`text-[11px] transition-opacity ${
            showFavourite ? "group-hover/row:opacity-0" : ""
          } ${showFavourite && isFavourite ? "opacity-0" : ""} ${
            unreadCount ? "text-brand-500" : "text-gray-400"
          }`}
        >
          {timestamp}
        </span>
        {unreadCount ? (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-medium text-white">
            {unreadCount}
          </span>
        ) : null}
      </span>
    </button>

    {/* Revealed on hover, and kept visible once set so a favourited chat is
        identifiable without hovering every row to find it. */}
    {showFavourite && (
    <button
      type="button"
      onClick={toggleFavourite}
      aria-pressed={isFavourite}
      aria-label={
        isFavourite ? `Remove ${name} from favourites` : `Add ${name} to favourites`
      }
      title={isFavourite ? "Remove from favourites" : "Add to favourites"}
      className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full transition-opacity hover:bg-gray-200/70 focus-visible:opacity-100 group-hover/row:opacity-100 dark:hover:bg-gray-700/70 ${
        isFavourite ? "opacity-100" : "opacity-0"
      }`}
    >
      <LuStar
        className={`h-3.5 w-3.5 ${
          isFavourite
            ? "fill-amber-400 text-amber-400"
            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        }`}
      />
    </button>
    )}
    </div>
  );
}
