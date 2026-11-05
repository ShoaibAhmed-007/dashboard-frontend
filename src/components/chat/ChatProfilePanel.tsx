"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LuArchive,
  LuClock,
  LuFile,
  LuFlag,
  LuMail,
  LuPhoneCall,
  LuStar,
  LuTrash2,
  LuUser,
  LuX,
} from "react-icons/lu";
import { userService } from "@/services/user.service";
import { chatService } from "@/services/chat.service";
import { channelService } from "@/services/channel.service";
import { parseApiError } from "@/lib/api";
import { useChatStore } from "@/stores/chat.store";
import { useAuthStore } from "@/stores/auth.store";
import { roomAvatarUrl, roomTitle } from "@/lib/chat/format";
import ChatAvatar from "./ChatAvatar";
import ChannelMembersSection from "./ChannelMembersSection";
import type { UserProfile } from "@/hooks/useProfile";
import ImageViewerModal from "@/components/ui/ImageViewerModal";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import type {
  ChannelAttachments,
  ChatAttachment,
  ChatChannel,
} from "@/types/chat";

/**
 * Right-hand detail panel for the open conversation.
 *
 * Chat-specific rather than a reuse of `ViewUserProfilePanel`: it carries room
 * actions (favourite, archive) that a generic profile view has no business
 * knowing about.
 *
 * Priorities and SyncUp remain inert — the design calls for them but no
 * endpoint exists yet.
 */
