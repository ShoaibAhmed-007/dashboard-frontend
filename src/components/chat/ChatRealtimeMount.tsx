"use client";

import { useChatRealtime } from "@/hooks/useChatRealtime";
import { useChatRooms } from "@/hooks/useChatRooms";

/**
 * Keeps the chat and presence sockets connected for the whole admin area.
 *
 * Mounted at the layout level on purpose: unread badges, presence dots and
 * live message delivery have to work while the user is anywhere in the app,
 * not only while the Chat module is open. This previously lived inside
 * `DmSidebarSection`, which meant realtime silently died whenever that
 * component was not rendered.
 *
 * Renders nothing.
 */
export default function ChatRealtimeMount() {
  useChatRealtime();
  useChatRooms();
  return null;
}
