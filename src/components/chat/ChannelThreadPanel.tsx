"use client";

import { useState } from "react";
import { LuBell, LuBellOff, LuChevronDown, LuCircleX, LuHash, LuLock, LuSearch } from "react-icons/lu";
import ChannelOnboardingCards from "./ChannelOnboardingCards";
import ChatThreadView from "./ChatThreadView";
import HeaderMessageSearch from "./HeaderMessageSearch";
import { useThreadSearch } from "@/hooks/useThreadSearch";
import { useChatMessages } from "@/hooks/useChatMessages";
import type { ChatChannel } from "@/types/chat";

/**
 * A channel's message area.
 *
 * Differs from the DM thread in two ways: messages carry an author, since any
 * member can post, and a freshly created channel opens on its setup state —
 * the origin line, the three onboarding cards, and the welcome banner — rather
 * than on empty history.
 */
export default function ChannelThreadPanel({
  channel,
  onOpenProfile,
}: {
  channel: ChatChannel;
  /** Opens the details panel — where a channel's members are managed. */
  onOpenProfile?: () => void;
}) {
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const search = useThreadSearch();
  const { messages } = useChatMessages(channel.id);

  /* "New" means nothing has been said yet — only the SYSTEM rows the server
     writes on creation. Once someone posts, the setup cards make way for the
     conversation. */
  const isNew = messages.every((m) => m.kind === "SYSTEM");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-100 px-6 dark:border-gray-800">
        {/* The whole title opens the details panel, matching the DM header. */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {channel.privacy === "PRIVATE" ? (
            <LuLock className="h-4 w-4 shrink-0 text-gray-700 dark:text-gray-200" />
          ) : (
            <LuHash className="h-4 w-4 shrink-0 text-gray-700 dark:text-gray-200" />
          )}
          <span className="min-w-0 truncate text-base font-semibold text-gray-900 dark:text-gray-100">
            {channel.name ?? "Channel"}
          </span>
          <span className="shrink-0 text-xs text-gray-400">
            {channel.members?.length ?? 0}
          </span>
        </button>
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
          <button
            type="button"
            aria-label="Search in conversation"
            onClick={search.toggle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <LuSearch className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      <div className="shrink-0 overflow-y-auto px-6 py-5">
        {/* Origin line — only meaningful while the channel is still new. */}
        {isNew && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              You created this channel today. This is the very beginning of the{" "}
              <strong className="font-semibold text-gray-900 dark:text-gray-100">
                {channel.name ?? "Channel"}
              </strong>{" "}
              channel.
            </p>

            <div className="mt-5">
              <ChannelOnboardingCards
                isPrivate={channel.privacy === "PRIVATE"}
                onAddPeople={onOpenProfile}
              />
            </div>

            {/* Day divider */}
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <button
                type="button"
                className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Today
                <LuChevronDown className="h-3 w-3" />
              </button>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            </div>
          </>
        )}

        {/* Welcome banner */}
        {isNew && !welcomeDismissed && (
          <div className="relative mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-905">
            <button
              type="button"
              aria-label="Dismiss welcome message"
              onClick={() => setWelcomeDismissed(true)}
              className="absolute right-3 top-3 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
            >
              <LuCircleX className="h-4 w-4" />
            </button>

            <p className="pr-8 text-sm font-semibold text-gray-900 dark:text-gray-100">
              👋 Welcome to #{(channel.name ?? "channel").toLowerCase()}
            </p>
            <p className="mt-1 pr-8 text-sm text-gray-600 dark:text-gray-300">
              Group this channel with similar conversations in your sidebar and
              choose when you want to be notified about new messages.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                aria-label="Mute this channel"
                className="flex h-8 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <LuBellOff className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <LuBell className="h-3.5 w-3.5" />
                All new posts
                <LuChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Timeline + composer. The onboarding block above scrolls in its own
          container so a brand-new channel shows the setup cards without them
          competing with message history for scroll position. */}
      <ChatThreadView
        room={channel}
        searchQuery={search.query}
        activeMatchIndex={search.activeIndex}
        onMatchCountChange={search.setMatchCount}
      />
    </div>
  );
}
