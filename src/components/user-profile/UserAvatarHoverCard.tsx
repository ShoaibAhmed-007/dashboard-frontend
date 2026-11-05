"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuMessageSquare, LuUser, LuMail, LuClock } from "react-icons/lu";
import { getInitials } from "@/lib/getInitials";
import { useUiStore } from "@/stores/ui.store";
import { useAuth } from "@/context/AuthContext";
import { userService } from "@/services/user.service";
import { UserProfile } from "@/hooks/useProfile";

interface AvatarUser {
  id: string;
  fullName: string;
  avatarColor?: string | null;
}

interface Props {
  user: AvatarUser;
  size?: "sm" | "md";
  className?: string;
}

const AVATAR_COLORS = [
  "#18181b", "#7c3aed", "#eab308", "#0f172a", "#6d28d9",
  "#ca8a04", "#1e1b4b", "#fbbf24", "#3b0764", "#292524",
];

function hashColor(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33) ^ id.charCodeAt(i);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function UserAvatarHoverCard({ user, size = "md", className = "" }: Props) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const avatarRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef(false);
  const { openUserPanel, openProfilePanel } = useUiStore();
  const { user: authUser } = useAuth();

  const isSelf = authUser?.id === user.id;
  const bgColor = user.avatarColor ?? hashColor(user.id);
  const initials = getInitials(user.fullName);
  const sizeClass = size === "sm" ? "h-5 w-5 text-[8px]" : "h-6 w-6 text-[9px]";

  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCard = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (showTimer.current) clearTimeout(showTimer.current);
    showTimer.current = setTimeout(() => {
      if (avatarRef.current) {
        const rect = avatarRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 6, left: rect.left });
      }
      setHovered(true);
    }, 900);
    // Fetch profile once on first hover
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      userService.getById(user.id)
        .then(setProfile)
        .catch(() => {});
    }
  };

  const scheduleHide = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), 120);
  };

  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (showTimer.current) clearTimeout(showTimer.current);
    };
  }, []);

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHovered(false);
    if (isSelf) {
      openProfilePanel();
    } else {
      openUserPanel(user.id);
    }
  };

  // Resolve initials from profilePicture if available
  const pic = profile?.profilePicture ?? null;
  const displayInitials = pic?.startsWith("initials:") ? pic.slice(9) : initials;
  const displayName = profile?.fullName ?? user.fullName;
  const status = profile?.status ?? null;

  return (
    <>
      <span
        ref={avatarRef}
        className={`inline-flex items-center justify-center rounded-full font-medium text-white ring-1 ring-white dark:ring-gray-900 cursor-pointer ${sizeClass} ${className}`}
        style={{ backgroundColor: bgColor }}
        title={user.fullName}
        onMouseEnter={showCard}
        onMouseLeave={scheduleHide}
        onClick={() => { if (showTimer.current) clearTimeout(showTimer.current); setHovered(false); }}
      >
        {initials}
      </span>

      {hovered && createPortal(
        <div
          ref={cardRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-80 rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 overflow-hidden"
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          {/* Top: avatar + name + subtitle */}
          <div className="flex items-center gap-3.5 px-4 py-4">
            <span
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: bgColor }}
            >
              {displayInitials}
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                {isSelf ? "You" : displayName}
              </p>
              {profile?.bio ? (
                <p className="text-sm text-gray-400 truncate">{profile.bio}</p>
              ) : (
                <p className="text-sm text-gray-400">—</p>
              )}
            </div>
          </div>

          {/* Info rows */}
          <div className="px-4 pb-3 space-y-2">
            {status && (
              <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                <span className={`w-2 h-2 rounded-full shrink-0 ${status === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`} />
                <span>{status === "ONLINE" ? "Online" : "Offline"}</span>
              </div>
            )}
            {profile?.email && (
              <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                <LuMail className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
            )}
            {profile?.localTime && (
              <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                <LuClock className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{profile.localTime}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 px-4 pb-4">
            {/* Direct chat message functionality - commented out for now
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <LuMessageSquare className="h-4 w-4" />
              Chat
            </button>
            */}
            <button
              type="button"
              onClick={handleViewProfile}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <LuUser className="h-4 w-4" />
              View profile
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
