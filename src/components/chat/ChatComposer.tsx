"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import { chatService, buildContentJson } from "@/services/chat.service";
import { parseApiError } from "@/lib/api";
import { useChatStore } from "@/stores/chat.store";
import { toast } from "sonner";
import EmojiPicker from "@/components/ui/EmojiPicker";
import type { ChatMessage } from "@/types/chat";

/** Tallest the composer grows before it starts scrolling. */
const MAX_COMPOSER_HEIGHT = 160;

/**
 * Grows the textarea to fit its content, up to a cap.
 *
 * Toggling `overflowY` is the point: leaving it on `auto` renders a scrollbar
 * the moment content meets the box height — which at one line is immediately,
 * so an empty composer showed a scrollbar. It only becomes scrollable once the
 * cap is actually reached.
 */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  const next = Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT);
  el.style.height = next + "px";
  el.style.overflowY =
    el.scrollHeight > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
}

interface MentionMember {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
}

interface Props {
  recipientName?: string;
  channelId?: string;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  enableMentions?: boolean;
  members?: MentionMember[];
  /** Quoted message the next send replies to, if any. */
  replyingTo?: ChatMessage | null;
  onCancelReply?: () => void;
}

/**
 * Message composer for channels and DMs.
 *
 * Carried over wholesale from the DM implementation rather than rewritten:
 * the @-mention dropdown with keyboard navigation, emoji picker with caret
 * insertion, auto-growing textarea, typing debounce and attachment upload were
 * all already working here, and a fresh version lost every one of them.
 */
