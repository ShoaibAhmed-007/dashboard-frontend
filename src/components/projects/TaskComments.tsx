"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type { MemberOption } from "@/components/projects/AssigneePicker";
import { LuArrowLeft, LuX, LuSend, LuUsers, LuSmilePlus, LuEllipsis, LuPencil, LuTrash2 } from "react-icons/lu";
import { commentService, Comment, CommentReaction } from "@/services/comment.service";
import { AuthUser } from "@/stores/auth.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useTaskStore } from "@/stores/task.store";
import { WorkspaceMember } from "@/services/workspace.service";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import UserAvatar from "@/components/ui/UserAvatar";

// ── Helpers ───────────────────────────────────────────────────────────────────


const AVATAR_COLORS = [
  "#18181b", "#7c3aed", "#eab308", "#0f172a", "#6d28d9",
  "#ca8a04", "#1e1b4b", "#fbbf24", "#3b0764", "#292524",
];
function avatarBg(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) hash = (hash * 33) ^ id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m > 1 ? "s" : ""}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""}`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""}`;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({
  id,
  name,
  avatarUrl,
  size = 28,
}: {
  id: string;
  name: string;
  /** The author's picture; falls back to the id-seeded initials tint. */
  avatarUrl?: string | null;
  size?: number;
}) {
  return (
    <UserAvatar
      name={name}
      avatarUrl={avatarUrl}
      size={size}
      color={avatarBg(id)}
    />
  );
}

// ── Comment menu (three-dot dropdown) ────────────────────────────────────────

