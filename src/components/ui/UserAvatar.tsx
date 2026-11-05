"use client";

import { useState } from "react";
import { getInitials } from "@/lib/getInitials";
import { avatarColors } from "@/components/accounts/avatar";

/**
 * One person's avatar, anywhere in the app.
 *
 * `avatarUrl` carries two different things, because the API stores both in a
 * single `users.avatar_url` column: either a real image URL, or the token
 * `initials:AB` (see `normalizeProfilePicture` server-side). Rendering the
 * token as an `<img src>` would show a broken image, so it is decoded here —
 * this is the one place that knows the convention.
 *
 * Falls back to initials when there is no picture, when the value is a token,
 * or when the image fails to load (a since-deleted S3 object, an expired host).
 */
export default function UserAvatar({
  name,
  avatarUrl,
  size = 32,
  color,
  className = "",
  title,
  shape = "circle",
}: {
  name: string | null | undefined;
  /** A URL, an `initials:AB` token, or null. */
  avatarUrl?: string | null;
  size?: number;
  /** The server's per-user `avatarColor`. Falls back to a name-seeded tint so
   *  the same person keeps one colour even where the API sends none. */
  color?: string | null;
  className?: string;
  title?: string;
  /** Panels use a squircle rather than a circle; the default stays round. */
  shape?: "circle" | "rounded";
}) {
  /* A broken URL must fall back to initials rather than an empty frame, and
     the flag is keyed on the URL so switching pictures re-arms it. */
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const displayName = name?.trim() || "Unknown";
  const token = avatarUrl?.startsWith("initials:") ? avatarUrl.slice(9) : null;
  const isImage =
    !!avatarUrl && !token && avatarUrl !== failedUrl && /^https?:\/\//i.test(avatarUrl);

  const label = token || getInitials(displayName);
  const seeded = avatarColors(displayName);
  const background = color || seeded.background;
  /* A server-set colour is a solid brand tint, so its text must be white;
     the seeded palette is pastel and pairs with its own dark foreground. */
  const foreground = color ? "#fff" : seeded.color;

  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold ${
    shape === "rounded" ? "rounded-lg" : "rounded-full"
  } ${className}`;

  if (isImage) {
    return (
      <span
        className={base}
        style={{ width: size, height: size }}
        title={title ?? displayName}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={displayName}
          width={size}
          height={size}
          onError={() => setFailedUrl(avatarUrl)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      title={title ?? displayName}
      style={{
        backgroundColor: background,
        color: foreground,
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.36)),
      }}
      className={base}
    >
      {label}
    </span>
  );
}
