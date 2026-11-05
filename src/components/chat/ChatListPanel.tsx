"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LuArchive,
  LuArchiveRestore,
  LuArrowLeft,
  LuBell,
  LuEllipsisVertical,
  LuHash,
  LuLock,
  LuPlus,
  LuSearch,
  LuSquarePen,
  LuX,
} from "react-icons/lu";
import ChatConversationRow from "./ChatConversationRow";
import ChatSearchResults from "./ChatSearchResults";
import NewChatDialog from "./NewChatDialog";
import AddPeopleToChannelDialog from "./AddPeopleToChannelDialog";
import CreateChannelDialog from "./CreateChannelDialog";
import ChatFilterPills, { type ChatFilter } from "./ChatFilterPills";
import { toast } from "sonner";
import { channelService } from "@/services/channel.service";
import { parseApiError } from "@/lib/api";
import { useChatStore } from "@/stores/chat.store";
import { useArchivedRooms } from "@/hooks/useArchivedRooms";
import { chatService } from "@/services/chat.service";
import { useAuthStore } from "@/stores/auth.store";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";
import { roomTitle } from "@/lib/chat/format";
import type { ChatChannel, ChatMessage } from "@/types/chat";


/**
 * The Chat module's list pane — search, quick filters, channels, and direct
 * messages. Renders inside the sidebar's contextual panel, so it owns no
 * chrome of its own beyond its header.
 *
 * UI-only for now: conversations come from `mockChatData`, and selection is
 * local state rather than a route.
 */