function CommentMenu({
  isAuthor,
  canEdit,
  onEdit,
  onDelete,
}: {
  isAuthor: boolean;
  canEdit: boolean; // only within 5 min of creation
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!isAuthor) return null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
      >
        <LuEllipsis className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-[90] min-w-[120px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-900">
            {canEdit && (
              <button
                type="button"
                onClick={() => { setOpen(false); onEdit(); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <LuPencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => { setOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <LuTrash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Inline edit box ───────────────────────────────────────────────────────────

function InlineEditor({
  initialText,
  members,
  onSave,
  onCancel,
}: {
  initialText: string;
  members: MemberOption[];
  onSave: (text: string, mentionedUserIds: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const mentionedIds = useRef<Set<string>>(new Set());

  const filteredMembers = mentionQuery !== null
    ? members.filter((m) => m.fullName.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : [];

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart ?? val.length;
    const match = val.slice(0, cursor).match(/(^|[\s\n])@(\S*)$/);
    if (match) {
      setMentionQuery(match[2]);
      setMentionStart(cursor - match[2].length - 1);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member: MemberOption) => {
    const before = text.slice(0, mentionStart);
    const after = text.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    const inserted = `@${member.fullName} `;
    setText(before + inserted + after);
    mentionedIds.current.add(member.id);
    setMentionQuery(null);
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + inserted.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") { e.preventDefault(); onCancel(); return; }
    if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      void handleSave();
    }
  };

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSave(trimmed, Array.from(mentionedIds.current));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative mt-1 rounded-xl border border-brand-300 bg-white p-2.5 dark:border-brand-700 dark:bg-gray-900">
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-56 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 z-50 overflow-hidden">
          {filteredMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Avatar id={m.id} name={m.fullName} size={22} />
              <span className="truncate text-gray-700 dark:text-gray-200">{m.fullName}</span>
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoFocus
        rows={3}
        className="w-full resize-none bg-transparent text-[13px] text-gray-700 outline-none dark:text-gray-200"
      />
      <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-2.5 py-1 text-[12px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!text.trim() || saving}
          className="flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1 text-[12px] text-white disabled:opacity-40 hover:bg-brand-600"
        >
          <LuSend className="h-3 w-3" />
          Save
        </button>
      </div>
    </div>
  );
}

// ── Reaction bar ──────────────────────────────────────────────────────────────
// Logic: one reaction per user per comment.
//   • No reaction → picker opens → POST (add)
//   • Has reaction, picks same emoji → DELETE (toggle off)
//   • Has reaction, picks different emoji → PATCH (replace)

function ReactionBar({
  commentId,
  reactions,
  currentUserId,
  onReact,
}: {
  commentId: string;
  reactions: CommentReaction[];
  currentUserId: string;
  onReact: (commentId: string, emoji: string) => Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Find the current user's reaction (matched by member.userId or memberId === userId as fallback)
  const myReaction = reactions.find(
    (r) => r.member?.userId === currentUserId
  ) ?? null;

  // Total reaction count grouped by emoji for the badge
  const totalCount = reactions.length;

  const handlePick = async (emoji: string) => {
    setPickerOpen(false);
    await onReact(commentId, emoji);
  };

  return (
    <div className="relative mt-2 flex items-center gap-1.5">
      {/* Single reaction badge — shows total count and the current user's active emoji */}
      {totalCount > 0 && (
        <button
          type="button"
          onClick={() => setPickerOpen((p) => !p)}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
            myReaction
              ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-gray-000 dark:bg-brand-950/30 dark:text-brand-400"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          }`}
        >
          {myReaction ? myReaction.reactFace : reactions[0].reactFace}
          <span>{totalCount}</span>
        </button>
      )}

      {/* Add-reaction trigger — shows only when user has no reaction yet */}
      {!myReaction && (
        <button
          type="button"
          onClick={() => setPickerOpen((p) => !p)}
          title="Add reaction"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:hover:text-gray-300"
        >
          <LuSmilePlus className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Emoji picker — anchored to the relative wrapper above */}
      {pickerOpen && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setPickerOpen(false)} />
          <div className="absolute bottom-8 left-0 z-[90] flex gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => void handlePick(emoji)}
                className={`rounded-lg p-1 text-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  myReaction?.reactFace === emoji ? "bg-brand-50 dark:bg-brand-950/30" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Thread card (used in threads list view) ───────────────────────────────────

function ThreadCard({
  comment,
  allComments,
  currentUserId,
  members,
  onOpenThread,
  onReact,
  onEdit,
  onDelete,
  hideReply = false,
}: {
  comment: Comment;
  allComments: Comment[];
  currentUserId: string;
  members: MemberOption[];
  onOpenThread: (c: Comment) => void;
  onReact: (commentId: string, emoji: string) => Promise<void>;
  onEdit: (commentId: string, text: string, mentionedUserIds: string[]) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  hideReply?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const replies = allComments.filter((c) => c.parentId === comment.id);
  const replyCount = replies.length;
  const replyAvatars = Array.from(new Map(replies.map((r) => [r.author.id, r.author])).values()).slice(0, 3);
  const createdMs = new Date(comment.createdAt).getTime();
  const canEdit = (new Date().getTime() - createdMs) < 5 * 60 * 1000;

  return (
    <div data-comment-id={comment.id} className="mb-2 rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-1.5 flex items-center gap-2">
        <Avatar id={comment.author.id} name={comment.author.fullName} avatarUrl={comment.author.avatarUrl} size={30} />
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{comment.author.fullName}</span>
          <span className="ml-2 text-[11px] text-gray-400">{timeAgo(comment.createdAt)}</span>
          {comment.isEdited && <span className="ml-1 text-[10px] text-gray-400">(edited)</span>}
        </div>
        <CommentMenu
          isAuthor={comment.author.id === currentUserId || comment.userId === currentUserId}
          canEdit={canEdit}
          onEdit={() => setEditing(true)}
          onDelete={() => void onDelete(comment.id)}
        />
      </div>

      {/* Content or inline editor */}
      {editing ? (
        <InlineEditor
          initialText={comment.content}
          members={members}
          onSave={async (text, ids) => { await onEdit(comment.id, text, ids); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{comment.content}</p>
      )}

      {/* Reaction bar */}
      {!editing && (
        <ReactionBar
          commentId={comment.id}
          reactions={comment.reactions}
          currentUserId={currentUserId}
          onReact={onReact}
        />
      )}

      {/* Footer: divider + reply info */}
      {!editing && !hideReply && (
        <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
          <div className="w-4" />
          {replyCount > 0 ? (
            <button
              type="button"
              onClick={() => onOpenThread(comment)}
              className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-brand-500 dark:text-gray-400"
            >
              <span>{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
              <div className="flex -space-x-1">
                {replyAvatars.map((a) => (
                  <Avatar key={a.id} id={a.id} name={a.fullName} size={18} />
                ))}
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenThread(comment)}
              className="text-[12px] text-gray-400 hover:text-brand-500 dark:hover:text-gray-000"
            >
              Reply
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Reply message (used in thread detail view) ────────────────────────────────

function ReplyMessage({
  comment,
  allComments,
  currentUserId,
  members,
  onReplyTo,
  onReact,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  allComments: Comment[];
  currentUserId: string;
  members: MemberOption[];
  onReplyTo: (c: Comment) => void;
  onReact: (commentId: string, emoji: string) => Promise<void>;
  onEdit: (commentId: string, text: string, mentionedUserIds: string[]) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const parentComment = comment.parentId ? allComments.find((c) => c.id === comment.parentId) : null;
  const showQuote = parentComment && parentComment.parentId !== null;
  const createdMs = new Date(comment.createdAt).getTime();
  const canEdit = (new Date().getTime() - createdMs) < 5 * 60 * 1000;

  return (
    <div data-comment-id={comment.id} className="mb-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      {/* WhatsApp-style quoted bubble */}
      {showQuote && (
        <div className="mb-2 rounded-lg border-l-2 border-brand-400 bg-gray-50 px-2.5 py-1.5 dark:border-brand-600 dark:bg-gray-800">
          <p className="text-[11px] font-semibold text-brand-500 dark:text-brand-400">{parentComment.author.fullName}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">{parentComment.content}</p>
        </div>
      )}

      {/* Header */}
      <div className="mb-1.5 flex items-center gap-2">
        <Avatar id={comment.author.id} name={comment.author.fullName} avatarUrl={comment.author.avatarUrl} size={28} />
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{comment.author.fullName}</span>
          <span className="ml-2 text-[11px] text-gray-400">{timeAgo(comment.createdAt)}</span>
          {comment.isEdited && <span className="ml-1 text-[10px] text-gray-400">(edited)</span>}
        </div>
        <CommentMenu
          isAuthor={comment.author.id === currentUserId || comment.userId === currentUserId}
          canEdit={canEdit}
          onEdit={() => setEditing(true)}
          onDelete={() => void onDelete(comment.id)}
        />
      </div>

      {/* Content or inline editor */}
      {editing ? (
        <InlineEditor
          initialText={comment.content}
          members={members}
          onSave={async (text, ids) => { await onEdit(comment.id, text, ids); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p className="text-[13px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{comment.content}</p>
      )}

      {/* Reaction bar + reply button */}
      {!editing && (
        <>
          <ReactionBar
            commentId={comment.id}
            reactions={comment.reactions}
            currentUserId={currentUserId}
            onReact={onReact}
          />
          <div className="mt-2 flex items-center justify-end border-t border-gray-100 pt-2 dark:border-gray-800">
            <button
              type="button"
              onClick={() => onReplyTo(comment)}
              className="text-[12px] text-gray-400 hover:text-brand-500"
            >
              Reply
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Composer ──────────────────────────────────────────────────────────────────

function Composer({
  placeholder,
  replyTo,
  onClearReplyTo,
  members,
  onSubmit,
  onMentionOpen,
  disabled,
}: {
  placeholder: string;
  replyTo: Comment | null;
  onClearReplyTo: () => void;
  members: MemberOption[];
  onSubmit: (text: string, mentionedUserIds: string[]) => Promise<void>;
  onMentionOpen?: () => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = picker closed
  const [mentionStart, setMentionStart] = useState(0); // cursor position of the '@'
  const mentionedIds = useRef<Set<string>>(new Set());

  const filteredMembers = mentionQuery !== null
    ? members.filter((m) =>
        m.fullName.toLowerCase().includes(mentionQuery.toLowerCase()) &&
        m.fullName !== ""
      ).slice(0, 6)
    : [];

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Detect @ trigger: find the last '@' before the cursor that isn't preceded by a word char
    const cursor = e.target.selectionStart ?? val.length;
    const textUpToCursor = val.slice(0, cursor);
    const match = textUpToCursor.match(/(^|[\s\n])@(\S*)$/);
    if (match) {
      if (mentionQuery === null) onMentionOpen?.();
      setMentionQuery(match[2]);
      setMentionStart(cursor - match[2].length - 1); // position of '@'
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member: MemberOption) => {
    const before = text.slice(0, mentionStart);
    const after = text.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    const inserted = `@${member.fullName} `;
    setText(before + inserted + after);
    mentionedIds.current.add(member.id);
    setMentionQuery(null);
    // Restore focus
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + inserted.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Close mention picker on Escape
    if (e.key === "Escape" && mentionQuery !== null) {
      e.preventDefault();
      setMentionQuery(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    try {
      await onSubmit(trimmed, Array.from(mentionedIds.current));
      setText("");
      mentionedIds.current.clear();
      setMentionQuery(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-gray-100 p-3 dark:border-gray-800">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-brand-400 bg-brand-50/50 px-2.5 py-1.5 dark:border-brand-600 dark:bg-brand-950/20">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-brand-500 dark:text-brand-400">{replyTo.author.fullName}</p>
            <p className="line-clamp-1 text-[11px] text-gray-500 dark:text-gray-400">{replyTo.content}</p>
          </div>
          <button type="button" onClick={onClearReplyTo} className="shrink-0 text-gray-400 hover:text-gray-600">
            <LuX className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="relative rounded-xl border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-900">
        {/* @mention dropdown */}
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-56 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 z-50 overflow-hidden">
            {filteredMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Avatar id={m.id} name={m.fullName} size={22} />
                <span className="truncate text-gray-700 dark:text-gray-200">{m.fullName}</span>
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none bg-transparent text-[13px] text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200 dark:placeholder:text-gray-600"
        />
        <div className="flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
          <span className="text-[11px] text-gray-300 dark:text-gray-600">Type @ to mention</span>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!text.trim() || sending || disabled}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 dark:bg-gray-000 dark:text-black text-white disabled:opacity-40 hover:bg-brand-600 dark:hover:bg-gray-200 transition-colors"
          >
            <LuSend className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main TaskComments component ───────────────────────────────────────────────

interface TaskCommentsProps {
  taskId: string;
  currentUser: AuthUser | null;
  members: MemberOption[];
  onRefetchMembers?: () => void;
}

export default function TaskComments({ taskId, currentUser, members, onRefetchMembers }: TaskCommentsProps) {
  const [commentState, setCommentState] = useState<{ streamKey: string; items: Comment[] }>({
    streamKey: "",
    items: [],
  });
  const [view, setView] = useState<"threads" | "thread">("threads");
  const [activeThread, setActiveThread] = useState<Comment | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeStreamKeyRef = useRef<string>("");
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const focusCommentId = useTaskStore((s) => s.focusCommentId);
  const clearFocusComment = useTaskStore((s) => s.clearFocusComment);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const currentStreamKey = activeWorkspaceId ? `${activeWorkspaceId}:${taskId}` : "";
  const comments = useMemo(
    () => commentState.streamKey === currentStreamKey ? commentState.items : [],
    [commentState, currentStreamKey]
  );

  const setCurrentComments = useCallback((updater: SetStateAction<Comment[]>) => {
    if (!currentStreamKey) return;
    setCommentState((prev) => {
      const base = prev.streamKey === currentStreamKey ? prev.items : [];
      const items = typeof updater === "function"
        ? (updater as (previous: Comment[]) => Comment[])(base)
        : updater;
      return { streamKey: currentStreamKey, items };
    });
  }, [currentStreamKey]);

  // ── SSE setup via fetch (EventSource can't send auth headers) ──────────────
  useEffect(() => {
    if (!activeWorkspaceId) {
      abortRef.current?.abort();
      abortRef.current = null;
      activeStreamKeyRef.current = "";
      return;
    }

    const streamKey = `${activeWorkspaceId}:${taskId}`;

    // If already streaming for this workspace/task (Strict Mode second mount or parent re-render),
    // don't abort and restart — the existing connection is still good.
    if (activeStreamKeyRef.current === streamKey && abortRef.current && !abortRef.current.signal.aborted) {
      return;
    }

    // Different workspace/task (or first mount) — abort any previous stream.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    activeStreamKeyRef.current = streamKey;

    const setIfCurrent = (updater: SetStateAction<Comment[]>) => {
      if (activeStreamKeyRef.current !== streamKey || ctrl.signal.aborted) return;
      setCommentState((prev) => {
        const base = prev.streamKey === streamKey ? prev.items : [];
        const items = typeof updater === "function"
          ? (updater as (previous: Comment[]) => Comment[])(base)
          : updater;
        return { streamKey, items };
      });
    };

    commentService.openStream(taskId, activeWorkspaceId, {
      onInit: (data) => {
        setIfCurrent(data);
      },
      onCreated: (c) => setIfCurrent((prev) => prev.find((x) => x.id === c.id) ? prev : [...prev, c]),
      onUpdated: (c) => setIfCurrent((prev) => prev.map((x) => x.id === c.id ? c : x)),
      onDeleted: (ids) => setIfCurrent((prev) => prev.filter((x) => !ids.includes(x.id))),
      onReactionCreated: (commentId, reaction) =>
        setIfCurrent((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, reactions: c.reactions.find((r) => r.id === reaction.id) ? c.reactions : [...c.reactions, reaction] }
              : c
          )
        ),
      onReactionUpdated: (commentId, reaction) =>
        setIfCurrent((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, reactions: c.reactions.map((r) => r.id === reaction.id ? reaction : r) }
              : c
          )
        ),
      onReactionDeleted: (commentId, reactionId) =>
        setIfCurrent((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, reactions: c.reactions.filter((r) => r.id !== reactionId) }
              : c
          )
        ),
    }, ctrl.signal);

    return () => {
      // No-op: don't abort on every re-render. True cleanup is in the unmount effect below.
    };
  }, [taskId, activeWorkspaceId]);

  // True unmount cleanup — runs only when the component is removed from the tree.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      activeStreamKeyRef.current = "";
    };
  }, []);

  // ── Scroll to focused comment after comments render ───────────────────────
  useEffect(() => {
    if (!focusCommentId || comments.length === 0) return;

    const target = comments.find((c) => c.id === focusCommentId);
    if (!target) return;

    // If this is a reply, we need to open its root thread first
    if (target.parentId !== null) {
      // Walk up to the root-level comment (parentId === null)
      let root = comments.find((c) => c.id === target.parentId);
      while (root && root.parentId !== null) {
        root = comments.find((c) => c.id === root!.parentId);
      }
      if (root && (view !== "thread" || activeThread?.id !== root.id)) {
        setActiveThread(root);
        setView("thread");
        // Don't clear focusCommentId yet — let the effect re-run once the thread view renders
        return;
      }
    }

    // DOM should now contain the target card — scroll to it
    const el = scrollAreaRef.current?.querySelector(`[data-comment-id="${focusCommentId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("comment-highlight");
    const t = setTimeout(() => el.classList.remove("comment-highlight"), 2000);
    clearFocusComment();
    return () => clearTimeout(t);
  }, [focusCommentId, comments, view, activeThread, clearFocusComment]);

  // ── Single reaction handler: POST / PATCH / DELETE ─────────────────────────
  // • No existing reaction → POST (add)
  // • Same emoji clicked again → DELETE (toggle off)
  // • Different emoji picked → PATCH (replace)
  const handleReact = useCallback(async (commentId: string, emoji: string) => {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    const mine = comment.reactions.find((r) => r.member?.userId === currentUser?.id) ?? null;
    try {
      if (!mine) {
        await commentService.addReaction(commentId, emoji);
      } else if (mine.reactFace === emoji) {
        await commentService.deleteReaction(mine.id);
      } else {
        await commentService.patchReaction(mine.id, emoji);
      }
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  }, [comments, currentUser?.id]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (text: string, mentionedUserIds: string[]) => {
    try {
      let parentId: string | undefined;
      if (view === "thread" && activeThread) {
        parentId = replyTo ? replyTo.id : activeThread.id;
      }
      const created = await commentService.createComment(taskId, text, parentId, mentionedUserIds);
      setCurrentComments((prev) => prev.find((c) => c.id === created.id) ? prev : [...prev, created]);
      setReplyTo(null);
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  }, [taskId, view, activeThread, replyTo, setCurrentComments]);

  // ── Edit handler ───────────────────────────────────────────────────────────
  const handleEdit = useCallback(async (commentId: string, text: string, mentionedUserIds: string[]) => {
    try {
      const updated = await commentService.updateComment(commentId, text, mentionedUserIds);
      setCurrentComments((prev) => prev.map((c) => c.id === commentId ? updated : c));
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  }, [setCurrentComments]);

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (commentId: string) => {
    try {
      await commentService.deleteComment(commentId);
      // SSE comment:deleted will remove it; optimistically remove now too
      setCurrentComments((prev) => prev.filter((c) => c.id !== commentId));
      // If the active thread was deleted, go back to threads list
      if (activeThread?.id === commentId) {
        setView("threads");
        setActiveThread(null);
      }
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  }, [activeThread, setCurrentComments]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const threads = comments
    .filter((c) => c.parentId === null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const threadReplies = activeThread
    ? comments
        .filter((c) => {
          if (c.id === activeThread.id) return false;
          // direct reply to thread OR nested reply
          const parent = comments.find((x) => x.id === c.parentId);
          if (!parent) return false;
          if (parent.id === activeThread.id) return true;
          // reply-to-reply: parent's parent is the thread
          const grandparent = comments.find((x) => x.id === parent.parentId);
          return grandparent?.id === activeThread.id;
        })
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

  const currentUserId = currentUser?.id ?? "";

  // ── Threads list view ──────────────────────────────────────────────────────
  if (view === "threads") {
    return (
      <>
        {/* Threads list */}
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-3">
          {threads.length === 0 && (
            <p className="py-6 text-center text-[12px] text-gray-400">No comments yet. Start the conversation.</p>
          )}
          {threads.map((t) => (
            <ThreadCard
              key={t.id}
              comment={t}
              allComments={comments}
              currentUserId={currentUserId}
              members={members}
              onOpenThread={(c) => { setActiveThread(c); setView("thread"); }}
              onReact={handleReact}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {/* Composer */}
        <Composer
          placeholder="Write a comment..."
          replyTo={null}
          onClearReplyTo={() => {}}
          members={members}
          onSubmit={handleSubmit}
          onMentionOpen={onRefetchMembers}
        />
      </>
    );
  }

  // ── Thread detail view ─────────────────────────────────────────────────────
  if (!activeThread) return null;

  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
        <button
          type="button"
          onClick={() => { setView("threads"); setActiveThread(null); setReplyTo(null); }}
          className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <LuArrowLeft className="h-3.5 w-3.5" />
          <span>Back</span>
        </button>
        <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
        {/* Colorful flower icon placeholder */}
        <span className="text-base">🌸</span>
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <span className="text-[12px] text-gray-500">Thread by</span>
          <Avatar id={activeThread.author.id} name={activeThread.author.fullName} avatarUrl={activeThread.author.avatarUrl} size={18} />
          <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 truncate">{activeThread.author.fullName}</span>
        </div>
        <button type="button" className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-gray-400">
          <LuUsers className="h-3 w-3" />
          <span>{1 + new Set(threadReplies.map((r) => r.author.id)).size} follower{1 + new Set(threadReplies.map((r) => r.author.id)).size !== 1 ? "s" : ""}</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-3">
        {/* Parent thread card */}
        <ThreadCard
          comment={activeThread}
          allComments={comments}
          currentUserId={currentUserId}
          members={members}
          onOpenThread={() => {}}
          onReact={handleReact}
          onEdit={handleEdit}
          onDelete={handleDelete}
          hideReply
        />

        {/* Reply count divider */}
        {threadReplies.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] text-gray-400">{threadReplies.length} {threadReplies.length === 1 ? "reply" : "replies"}</span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
          </div>
        )}

        {/* Replies */}
        {threadReplies.map((r) => (
          <ReplyMessage
            key={r.id}
            comment={r}
            allComments={comments}
            currentUserId={currentUserId}
            members={members}
            onReplyTo={(c) => setReplyTo(c)}
            onReact={handleReact}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Composer */}
      <Composer
        placeholder="Reply to comment..."
        replyTo={replyTo}
        onClearReplyTo={() => setReplyTo(null)}
        members={members}
        onSubmit={handleSubmit}
        onMentionOpen={onRefetchMembers}
      />
    </>
  );
}
