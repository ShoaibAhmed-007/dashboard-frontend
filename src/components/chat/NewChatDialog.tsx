"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { LuSearch, LuX } from "react-icons/lu";
import UserAvatar from "@/components/ui/UserAvatar";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useAuthStore } from "@/stores/auth.store";
import { useChatStore } from "@/stores/chat.store";
import { chatService } from "@/services/chat.service";
import { parseApiError } from "@/lib/api";
import { highlightMatches } from "@/lib/chat/format";

/**
 * "New chat" — every workspace member, to start a conversation with.
 *
 * Deliberately not the sidebar's search: that one only matches DMs you
 * already have, so it can never surface someone you have never messaged.
 * This is the other half — the full roster, which is the only way to reach
 * `POST /chat/dm` for a first-time conversation.
 */
export default function NewChatDialog({
  isOpen,
  onClose,
  onOpenChat,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat: (channelId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const selfId = useAuthStore((s) => s.user?.id);
  const upsertChannel = useChatStore((s) => s.upsertChannel);
  const { members, isLoading } = useWorkspaceMembers();
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, isOpen);

  const people = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members
      /* A pending invite's `id` is a WorkspaceInvite id, not a user id — it
         would 400 at POST /chat/dm — and you cannot message yourself. */
      .filter((m) => m.inviteStatus !== "PENDING" && m.id !== selfId)
      .filter(
        (m) =>
          !needle ||
          m.fullName.toLowerCase().includes(needle) ||
          m.email.toLowerCase().includes(needle)
      );
  }, [members, search, selfId]);

  const startChat = async (userId: string) => {
    setBusyId(userId);
    try {
      /* Returns the existing DM when there is one, so picking someone you
         have already messaged reopens that thread rather than duplicating it. */
      const dm = await chatService.createOrGetDm(userId);
      upsertChannel(dm);
      onOpenChat(dm.id);
      setSearch("");
      onClose();
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't start that chat.");
    } finally {
      setBusyId(null);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/40 p-4 pt-24 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            New chat
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 px-5 pb-3">
          <div className="relative">
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {isLoading && people.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-gray-400">
              Loading people…
            </p>
          )}
          {!isLoading && people.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-gray-400">
              {search.trim()
                ? "Nobody matches that search."
                : "No other members in this workspace yet."}
            </p>
          )}
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              disabled={busyId === person.id}
              onClick={() => void startChat(person.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-800"
            >
              <UserAvatar
                name={person.fullName}
                avatarUrl={person.avatarUrl}
                size={32}
                color={person.avatarColor}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-800 dark:text-gray-100">
                  {highlightMatches(person.fullName, search)}
                </span>
                <span className="block truncate text-xs text-gray-400">
                  {highlightMatches(person.email, search)}
                </span>
              </span>
              {busyId === person.id && (
                <span className="shrink-0 text-[11px] text-gray-400">
                  Opening…
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
