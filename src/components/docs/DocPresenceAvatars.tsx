"use client";

import type { PresenceUser } from "@/hooks/useDocSocket";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const COLORS = [
  "bg-brand-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-sky-500",
];

function colorFor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function DocPresenceAvatars({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;
  const visible = users.slice(0, 5);
  const overflow = users.length - visible.length;

  return (
    <div className="flex -space-x-2">
      {visible.map((u) => (
        <div
          key={u.userId}
          title={`${u.name}${u.lockedBlockIds?.length ? " (editing)" : ""}`}
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow ${colorFor(
            u.userId
          )}`}
        >
          {initials(u.name)}
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-500 text-[10px] font-semibold text-white">
          +{overflow}
        </div>
      )}
    </div>
  );
}