export default function ChatComposer({
  recipientName,
  channelId,
  onTypingStart,
  onTypingStop,
  enableMentions = false,
  members = [],
  replyingTo,
  onCancelReply,
}: Props) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachmentId, setPendingAttachmentId] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  const placeholder = recipientName
    ? `Write to ${recipientName}, press 'space' for AI, '/' for commands`
    : "Write a message...";

  const filteredMembers = mentionQuery !== null
    ? members.filter((m) =>
        m.fullName.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  const closeMentionDropdown = useCallback(() => {
    setMentionQuery(null);
    setMentionStartIndex(null);
    setMentionHighlightIndex(0);
  }, []);

  const startTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart?.();
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop?.();
    }, 3000);
  }, [onTypingStart, onTypingStop]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.();
    }
  }, [onTypingStop]);

  const selectMention = useCallback((member: MentionMember) => {
    if (mentionStartIndex === null) return;
    const before = text.slice(0, mentionStartIndex);
    const after = text.slice(textareaRef.current?.selectionStart ?? text.length);
    const inserted = `@${member.fullName} `;
    const next = before + inserted + after;
    setText(next);
    setMentionedUserIds((ids) =>
      ids.includes(member.userId) ? ids : [...ids, member.userId]
    );
    closeMentionDropdown();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = before.length + inserted.length;
      el.selectionStart = el.selectionEnd = pos;
      el.focus();
      autoGrow(el);
    });
  }, [text, mentionStartIndex, closeMentionDropdown]);

  const doSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !pendingAttachmentId) return;
    if (!channelId) return;
    if (isSending) return;

    stopTyping();
    closeMentionDropdown();
    setIsSending(true);
    try {
      const contentJson = trimmed ? buildContentJson(trimmed) : { type: "doc", content: [] };
      const attachmentIds = pendingAttachmentId ? [pendingAttachmentId] : undefined;
      const mentionIds = mentionedUserIds.length > 0 ? mentionedUserIds : undefined;
      await chatService.sendMessage(
        channelId,
        contentJson,
        attachmentIds,
        mentionIds,
        replyingTo?.id
      );
      /* Replying to a closed conversation reopens it — the same rule as
         receiving one. The server keeps `isArchived` until it is told
         otherwise, so this has to be persisted, not just local. */
      if (useChatStore.getState().archived.some((c) => c.id === channelId)) {
        useChatStore.getState().unarchiveChannel(channelId);
        void chatService.setArchived(channelId, false).catch(() => {});
      }

      setText("");
      setPendingAttachmentId(null);
      setPendingFileName(null);
      setMentionedUserIds([]);
      onCancelReply?.();
      autoGrow(textareaRef.current);
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.code === "TOO_MANY_REQUESTS") {
        toast.error("Sending too fast. Please slow down.");
      } else {
        toast.error(parsed.message || "Failed to send. Try again.");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const el = e.target;
    autoGrow(el);

    if (enableMentions) {
      const cursor = el.selectionStart ?? val.length;
      const textUpToCursor = val.slice(0, cursor);
      const atMatch = textUpToCursor.match(/@([^@\s]*)$/);
      if (atMatch) {
        setMentionQuery(atMatch[1]);
        setMentionStartIndex(atMatch.index!);
        setMentionHighlightIndex(0);
      } else {
        closeMentionDropdown();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionHighlightIndex((i) => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionHighlightIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(filteredMembers[mentionHighlightIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeMentionDropdown();
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
      return;
    }
    startTyping();
  };

  const handleBlur = () => stopTyping();

  // Close mention dropdown on outside click
  /* Size once on mount: the style attribute starts with no height, so without
     this the box uses the browser's default rows until the first keystroke. */
  useEffect(() => {
    autoGrow(textareaRef.current);
  }, []);

  useEffect(() => {
    if (mentionQuery === null) return;
    const handler = (e: MouseEvent) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(e.target as Node) &&
        !textareaRef.current?.contains(e.target as Node)
      ) {
        closeMentionDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mentionQuery, closeMentionDropdown]);

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
      autoGrow(el);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channelId) return;
    e.target.value = "";

    setIsUploading(true);
    setPendingAttachmentId(null);
    setPendingFileName(null);

    try {
      const presign = await chatService.presignAttachment(
        channelId,
        file.type || "application/octet-stream",
        file.name,
        file.size
      );
      await chatService.uploadToS3(presign.uploadUrl, file);
      setPendingAttachmentId(presign.attachmentId);
      setPendingFileName(file.name);
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message || "File upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const removePendingAttachment = () => {
    setPendingAttachmentId(null);
    setPendingFileName(null);
  };

  const triggerMention = () => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const needsSpace = before.length > 0 && !before.endsWith(" ");
    const inserted = needsSpace ? " @" : "@";
    const next = before + inserted + after;
    setText(next);
    const newCursor = cursor + inserted.length;
    setMentionStartIndex(newCursor - 1);
    setMentionQuery("");
    setMentionHighlightIndex(0);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = newCursor;
      el.focus();
    });
  };

  const isDisabled = isSending || isUploading;
  const canSend = (text.trim().length > 0 || !!pendingAttachmentId) && !isDisabled && !!channelId;

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 shrink-0">
      {/* Reply banner — the quoted message the next send attaches to. */}
      {replyingTo && (
        <div className="mb-2 flex items-center gap-2">
          <div className="min-w-0 flex-1 border-l-2 border-brand-500 pl-2">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Replying to {replyingTo.sender?.fullName ?? "Unknown"}
            </p>
            <p className="truncate text-xs text-gray-400">
              {replyingTo.deletedAt ? "Message deleted" : replyingTo.plaintext}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel reply"
            onClick={onCancelReply}
            className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Pending attachment pill */}
      {(pendingFileName || isUploading) && (
        <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-fit max-w-full">
          {isUploading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-gray-400">Uploading…</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
              </svg>
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{pendingFileName}</span>
              <button
                type="button"
                onClick={removePendingAttachment}
                className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
                aria-label="Remove attachment"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      <div className="relative">
        {/* Mention dropdown */}
        {enableMentions && mentionQuery !== null && filteredMembers.length > 0 && (
          <div
            ref={mentionDropdownRef}
            className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50"
          >
            <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Members</span>
            </div>
            <ul className="max-h-48 overflow-y-auto py-1">
              {filteredMembers.map((m, i) => (
                <li key={m.userId}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectMention(m); }}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors ${
                      i === mentionHighlightIndex
                        ? "bg-brand-50 dark:bg-brand-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {/* Was a bare <img>, which rendered the `initials:AB`
                        token as a broken image. */}
                    <UserAvatar name={m.fullName} avatarUrl={m.avatarUrl} size={24} />
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{m.fullName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {showEmojiPicker && (
          <EmojiPicker
            onSelect={(emoji) => { insertEmoji(emoji); }}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}

        {/* Single row — attach, emoji, field, send — matching the new design.
            Every behaviour behind it (mentions, emoji insertion, auto-grow,
            typing debounce, upload) is unchanged from the previous composer. */}
        <div className="flex items-end gap-2">
          <IconBtn
            label="Attach"
            disabled={isDisabled || !channelId}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          </IconBtn>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
          />

          <IconBtn
            label="Emoji"
            disabled={isDisabled}
            onClick={() => setShowEmojiPicker((v) => !v)}
            active={showEmojiPicker}
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm5.25 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75z" />
            </svg>
          </IconBtn>

          {enableMentions && (
            <IconBtn
              label="Mention"
              disabled={isDisabled}
              onClick={triggerMention}
              active={mentionQuery !== null}
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" />
              </svg>
            </IconBtn>
          )}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            rows={1}
            disabled={isDisabled}
            className="min-w-0 flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-5 text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            style={{ maxHeight: MAX_COMPOSER_HEIGHT, overflowY: "hidden" }}
          />

          <div className="flex items-center gap-1">
              {/* Send button */}
              <button
                type="button"
                onClick={doSend}
                disabled={!canSend}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-000 dark:text-black"
              >
                {isSending ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  disabled,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "bg-brand-50 dark:bg-brand-900/30 text-brand-500"
          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}
