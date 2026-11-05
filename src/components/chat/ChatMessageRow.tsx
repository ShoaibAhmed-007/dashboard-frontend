"use client";

import { useState } from "react";
import {
  LuDownload,
  LuFile,
  LuPin,
  LuReply,
  LuSmilePlus,
  LuTrash2,
} from "react-icons/lu";
import ChatAvatar from "./ChatAvatar";
import {
  formatTime,
  highlightMatches,
  groupReactions,
  renderSystemText,
  renderWithMentions,
} from "@/lib/chat/format";
import ImageViewerModal from "@/components/ui/ImageViewerModal";
import type { ChatAttachment, ChatMessage } from "@/types/chat";

/** Emoji offered by the quick reaction bar. */
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🙏"];

/**
 * One message in a thread — body, attachments, reactions, and hover actions,
 * in a bubble aligned by author.
 *
 * Own messages sit right, everyone else's left. In a DM there are only ever
 * two participants, so that alignment already says who wrote what and the
 * avatar and name are dropped as noise. Channels keep both, since alignment
 * cannot distinguish between several other people.
 */
export default function ChatMessageRow({
  message,
  selfUserId,
  resolveName,
  canModerate,
  isDm,
  isFrozen = false,
  searchQuery,
  activeMatchOrdinal,
  matchStartOrdinal,
  onReact,
  onReply,
  onPin,
  onDelete,
}: {
  message: ChatMessage;
  selfUserId: string | undefined;
  /** Turns a user id into a display name for SYSTEM message text. */
  resolveName: (id: string) => string;
  /** Channel OWNER/ADMIN — gates pinning and deleting others' messages. */
  canModerate: boolean;
  /** Two-participant room: alignment identifies the author on its own. */
  isDm: boolean;
  /** The channel was deleted (frozen): history is readable, but anything that
   *  would write a new message is gone. */
  isFrozen?: boolean;
  /** In-conversation search term; every occurrence is marked. */
  searchQuery?: string;
  /** Which of *this* message's occurrences is the current match, if any. */
  activeMatchOrdinal?: number;
  /** This message's position in the thread-wide match list, so the row can
   *  work out which of its own marks is active. */
  matchStartOrdinal?: number;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: ChatMessage) => void;
  onPin: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  /** The attachment shown full-size, or null when the viewer is closed. */
  const [preview, setPreview] = useState<ChatAttachment | null>(null);
  const isOwn = Boolean(message.senderId && message.senderId === selfUserId);

  // System rows are notices, not messages — no bubble, no author, no actions.
  if (message.kind === "SYSTEM") {
    return (
      <p className="py-1 text-center text-xs text-gray-400">
        {renderSystemText(message.contentJson, resolveName)}
      </p>
    );
  }

  const reactions = groupReactions(message);

  /* Avatar and name only earn their place where alignment is ambiguous: a
     channel with many participants. In a DM they repeat the same two names
     down the whole thread. */
  const showAuthor = !isDm && !isOwn;

  return (
    <div
      className={`group relative flex items-end gap-2 px-1 py-1.5 ${
        isOwn ? "flex-row-reverse" : ""
      }`}
    >
      {showAuthor ? (
        /* Lifted clear of the timestamp. `items-end` aligns the avatar with
           the bottom of the whole column — timestamp included — so it hangs
           below the bubble; ~16px is that timestamp's own height, which puts
           the avatar level with the bubble's base instead. */
        <ChatAvatar
          name={message.sender?.fullName ?? "?"}
          avatarUrl={message.sender?.avatarUrl}
          size={28}
          className="mb-4"
        />
      ) : (
        // Keeps incoming bubbles on one left edge whether or not this row
        // carries an avatar.
        !isOwn && !isDm && <span className="w-7 shrink-0" />
      )}

      <div
        className={`flex min-w-0 max-w-[75%] flex-col ${
          isOwn ? "items-end" : "items-start"
        }`}
      >
        {showAuthor && (
          <span className="mb-0.5 px-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            {message.sender?.fullName ?? "Unknown"}
          </span>
        )}

        {/* The bubble. Own messages take the tinted fill from the reference;
            incoming ones stay neutral so the two are distinguishable without
            relying on position alone. */}
        <div
          className={`rounded-2xl px-3 py-2 ${
            isOwn
              ? "rounded-br-md bg-brand-50 text-gray-900 dark:bg-brand-500/20 dark:text-gray-50"
              : "rounded-bl-md bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
          }`}
        >
          {/* Quoted parent — replies are flat, so this never nests. */}
          {message.replyTo && (
            <div className="mb-1 border-l-2 border-gray-300 pl-2 dark:border-gray-600">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {message.replyTo.sender?.fullName ?? "Unknown"}
              </p>
              <p className="truncate text-xs text-gray-400">
                {message.replyTo.deletedAt
                  ? "Message deleted"
                  : message.replyTo.plaintext}
              </p>
            </div>
          )}

          {message.deletedAt ? (
            <p className="text-sm italic text-gray-400">Message deleted</p>
          ) : (
            <p
              /* The anchor the thread scrolls to when this row holds the
                 active match. */
              data-message-id={message.id}
              className="whitespace-pre-wrap break-words text-sm"
            >
              {searchQuery?.trim()
                ? highlightMatches(message.plaintext, searchQuery, {
                    activeIndex:
                      activeMatchOrdinal !== undefined &&
                      matchStartOrdinal !== undefined
                        ? matchStartOrdinal + activeMatchOrdinal
                        : undefined,
                    startOrdinal: matchStartOrdinal ?? 0,
                  })
                : renderWithMentions(message.plaintext, message.mentions)}
              {message.isEdited && (
                <span className="ml-1 text-[11px] text-gray-400">(edited)</span>
              )}
            </p>
          )}

          {/* Two signed URLs per attachment, and which one is used decides the
            behaviour: `url` has no disposition header, so the browser renders
            it inline where it can (images, PDFs, video); `downloadUrl` carries
            Content-Disposition: attachment and always saves. Clicking should
            open, so `url` is the link target and `downloadUrl` is reserved for
            the explicit download control. */}
          {message.attachments.length > 0 && !message.deletedAt && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att) =>
              att.mimeType.startsWith("image/") && att.url ? (
                /* Opened in a modal rather than a new tab — a picture is part
                   of the conversation, and navigating away from it to look
                   loses the thread behind. */
                <button
                  key={att.id}
                  type="button"
                  onClick={() => setPreview(att)}
                  title={`Open ${att.fileName}`}
                  className="group/att relative block cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.url}
                    alt={att.fileName}
                    className="max-h-60 rounded-lg border border-gray-200 object-cover transition-opacity group-hover/att:opacity-90 dark:border-gray-700"
                  />
                </button>
              ) : att.mimeType.startsWith("video/") && att.url ? (
                <video
                  key={att.id}
                  src={att.url}
                  controls
                  className="max-h-60 rounded-lg border border-gray-200 dark:border-gray-700"
                />
              ) : (
                <span
                  key={att.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 pl-3 pr-1 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  <a
                    href={att.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open ${att.fileName}`}
                    className="flex min-w-0 items-center gap-2 py-2 hover:underline"
                  >
                    <LuFile className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="max-w-[200px] truncate">
                      {att.fileName}
                    </span>
                  </a>
                  {att.downloadUrl && (
                    <a
                      href={att.downloadUrl}
                      /* No `target=_blank`: this response is
                         Content-Disposition: attachment, so it saves without
                         ever navigating — a new tab would flash and close. */
                      title={`Download ${att.fileName}`}
                      aria-label={`Download ${att.fileName}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    >
                      <LuDownload className="h-3.5 w-3.5" />
                    </a>
                  )}
                </span>
              )
            )}
          </div>
          )}
        </div>

        {/* Time sits under the bubble rather than beside a name — with the
            author gone in DMs there is no header row left to carry it. */}
        <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-gray-400">
          {message.isPinned && <LuPin className="h-2.5 w-2.5" />}
          {formatTime(message.createdAt)}
        </span>

        {reactions.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {reactions.map((r) => {
              const mine = selfUserId
                ? r.userIds.includes(selfUserId)
                : false;
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => onReact(message.id, r.emoji)}
                  className={`flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors ${
                    mine
                      ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover actions — on the side the bubble is *not*, so they never cover
          the message they act on. */}
      {!message.deletedAt && (
        <div
          className={`absolute top-0 hidden items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm group-hover:flex dark:border-gray-700 dark:bg-gray-900 ${
            isOwn ? "left-2" : "right-2"
          }`}
        >
          <button
            type="button"
            aria-label="Add reaction"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <LuSmilePlus className="h-4 w-4" />
          </button>
          {/* Reply is the only one of these that a frozen channel rejects:
              it composes a *new* message. Reacting, editing and deleting all
              still succeed server-side (verified), so they stay. */}
          {!isFrozen && (
            <button
              type="button"
              aria-label="Reply"
              onClick={() => onReply(message)}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <LuReply className="h-4 w-4" />
            </button>
          )}
          {canModerate && (
            <button
              type="button"
              aria-label={message.isPinned ? "Unpin message" : "Pin message"}
              onClick={() => onPin(message)}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <LuPin className="h-4 w-4" />
            </button>
          )}
          {(isOwn || canModerate) && (
            <button
              type="button"
              aria-label="Delete message"
              onClick={() => onDelete(message)}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            >
              <LuTrash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {pickerOpen && (
        <div
          className={`absolute top-9 z-10 flex gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900 ${
            isOwn ? "left-2" : "right-2"
          }`}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(message.id, emoji);
                setPickerOpen(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded text-base hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <ImageViewerModal
        isOpen={preview !== null}
        url={preview?.url ?? null}
        fileName={preview?.fileName ?? ""}
        downloadUrl={preview?.downloadUrl}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
