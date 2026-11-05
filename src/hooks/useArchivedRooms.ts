"use client";

import { useCallback } from "react";
import { chatService } from "@/services/chat.service";
import { useChatStore } from "@/stores/chat.store";

/**
 * Loads the caller's archived conversations on demand.
 *
 * Kept out of `useChatRooms` deliberately: archiving is per-person and rare,
 * so the extra request is only worth making when the Archived view is actually
 * opened. Archiving from within the app moves the room across the two store
 * slices directly (`archiveChannel`), so this fetch is only needed to pick up
 * rooms archived in an earlier session or on another device.
 */
export function useArchivedRooms() {
  const load = useCallback(async () => {
    const store = useChatStore.getState();
    store.setArchivedLoading(true);
    try {
      const rooms = await chatService.getDms({ archived: true });
      /* Same hoist as the active list: the API reports these flags on the
         caller's membership row, not at the room's top level. */
      store.setArchived(
        rooms.map((room) => ({
          ...room,
          isArchived: true,
          isFavourite:
            room.isFavourite ?? room.viewerMembership?.isFavourite ?? false,
        }))
      );
    } catch {
      // Non-fatal: the view falls back to whatever was archived this session.
    } finally {
      store.setArchivedLoading(false);
    }
  }, []);

  return { load };
}
