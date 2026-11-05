import React from "react";
import type { ChatMessage } from "@/types/chat";

/**
 * Presentation helpers shared by every chat surface.
 *
 * Lifted verbatim out of `ChannelChatView`, where they were duplicated
 * near-identically in `DmChatView` — keeping them in one place is what lets
 * channels and DMs render consistently.
 */

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "Today" / "Yesterday" / "Mon, Jan 5" — the timeline's day separator. */
export function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - msgDay.getTime()) / 86400000;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function groupMessages(
  messages: ChatMessage[]
): { label: string; messages: ChatMessage[] }[] {
  const groups = new Map<string, ChatMessage[]>();
  for (const msg of messages) {
    const label = getDateLabel(msg.createdAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(msg);
  }
  return Array.from(groups.entries()).map(([label, msgs]) => ({
    label,
    messages: msgs,
  }));
}

/**
 * Turns a SYSTEM message's structured `contentJson` into readable text.
 *
 * This is the only decoder of the server's system-event vocabulary — every
 * `kind: "SYSTEM"` row arrives as `{ event, ...args }` with no prose, so
 * without this they render blank.
 */
export function renderSystemText(
  contentJson: Record<string, unknown>,
  resolveName: (id: string) => string
): string {
  const event = contentJson.event as string | undefined;
  const actor = resolveName(
    ((contentJson.actorUserId ?? contentJson.actorId) as string) ?? ""
  );
  const user = resolveName((contentJson.userId as string) ?? "");

  switch (event) {
    case "channel_created":
      return `${actor} created this channel`;
    case "channel_renamed":
      return `${actor} renamed the channel from "${contentJson.from}" to "${contentJson.to}"`;
    case "channel_privacy_changed":
      return `${actor} changed the channel to ${
        (contentJson.to as string)?.toLowerCase() ?? "unknown"
      }`;
    case "channel_deleted":
      return `${actor} deleted this channel — its history is still readable`;
    case "member_joined":
      return contentJson.source === "join_request"
        ? `${user} joined the channel`
        : `${actor} added ${user} to the channel`;
    case "member_role_changed":
      return `${actor} changed ${user}'s role from ${contentJson.from} to ${contentJson.to}`;
    case "member_removed":
      return `${actor} removed ${user} from the channel`;
    case "dm_started":
      return `${actor} started this conversation`;
    default:
      return event ? event.replace(/_/g, " ") : "System event";
  }
}

/**
 * Highlights `@Name` spans in a message body.
 *
 * Matches on the mentioned person's name because mentions travel as plaintext
 * plus a separate id array rather than as rich-text nodes — so a renamed user
 * or a literal "@Name" in prose can mis-highlight. A ProseMirror mention node
 * would fix that; see the composer note in the migration plan.
 */
export function renderWithMentions(
  plaintext: string,
  mentions: ChatMessage["mentions"]
): React.ReactNode {
  if (!mentions.length) return plaintext;
  const parts: React.ReactNode[] = [];
  let remaining = plaintext;
  let key = 0;
  for (const mention of mentions) {
    const tag = `@${mention.fullName}`;
    const idx = remaining.indexOf(tag);
    if (idx === -1) continue;
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push(
      <span key={key++} className="font-medium text-brand-500">
        {tag}
      </span>
    );
    remaining = remaining.slice(idx + tag.length);
  }
  if (remaining) parts.push(remaining);
  return parts;
}

/** Reactions grouped for display: one chip per emoji with a count. */
export function groupReactions(message: ChatMessage) {
  const byEmoji = new Map<
    string,
    { emoji: string; count: number; userIds: string[] }
  >();
  for (const r of message.reactions) {
    const entry = byEmoji.get(r.emoji) ?? {
      emoji: r.emoji,
      count: 0,
      userIds: [],
    };
    entry.count += 1;
    entry.userIds.push(r.userId);
    byEmoji.set(r.emoji, entry);
  }
  return Array.from(byEmoji.values());
}

/**
 * A room's display title.
 *
 * DMs carry `name: null` server-side, so their title is the other
 * participant's name — which means the viewer's own id is needed to work out
 * who "the other" is.
 */
export function roomTitle(
  room: { kind: "CHANNEL" | "DM"; name: string | null; members: { userId: string; user: { fullName: string } }[] },
  selfUserId: string | undefined
): string {
  if (room.kind === "CHANNEL") return room.name ?? "Untitled channel";
  const other = room.members.find((m) => m.userId !== selfUserId);
  return other?.user.fullName ?? "Direct message";
}

/**
 * The picture that goes with {@link roomTitle}: a DM shows the other person's,
 * and a channel has none of its own — so it falls back to initials.
 */
export function roomAvatarUrl(
  room: {
    kind: "CHANNEL" | "DM";
    members: { userId: string; user: { avatarUrl?: string | null } }[];
  },
  selfUserId: string | undefined
): string | null {
  if (room.kind === "CHANNEL") return null;
  const other = room.members.find((m) => m.userId !== selfUserId);
  return other?.user.avatarUrl ?? null;
}

/** Short preview line for the conversation list. */
export function lastMessagePreview(room: {
  lastMessage?: { plaintext: string; deletedAt: string | null } | null;
}): string {
  const last = room.lastMessage;
  if (!last) return "";
  if (last.deletedAt) return "Message deleted";
  return last.plaintext;
}

/**
 * Wraps every case-insensitive occurrence of `query` in a `<mark>`.
 *
 * Used by both search surfaces so a hit looks the same in the sidebar list and
 * in the thread. The query is escaped before it reaches the RegExp — a user
 * typing `(` or `*` is searching for that character, not writing a pattern,
 * and an unescaped one would throw.
 *
 * `activeIndex` singles out one occurrence as the current match (the one the
 * up/down arrows are parked on), tinting it more strongly than the rest.
 */
export function highlightMatches(
  text: string,
  query: string,
  options?: { activeIndex?: number; startOrdinal?: number }
): React.ReactNode {
  const needle = query.trim();
  if (!needle) return text;

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  const lower = needle.toLowerCase();
  let ordinal = options?.startOrdinal ?? 0;

  return parts.map((part, i) => {
    if (part.toLowerCase() !== lower) return part;
    const isActive = ordinal === options?.activeIndex;
    ordinal += 1;
    return (
      <mark
        key={i}
        data-chat-match={ordinal - 1}
        className={
          isActive
            ? "rounded-sm bg-amber-400 px-0.5 text-gray-900"
            : "rounded-sm bg-amber-200 px-0.5 text-gray-900"
        }
      >
        {part}
      </mark>
    );
  });
}

/** How many times `query` occurs in `text` — for the "3 of 12" counter. */
export function countMatches(text: string, query: string): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  const hay = text.toLowerCase();
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}