export default function ChatProfilePanel({
  room,
  isOpen,
  onClose,
  onArchivedChange,
}: {
  room: ChatChannel | null;
  isOpen: boolean;
  onClose: () => void;
  /** Fires with the room's new archived state, so the list can follow it. */
  onArchivedChange?: (archived: boolean) => void;
}) {
  const selfId = useAuthStore((s) => s.user?.id);
  const onlineStatus = useChatStore((s) => s.onlineStatus);
  const patchChannel = useChatStore((s) => s.patchChannel);
  const archiveChannel = useChatStore((s) => s.archiveChannel);
  const unarchiveChannel = useChatStore((s) => s.unarchiveChannel);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [media, setMedia] = useState<ChannelAttachments | null>(null);
  /** The image shown full-size, or null when the viewer is closed. */
  const [preview, setPreview] = useState<ChatAttachment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const other = room?.members.find((m) => m.userId !== selfId) ?? null;
  const isDm = room?.kind === "DM";
  const isArchived = Boolean(room?.isArchived);

  /* Keyed on the person, so switching rooms refetches rather than showing the
     previous profile. Clearing on close is handled by the render guard below,
     not by writing state from this effect. */
  const otherUserId = isOpen && isDm ? other?.userId : undefined;

  useEffect(() => {
    if (!otherUserId) return;
    let cancelled = false;
    userService
      .getById(otherUserId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [otherUserId]);

  /* Only fetched when the panel is actually open: the endpoint scans the whole
     message history and signs fresh S3 URLs, so firing it alongside every
     conversation load would be a wasted round trip. The URLs expire in 15
     minutes, which is why this refetches on each open rather than caching. */
  const mediaChannelId = isOpen ? room?.id : undefined;

  useEffect(() => {
    if (!mediaChannelId) return;
    let cancelled = false;
    chatService
      .getChannelAttachments(mediaChannelId)
      .then((result) => {
        if (!cancelled) setMedia(result);
      })
      .catch(() => {
        if (!cancelled) setMedia(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaChannelId]);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  /* Only the *contents* are dropped when there is no room — the shell stays
     mounted so its width can animate. Unmounting on close would make the panel
     appear and vanish instantly, with nothing to transition between. Both
     fetches above are gated on `isOpen`, so staying mounted costs no requests. */
  if (!room) return null;

  /* Only trust the fetched profile if it is this conversation's person — a
     stale one can linger for a frame after switching rooms. */
  const shownProfile = profile && profile.id === otherUserId ? profile : null;
  /* Images first — they are the only ones with a useful thumbnail; everything
     else falls back to a file glyph. Capped at 8 to keep the panel compact. */
  const allMedia = media
    ? [...media.images, ...media.videos, ...media.files]
    : [];
  const totalMedia = allMedia.length;
  const previews = allMedia.slice(0, 8);

  const title = roomTitle(room, selfId);
  const presence = other ? onlineStatus[other.userId] : undefined;

  const toggleFavourite = async () => {
    const next = !room.isFavourite;
    patchChannel(room.id, { isFavourite: next });
    try {
      await chatService.setFavourite(room.id, next);
    } catch (err) {
      patchChannel(room.id, { isFavourite: !next });
      toast.error(parseApiError(err).message || "Couldn't update favourite.");
    }
  };

  /* OWNER only — ADMINs can rename but not freeze. `deletedAt` also gates it
     so an already-frozen channel does not offer the action again. */
  const myChannelRole = room?.members.find((m) => m.userId === selfId)?.role;
  const canDeleteChannel =
    !isDm && myChannelRole === "OWNER" && !room?.deletedAt;

  const deleteChannel = async () => {
    if (!room) return;
    setDeleting(true);
    try {
      await channelService.deleteChannel(room.id);
      /* The endpoint returns nothing, so the flag is patched locally — that
         is what swaps the composer for the notice without a refetch. */
      patchChannel(room.id, { deletedAt: new Date().toISOString() });
      setConfirmDelete(false);
      toast.success("Channel deleted. Its history is still readable.");
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't delete the channel.");
    } finally {
      setDeleting(false);
    }
  };

  /* Archiving is per-person, so the other participant's list is untouched.
     The room stays reachable under Archived, and a new message from either
     side brings it back (see `useChatRealtime`). */
  const toggleArchived = async () => {
    const next = !isArchived;
    try {
      await chatService.setArchived(room.id, next);
      if (next) archiveChannel(room.id);
      else unarchiveChannel(room.id);
      /* The list follows the conversation across the boundary, so you stay
         beside the chat you just moved instead of being left looking at the
         list it left. */
      onArchivedChange?.(next);
      toast.success(next ? "Conversation archived." : "Conversation restored.");
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't update archive.");
    }
  };

  return (
    /* Slides in by animating its width rather than sliding over the thread:
       collapsed to nothing it takes no space, so the conversation reflows
       alongside it instead of being covered. `overflow-hidden` clips the
       fixed-width contents while that width is in between. Matches
       `ViewUserProfilePanel`, the app's other right-hand panel. */
    <aside
      aria-hidden={!isOpen}
      className={`flex h-full shrink-0 flex-col overflow-hidden bg-white transition-[width] duration-300 ease-in-out dark:bg-gray-900 ${
        isOpen
          ? "w-80 border-l border-gray-200 dark:border-gray-800"
          : "w-0 border-l-0"
      }`}
    >
      {/* Held at the panel's open width so the contents are clipped by the
          animating shell rather than reflowing — text re-wrapping on every
          frame would read as a stutter rather than a slide. */}
      <div className="flex h-full w-80 shrink-0 flex-col">
      <div className="flex shrink-0 justify-end p-3">
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <LuX className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {/* Identity */}
        <div className="rounded-xl border border-gray-200 p-4 text-center dark:border-gray-800">
          <div className="flex justify-center">
            <ChatAvatar
              name={title}
              avatarUrl={
                shownProfile?.profilePicture ?? roomAvatarUrl(room, selfId)
              }
              size={72}
            />
          </div>
          <p className="mt-3 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: LuUser, label: "Profile", inert: false },
              { icon: LuFlag, label: "Priorities", inert: true },
              { icon: LuPhoneCall, label: "SyncUp", inert: true },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                className="flex flex-col items-center gap-1.5 rounded-lg py-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Members — channels only; a DM's two participants are the header. */}
        {!isDm && <ChannelMembersSection channel={room} />}

        {/* Details — DMs only; a channel has no single person behind it. */}
        {isDm && (
          <div className="space-y-2.5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300">
              <LuClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              {presence?.isOnline
                ? "Online now"
                : presence?.lastSeenAt
                  ? `Last online ${new Date(presence.lastSeenAt).toLocaleDateString()}`
                  : "Offline"}
            </p>
            {shownProfile?.email && (
              <p className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300">
                <LuMail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="truncate">{shownProfile.email}</span>
              </p>
            )}
            {shownProfile?.localTime && (
              <p className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300">
                <LuClock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {shownProfile.localTime}
              </p>
            )}
          </div>
        )}

        {/* No endpoint lists a room's attachments yet — placeholder only. */}
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            Media, Links and docs
          </p>
          {previews.length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">
              Nothing shared here yet.
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {previews.map((item) =>
                  /* Images open in the viewer, in place; anything else has no
                     preview to show, so it opens inline in a new tab. */
                  item.mimeType.startsWith("image/") && item.url ? (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPreview(item)}
                      title={item.fileName}
                      className="aspect-square cursor-zoom-in overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.fileName}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      title={item.fileName}
                      className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-gray-100 text-gray-400 dark:bg-gray-800"
                    >
                      <LuFile className="h-4 w-4" />
                    </a>
                  )
                )}
              </div>
              {totalMedia > previews.length && (
                <p className="mt-2 text-[11px] text-gray-400">
                  +{totalMedia - previews.length} more
                </p>
              )}
            </>
          )}
        </div>

        {/* Options */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800">
          <p className="px-4 pb-1 pt-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
            Options
          </p>

          <button
            type="button"
            onClick={toggleFavourite}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <LuStar
              className={`h-4 w-4 shrink-0 ${
                room.isFavourite
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-400"
              }`}
            />
            <span className="flex-1">
              {room.isFavourite ? "Remove from favourites" : "Favorite"}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleArchived}
            className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800 ${
              canDeleteChannel ? "" : "rounded-b-xl"
            }`}
          >
            <LuArchive className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="flex-1">
              {isArchived ? "Unarchive" : "Archive"}
            </span>
          </button>

          {/* OWNER only, and only while the channel is live — the server
              rejects everyone else and no-ops a repeat. */}
          {canDeleteChannel && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-start gap-2.5 rounded-b-xl px-4 py-2.5 text-left transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <LuTrash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <span>
                <span className="block text-sm text-red-500">
                  Delete channel
                </span>
                <span className="block text-[11px] text-gray-400">
                  History is kept; no new messages
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
      </div>

      <ConfirmActionModal
        isOpen={confirmDelete}
        title={`Delete ${room.name ?? "this channel"}?`}
        description="Members keep access to the whole message history, but nobody will be able to send anything new. This cannot be undone from the app."
        confirmLabel="Delete channel"
        isLoading={deleting}
        requireText={room.name ?? undefined}
        requireTextLabel="Type the channel name to confirm"
        onConfirm={deleteChannel}
        onClose={() => setConfirmDelete(false)}
      />

      <ImageViewerModal
        isOpen={preview !== null}
        url={preview?.url ?? null}
        fileName={preview?.fileName ?? ""}
        downloadUrl={preview?.downloadUrl}
        onClose={() => setPreview(null)}
      />
    </aside>
  );
}
