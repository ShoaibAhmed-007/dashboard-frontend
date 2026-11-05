"use client";

import {
  LuChevronDown,
  LuListPlus,
  LuPhone,
  LuSearch,
  LuVideo,
} from "react-icons/lu";
import ChatAvatar from "./ChatAvatar";
import ChatThreadView from "./ChatThreadView";
import HeaderMessageSearch from "./HeaderMessageSearch";
import { useThreadSearch } from "@/hooks/useThreadSearch";
import { useAuthStore } from "@/stores/auth.store";
import { useChatStore } from "@/stores/chat.store";
import { roomAvatarUrl, roomTitle } from "@/lib/chat/format";
import type { ChatChannel } from "@/types/chat";

/**
 * A direct message thread: header, timeline, composer.
 *
 * The call/video/search actions are presentational — there is no calling
 * backend, so they render but do nothing.
 */
export default function ChatThreadPanel({
  conversation,
  onOpenProfile,
}: {
  conversation: ChatChannel | null;
  onOpenProfile?: () => void;
}) {
  const search = useThreadSearch();
  const selfId = useAuthStore((s) => s.user?.id);
  const onlineStatus = useChatStore((s) => s.onlineStatus);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          No conversation selected
        </p>
        <p className="max-w-xs text-xs text-gray-400">
          Pick a chat from the list to see its messages.
        </p>
      </div>
    );
  }

  const title = roomTitle(conversation, selfId);
  const other = conversation.members.find((m) => m.userId !== selfId);
  const presence = other ? onlineStatus[other.userId] : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-100 px-4 dark:border-gray-800">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChatAvatar
            name={title}
            avatarUrl={roomAvatarUrl(conversation, selfId)}
            size={36}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
              {title}
            </span>
            {presence?.isOnline && (
              <span className="block text-[11px] text-emerald-500">Online</span>
            )}
          </span>
        </button>

        {/* Hidden while searching so the field has room to expand into. */}
        {!search.isOpen && (
          <>
            <button
              type="button"
              className="hidden h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 sm:flex dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <LuListPlus className="h-3.5 w-3.5" />
              Add to list
              <LuChevronDown className="h-3 w-3" />
            </button>
            {[
              { icon: LuVideo, label: "Start a video call" },
              { icon: LuPhone, label: "Start a voice call" },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <Icon className="h-[18px] w-[18px]" />
              </button>
            ))}
          </>
        )}

        <HeaderMessageSearch
          isOpen={search.isOpen}
          query={search.query}
          onQueryChange={search.changeQuery}
          matchCount={search.matchCount}
          activeIndex={search.matchCount ? search.activeIndex : -1}
          onPrev={search.prev}
          onNext={search.next}
          onClose={search.close}
        />

        {!search.isOpen && (
          <>
            <button
              type="button"
              aria-label="Search in conversation"
              onClick={search.toggle}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <LuSearch className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              aria-label="More options"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <LuChevronDown className="h-[18px] w-[18px]" />
            </button>
          </>
        )}
      </div>

      <ChatThreadView
        room={conversation}
        searchQuery={search.query}
        activeMatchIndex={search.activeIndex}
        onMatchCountChange={search.setMatchCount}
      />
    </div>
  );
}