export default function ChatListPanel({
  activeId,
  onSelect,
  showArchived,
  onShowArchivedChange,
  onJumpToMessage,
}: {
  activeId: string | null;
  /** Fires for channels and direct messages alike — ids are unique across
   *  both, so the page resolves which kind it is. */
  onSelect: (id: string) => void;
  /* Owned by the page rather than here: archiving happens in the profile
     panel, and the list has to follow the conversation across that boundary —
     which it cannot do from state only it can see. */
  showArchived: boolean;
  onShowArchivedChange: (next: boolean) => void;
  /** A search hit was picked — scroll that message into view once its room
   *  is open. */
  onJumpToMessage?: (message: ChatMessage) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const setShowArchived = onShowArchivedChange;
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  /* Set once a channel is created, which opens the invite dialog for it. Null
     means no invite prompt is pending. */
  const [invitingToChannel, setInvitingToChannel] =
    useState<ChatChannel | null>(null);
  const inviteTimer = useRef<number | null>(null);

  // Leaving Chat before the delay elapses would otherwise set state on an
  // unmounted component.
  useEffect(
    () => () => {
      if (inviteTimer.current !== null) window.clearTimeout(inviteTimer.current);
    },
    []
  );

  const selfId = useAuthStore((state) => state.user?.id);
  const channels = useChatStore((state) => state.channels);
  const channelsLoading = useChatStore((state) => state.channelsLoading);

  /* Archived rooms are hidden from every view except the Archived one, which
     is a separate fetch — mirroring the server's own default. */
  const visible = useMemo(
    () => channels.filter((room) => !room.isArchived),
    [channels]
  );
  const channelRooms = useMemo(
    () => visible.filter((room) => room.kind === "CHANNEL"),
    [visible]
  );
  const dmRooms = useMemo(
    () => visible.filter((room) => room.kind === "DM"),
    [visible]
  );
  /* Each count is scoped to exactly what its view lists, so the number on the
     pill can never exceed the rows behind it: Unread spans channels and DMs
     alike, Favourites is DM-only. */
  const counts = useMemo(
    () => ({
      unread: visible.filter((room) => room.unreadCount > 0).length,
      favourites: dmRooms.filter((room) => room.isFavourite).length,
    }),
    [visible, dmRooms]
  );

  /* Search applies in the Archived view too, where the filter pills do not —
     hence the split. */
  const matchesSearch = useCallback(
    (room: ChatChannel) => {
      const needle = search.trim().toLowerCase();
      if (!needle) return true;
      return roomTitle(room, selfId).toLowerCase().includes(needle);
    },
    [search, selfId]
  );

  const matches = useCallback(
    (room: ChatChannel) => {
      if (filter === "unread" && room.unreadCount === 0) return false;
      if (filter === "favourites" && !room.isFavourite) return false;
      return matchesSearch(room);
    },
    [filter, matchesSearch]
  );

  const filteredChannels = useMemo(
    () => channelRooms.filter(matches),
    [channelRooms, matches]
  );
  const conversations = useMemo(
    () => dmRooms.filter(matches),
    [dmRooms, matches]
  );

  /* A filter answers one question, so everything that does not help answer it
     is dropped rather than left sitting alongside the results:

     - Favourites is about DMs, so the Channels section goes.
     - Neither filter has anything to say about channel creation or the archive,
       so "Add Channel" and the Archived row are hidden until "All" is back.

     `all` is the only view that shows the list in full. */
  /* A search covers the whole workspace, so it replaces the list rather than
     narrowing it — the pills and the local filters do not apply to results
     that can come from rooms not in the list at all. */
  const isSearching = search.trim().length > 0 && !showArchived;
  const isFiltered = filter !== "all";
  const showChannels = filter === "all" || filter === "unread";

  /* Under a filter each section appears only if it has results, so when
     neither does the pane would be blank — one message covers both rather
     than each section carrying its own "nothing here". */
  const nothingMatched =
    (!showChannels || filteredChannels.length === 0) &&
    conversations.length === 0;

  const archived = useChatStore((state) => state.archived);
  const archivedLoading = useChatStore((state) => state.archivedLoading);
  const unarchiveChannel = useChatStore((state) => state.unarchiveChannel);
  const { load: loadArchived } = useArchivedRooms();

  /* The list is already populated on mount (see `useChatRooms`) — this is a
     refresh on open, so a room archived in another session or on another
     device appears. The existing rows stay put meanwhile, so the view never
     flashes empty. */
  useEffect(() => {
    if (showArchived) void loadArchived();
  }, [showArchived, loadArchived]);

  const archivedRooms = useMemo(
    () => archived.filter(matchesSearch),
    [archived, matchesSearch]
  );

  /* The prompt reflects the browser's real permission rather than a flag of
     our own: "granted" needs no prompt at all, and "denied" cannot be undone
     from script — only in browser settings — so it says so instead of
     offering a button that would silently do nothing. */
  const { permission, requestPermission } = useSystemNotifications();
  const showNotificationPrompt = !bannerDismissed && permission !== "granted";

  const handleEnableNotifications = async () => {
    setRequestingPermission(true);
    try {
      const result = await requestPermission();
      if (result === "granted") {
        toast.success("Message notifications are on.");
      } else if (result === "denied") {
        toast.error("Notifications blocked. Enable them in browser settings.");
      }
    } finally {
      setRequestingPermission(false);
    }
  };

  const restore = async (room: ChatChannel) => {
    // Optimistic: the row leaves the archived list at once, and is put back if
    // the call fails.
    unarchiveChannel(room.id);
    try {
      await chatService.setArchived(room.id, false);
      /* Follow it back. Restoring the room you have open and staying in
         Archived would leave you looking at the list it just left. */
      if (room.id === activeId) setShowArchived(false);
      toast.success("Conversation restored.");
    } catch (err) {
      useChatStore.getState().archiveChannel(room.id);
      toast.error(parseApiError(err).message || "Couldn't restore that chat.");
    }
  };


  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
        {showArchived ? (
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            className="flex min-w-0 items-center gap-2 rounded-lg text-base font-semibold text-gray-900 transition-colors hover:text-brand-500 dark:text-gray-100"
          >
            <LuArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">Archived</span>
          </button>
        ) : (
          <h2 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
            Dashboard Chat
          </h2>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="New chat"
            onClick={() => setNewChatOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <LuSquarePen className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Chat options"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <LuEllipsisVertical className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 pb-2">
        <div className="relative">
          <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search or start a new chat"
            aria-label="Search chats"
            className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      {!showArchived && !isSearching && (
        <ChatFilterPills active={filter} counts={counts} onChange={setFilter} />
      )}

      {/* Results sit directly under the box they belong to, and take over the
          pane: a workspace-wide search can return rooms that are not in the
          list at all, so leaving Channels/Archived/DMs alongside them would
          imply the results are a subset of what is on screen. */}
      {isSearching ? (
        <ChatSearchResults
          query={search}
          onSelectRoom={(id) => {
            onSelect(id);
            setSearch("");
          }}
          onSelectMessage={(message) => {
            onSelect(message.channelId);
            onJumpToMessage?.(message);
            setSearch("");
          }}
        />
      ) : showArchived ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {archivedLoading && archivedRooms.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-400">Loading…</p>
          )}
          {!archivedLoading && archivedRooms.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <LuArchive className="mx-auto h-6 w-6 text-gray-300 dark:text-gray-600" />
              <p className="mt-2 text-xs text-gray-400">
                {search.trim()
                  ? "No archived chats match that search."
                  : "No archived chats."}
              </p>
            </div>
          ) : (
            archivedRooms.map((room) => (
              /* The row itself still opens the conversation — archiving hides
                 it from the list, it does not close it — with restore as a
                 separate control. Nested buttons are invalid, so the restore
                 control sits beside the row rather than inside it. */
              <div key={room.id} className="group relative">
                <ChatConversationRow
                  conversation={room}
                  selfUserId={selfId}
                  isActive={room.id === activeId}
                  onClick={() => onSelect(room.id)}
                  showFavourite={false}
                />
                {/* Overlaid rather than placed in flow, so the row keeps the
                    full width its selected background needs. */}
                <button
                  type="button"
                  aria-label={`Restore ${roomTitle(room, selfId)}`}
                  title="Restore"
                  onClick={() => void restore(room)}
                  className={`absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 opacity-0 shadow-sm transition-opacity hover:text-gray-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-gray-200 ${
                    // Matches whichever background is under it, so the control
                    // reads as part of the row rather than floating on it.
                    room.id === activeId
                      ? "bg-gray-100 dark:bg-gray-905"
                      : "bg-gray-50 dark:bg-gray-905"
                  }`}
                >
                  <LuArchiveRestore className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
      /* Everything below the filters scrolls together, so the search and
          pills stay put while a long conversation list moves. */
      <div className="min-h-0 flex-1 overflow-y-auto">
        {showNotificationPrompt && (
          <div className="mx-3 mb-2 flex items-start gap-2.5 rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-905">
            <LuBell className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <p className="min-w-0 flex-1 text-xs text-gray-600 dark:text-gray-300">
              {permission === "denied"
                ? "Notifications are blocked in your browser settings."
                : "Message notifications are off."}{" "}
              {permission === "default" && (
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  disabled={requestingPermission}
                  className="font-medium text-brand-500 hover:text-brand-600 disabled:opacity-60"
                >
                  {requestingPermission ? "Asking\u2026" : "Turn on"}
                </button>
              )}
            </p>
            <button
              type="button"
              aria-label="Dismiss notification banner"
              onClick={() => setBannerDismissed(true)}
              className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <LuX className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Channels. Under a filter the heading is only drawn when something
            matched — an empty "Channels" label is noise in a filtered view,
            though it still belongs in "All" as the place channels live. */}
        {showChannels && (!isFiltered || filteredChannels.length > 0) && (
        <>
        <p className="px-4 pb-1 pt-2 text-xs font-semibold text-gray-900 dark:text-gray-100">
          Channels
        </p>
        {channelsLoading && filteredChannels.length === 0 && (
          <p className="px-4 py-2 text-xs text-gray-400">Loading…</p>
        )}
        {filteredChannels.map((channel) => {
          const isActive = channel.id === activeId;
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelect(channel.id)}
              aria-current={isActive ? "true" : undefined}
              className={`flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors ${
                isActive
                  ? "bg-gray-100 dark:bg-gray-905"
                  : "hover:bg-gray-50 dark:hover:bg-gray-905/70"
              }`}
            >
              {channel.privacy === "PRIVATE" ? (
                <LuLock className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <LuHash className="h-4 w-4 shrink-0 text-gray-400" />
              )}
              <span
                className={`flex-1 truncate text-sm ${
                  channel.deletedAt
                    ? "text-gray-400 line-through dark:text-gray-500"
                    : "text-gray-700 dark:text-gray-300"
                }`}
                title={
                  channel.deletedAt
                    ? "Deleted — history only, no new messages"
                    : undefined
                }
              >
                {roomTitle(channel, selfId)}
              </span>
              {channel.unreadCount > 0 && (
                <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-medium text-white">
                  {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
                </span>
              )}
            </button>
          );
        })}
        {/* Both are actions on the list as a whole rather than entries in it,
            so they only belong in the unfiltered view. */}
        {!isFiltered && (
          <button
            type="button"
            onClick={() => setCreateChannelOpen(true)}
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm text-gray-500 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-905/70"
          >
            <LuPlus className="h-4 w-4 shrink-0" />
            Add Channel
          </button>
        )}
        </>
        )}

        {/* Archived — opens the archived list in place of this one. */}
        {!isFiltered && (
        <button
          type="button"
          onClick={() => setShowArchived(true)}
          className="mt-2 flex w-full items-center gap-2 border-y border-gray-100 px-4 py-2.5 text-left transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-905/70"
        >
          <LuArchive className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Archived
          </span>
          <span className="text-xs text-gray-400">{archived.length}</span>
        </button>
        )}

        {/* Direct messages — same rule as Channels above: under a filter the
            heading only appears when something matched. */}
        {(!isFiltered || conversations.length > 0) && (
        <>
        <p className="px-4 pb-1 pt-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
          Direct Messages
        </p>
        {conversations.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-gray-400">
            {search.trim() ? "No chats match that search." : "No chats yet."}
          </p>
        ) : (
          conversations.map((conversation) => (
            <ChatConversationRow
              key={conversation.id}
              conversation={conversation}
              selfUserId={selfId}
              isActive={conversation.id === activeId}
              onClick={() => onSelect(conversation.id)}
            />
          ))
        )}
        </>
        )}

        {/* One message for the whole filtered view, once both sections have
            come up empty. */}
        {isFiltered && nothingMatched && (
          <p className="px-4 py-8 text-center text-xs text-gray-400">
            {search.trim()
              ? "Nothing matches that search."
              : filter === "favourites"
                ? "No favourite chats."
                : "Nothing unread."}
          </p>
        )}
      </div>
      )}

      <NewChatDialog
        isOpen={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onOpenChat={onSelect}
      />

      <CreateChannelDialog
        isOpen={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        onSubmit={async ({ name, isPrivate }) => {
          try {
            const created = await channelService.createChannel(
              name,
              isPrivate ? "PRIVATE" : "PUBLIC"
            );
            useChatStore.getState().upsertChannel(created);
            onSelect(created.id);
            /* Only a private channel needs an invite step. The server adds
               every workspace member to a public channel on creation (and to
               anyone who joins the workspace later), so there is nobody left
               to invite — prompting would offer an empty list.

               Delayed so the create dialog is visibly gone before the invite
               one arrives — chaining them in the same frame reads as the panel
               swapping its contents rather than a new step. */
            if (isPrivate) {
              inviteTimer.current = window.setTimeout(
                () => setInvitingToChannel(created),
                320
              );
            }
          } catch (err) {
            toast.error(
              parseApiError(err).message || "Couldn't create that channel."
            );
          }
        }}
      />

      {/* Opens after creation succeeds — the channel exists by this point, so
          inviting is a follow-up action rather than part of the flow. */}
      <AddPeopleToChannelDialog
        isOpen={invitingToChannel !== null}
        channelId={invitingToChannel?.id ?? ""}
        channelName={invitingToChannel?.name ?? ""}
        onClose={() => setInvitingToChannel(null)}
      />
    </div>
  );
}
