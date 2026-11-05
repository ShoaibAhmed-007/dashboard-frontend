"use client";

import { useEffect, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import { userService } from "@/services/user.service";
import { UserProfile } from "@/hooks/useProfile";

interface Props {
  userId: string | null;
  onClose: () => void;
}

export default function ViewUserProfilePanel({ userId, onClose }: Props) {
  const isOpen = Boolean(userId);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    setLoading(true);
    userService.getById(userId)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const displayName = profile?.fullName ?? "User";
  const avatarColor = "#6366f1";
  const status = profile?.status ?? "ONLINE";
  const localTime = profile?.localTime;
  const timezone = profile?.timezone;
  const designation = profile?.designation;
  const bio = profile?.bio;
  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div
      className={`h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden transition-all duration-200 ease-in-out shrink-0 ${
        isOpen ? "w-80" : "w-0"
      }`}
    >
      {isOpen && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-normal text-gray-800 dark:text-white/90">{displayName}</span>
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
              </div>
            ) : !profile ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-gray-400">Could not load profile</p>
              </div>
            ) : (
              <>
                {/* Avatar + status + description */}
                <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-start gap-4">
                    <UserAvatar
                      name={displayName}
                      avatarUrl={profile?.profilePicture}
                      size={72}
                      color={avatarColor}
                      shape="rounded"
                    />
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-normal text-gray-800 dark:text-white/90">{displayName}</h3>
                        <span className={`inline-flex items-center gap-1 text-xs font-normal ${
                          status === "ONLINE" ? "text-green-500" : "text-gray-400"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`} />
                          {status === "ONLINE" ? "Online" : "Offline"}
                        </span>
                      </div>
                      {designation && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{designation}</p>
                      )}
                      {bio ? (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{bio}</p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-400 italic">No description</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info rows */}
                <div className="px-5 py-4 space-y-3 border-b border-gray-100 dark:border-gray-800">
                  {/* Email */}
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <span className="truncate text-sm">{profile.email}</span>
                  </div>

                  {/* Local time */}
                  {localTime && (
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{localTime}{timezone ? ` local time` : ""}</span>
                    </div>
                  )}

                  {/* Joined */}
                  {joinedDate && (
                    <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-gray-500">
                      <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
                      </svg>
                      <span className="text-xs">Member since {joinedDate}</span>
                    </div>
                  )}
                </div>

                {/* Tab bar */}
                <div className="border-b border-gray-100 dark:border-gray-800">
                  <div className="flex px-5">
                    {["Activity", "Tasks", "Comments"].map((tab, i) => (
                      <button
                        key={tab}
                        className={`px-3 py-3 text-xs font-normal border-b-2 transition-colors ${
                          i === 0
                            ? "border-brand-500 text-brand-500"
                            : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Activity placeholder */}
                <div className="px-5 py-6 text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500">No recent activity</p>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
