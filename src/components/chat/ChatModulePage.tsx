"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChannelThreadPanel from "./ChannelThreadPanel";
import ChatProfilePanel from "./ChatProfilePanel";
import ChatListPanel from "./ChatListPanel";
import ChatThreadPanel from "./ChatThreadPanel";
import { useChatStore } from "@/stores/chat.store";

/**
 * Chat module — conversation list beside the message thread.
 *
 * The list is rendered here rather than in the sidebar's contextual panel so
 * the whole module is reviewable as one screen in this first UI pass. Moving
 * the list into the rail panel is the follow-up step, once the layout is
 * signed off; `ChatListPanel` already takes `activeId`/`onSelect` so it can be
 * lifted without changing its internals.
 */
export default function ChatModulePage() {
  /* Seeded from `?channel=` so a notification's "View" lands on the right
     conversation. Read once via a lazy initialiser rather than an effect: it
     is an opening position, not a binding — clicking another chat afterwards
     should not be undone by a stale query string. */
  const searchParams = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(
    () => searchParams.get("channel")
  );
  const [profileOpen, setProfileOpen] = useState(false);
  /* Lives here rather than in the list: archiving happens in the profile
     panel, and the list has to follow the conversation across that boundary. */
  const [showArchived, setShowArchived] = useState(false);
  const channels = useChatStore((state) => state.channels);
  const archived = useChatStore((state) => state.archived);
  const setActiveChannel = useChatStore((state) => state.setActiveChannel);

  /* The thread always belongs to the list on screen. Switching to Archived
     while an ordinary chat is open would otherwise leave that chat in the
     pane, reading as though it were archived — and the same in reverse. */
  const rooms = showArchived ? archived : channels;

  /* Opening Chat with an empty pane wastes the first click, so the newest
     conversation stands in until the user picks one. Derived during render
     rather than pushed into state by an effect: the fallback is a pure
     function of the visible list, and writing it back would cost a second
     render pass and fight any deliberate deselection.

     Only DMs are candidates — `lastMessage` is populated by the DM endpoint
     alone. Rooms that have never been used sort last rather than being
     dropped, so a workspace whose DMs are all empty still opens one. */
  const newestDm = useMemo(() => {
    const dms = rooms.filter((room) => room.kind === "DM");
    if (dms.length === 0) return null;
    return dms.reduce((newest, room) => {
      const a = room.lastMessage?.createdAt;
      const b = newest.lastMessage?.createdAt;
      if (!a) return newest;
      if (!b) return room;
      return new Date(a).getTime() > new Date(b).getTime() ? room : newest;
    });
  }, [rooms]);

  /* DMs and channels are one entity discriminated by `kind`, so the selected
     id resolves to whichever thread view suits it.

     Looked up only within the visible list: a selection belonging to the other
     one no longer resolves, so the fallback takes over and the pane shows that
     list's newest conversation. This covers the switch in both directions and,
     because it is a derivation rather than stored state, archiving the open
     chat moves the pane with it for free. */
  const active =
    (activeId ? rooms.find((room) => room.id === activeId) : null) ??
    newestDm ??
    null;
  /* What the rest of the module treats as selected — the user's own choice
     once they make one, the fallback until then. */
  const resolvedId = active?.id ?? null;

  /* Tells the realtime hook which room is on screen, so its incoming messages
     don't raise an unread badge. */
  useEffect(() => {
    setActiveChannel(resolvedId);
    return () => setActiveChannel(null);
  }, [resolvedId, setActiveChannel]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-[10px] bg-white dark:bg-gray-900">
      {/* This list *is* Chat's sidebar — the rail's contextual panel is
          suppressed for this module — so it carries the panel's own styling:
          same muted background and border, at the wider width the rows need. */}
      <aside className="hidden w-[320px] shrink-0 flex-col border-r border-gray-200 bg-[#f9f9f9] dark:border-gray-800 dark:bg-gray-901 md:flex">
        <ChatListPanel
          activeId={resolvedId}
          onSelect={setActiveId}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
          onJumpToMessage={(message) => {
            /* The thread renders the loaded page; if the hit is older than
               that it will not be on screen yet, so this is best-effort until
               jump-to-context is wired. Deferred a frame so the room has
               switched before we look for the node. */
            window.requestAnimationFrame(() => {
              document
                .querySelector(`[data-message-id="${message.id}"]`)
                ?.scrollIntoView({ block: "center", behavior: "smooth" });
            });
          }}
        />
      </aside>
      <section className="min-w-0 flex-1">
        {active?.kind === "CHANNEL" ? (
          <ChannelThreadPanel
            channel={active}
            onOpenProfile={() => setProfileOpen(true)}
          />
        ) : (
          <ChatThreadPanel
            conversation={active}
            onOpenProfile={() => setProfileOpen(true)}
          />
        )}
      </section>

      <ChatProfilePanel
        room={active}
        isOpen={profileOpen && active !== null}
        onClose={() => setProfileOpen(false)}
        onArchivedChange={setShowArchived}
      />
    </div>
  );
}
