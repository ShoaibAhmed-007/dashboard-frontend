"use client";

import { useCallback, useEffect } from "react";
import { chatService } from "@/services/chat.service";
import { channelService } from "@/services/channel.service";
import { useChatStore } from "@/stores/chat.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useAuthStore } from "@/stores/auth.store";
import type { ChatChannel } from "@/types/chat";

/**
 * Loads the workspace's channels and the caller's DMs — archived ones
 * included — into the chat store.
 *
 * The two come from different endpoints with different shapes, so they are
 * normalised here rather than at every call site:
 *
 * - The channel list omits `isArchived`/`isFavourite` at the top level, but
 *   both are present on `viewerMembership`. We hoist them so the rest of the
 *   app can read one consistent field.
 * - Only the DM endpoint returns `lastMessage`, so channel rows simply have
 *   none and the list falls back to showing no preview.
 */
export function useChatRooms() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const selfId = useAuthStore((s) => s.user?.id);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const store = useChatStore.getState();
    store.setChannelsLoading(true);
    store.setChannelsError(null);

    try {
      /* Archived rooms are fetched here too, not lazily when the Archived view
         is opened: its count is on screen from the first paint, so deferring
         the request would render a 0 that corrects itself on click. */
      const [channels, dms, archivedDms] = await Promise.all([
        channelService.getChannels(activeWorkspaceId),
        chatService.getDms(),
        chatService.getDms({ archived: true }),
      ]);

      /* The channel list is not filtered by `kind` server-side, so it returns
         DMs too — and `GET /chat/dms` returns them again. Merging by id keeps
         one row per room; the DM entry wins because only that endpoint
         populates `lastMessage`, which the list preview needs. */
      const byId = new Map<string, ChatChannel>();
      for (const room of [...channels, ...dms]) {
        byId.set(room.id, {
          ...room,
          isArchived:
            room.isArchived ?? room.viewerMembership?.isArchived ?? false,
          isFavourite:
            room.isFavourite ?? room.viewerMembership?.isFavourite ?? false,
        });
      }

      /* `GET /chat/dms` excludes archived rooms, but the channel list applies
         no such filter — so an archived room can still arrive here. Archived
         rooms belong in the store's own archived slice, never in this one. */
      store.setChannels(
        Array.from(byId.values()).filter((room) => !room.isArchived)
      );

      store.setArchived(
        archivedDms.map((room) => ({
          ...room,
          isArchived: true,
          isFavourite:
            room.isFavourite ?? room.viewerMembership?.isFavourite ?? false,
        }))
      );

      // So "message this person" can resolve to an existing DM.
      if (selfId) {
        for (const dm of dms) {
          const other = dm.members.find((m) => m.userId !== selfId);
          if (other) store.setUserToChannelId(other.userId, dm.id);
        }
      }
    } catch {
      store.setChannelsError("Couldn't load conversations.");
    } finally {
      store.setChannelsLoading(false);
    }
  }, [activeWorkspaceId, selfId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { reload: load };
}
