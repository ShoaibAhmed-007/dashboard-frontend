"use client";

import UserAvatar from "@/components/ui/UserAvatar";

/**
 * Round avatar for a conversation or member.
 *
 * A thin wrapper over {@link UserAvatar} kept for the call sites that only
 * have a name: it kept its own initials rendering until profile pictures
 * existed, and now defers so a chat avatar is the same component — and the
 * same `initials:` decoding and broken-image fallback — as everywhere else.
 */
export default function ChatAvatar({
  name,
  avatarUrl,
  size = 40,
  className = "",
}: {
  /** Also the colour seed, so the same name always gets the same tint. */
  name: string;
  /** A URL or an `initials:AB` token; omitted where only a name is known. */
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <UserAvatar
      name={name}
      avatarUrl={avatarUrl}
      size={size}
      className={className}
    />
  );
}
