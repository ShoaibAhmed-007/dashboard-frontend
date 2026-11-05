"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import UserAvatar from "@/components/ui/UserAvatar";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfilePanel({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const { profile, fetch, update } = useProfile();
  const router = useRouter();
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && !profile) fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    setBioValue(profile?.bio ?? "");
  }, [profile?.bio]);

  const handleBioEdit = () => {
    setBioValue(profile?.bio ?? "");
    setEditingBio(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleBioSave = async () => {
    setSavingBio(true);
    try {
      await update({ bio: bioValue.trim() });
      toast.success("Bio updated");
    } catch {
      toast.error("Failed to update bio");
    } finally {
      setSavingBio(false);
      setEditingBio(false);
    }
  };

  const handleBioKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setEditingBio(false); setBioValue(profile?.bio ?? ""); }
  };

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  const displayName = profile?.fullName ?? user?.fullName ?? "User";
  const displayEmail = profile?.email ?? user?.email ?? "";
  const avatarColor = user?.avatarColor ?? "#6366f1";
  const status = profile?.status ?? "ONLINE";
  const localTime = profile?.localTime;
  const timezone = profile?.timezone;
  const designation = profile?.designation;
  const bio = profile?.bio;
  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    // Sidebar column — slides in from the right as a flex sibling (not overlay)
    <div
      className={`h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden transition-all duration-200 ease-in-out shrink-0 ${
        isOpen ? "w-80" : "w-0"
      }`}
    >
      {/* Only render content when visible to avoid tab-focus issues */}
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
          <div className="flex-1 overflow-y-auto">
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
                  {editingBio ? (
                    <div className="mt-1">
                      <textarea
                        ref={textareaRef}
                        value={bioValue}
                        onChange={(e) => setBioValue(e.target.value)}
                        onKeyDown={handleBioKeyDown}
                        rows={3}
                        placeholder="Add a description..."
                        className="w-full resize-none rounded-md border border-brand-400 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 outline-none placeholder:text-gray-400"
                      />
                      <div className="mt-1 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleBioSave}
                          disabled={savingBio}
                          className="rounded px-2 py-0.5 text-[11px] font-normal bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                        >
                          {savingBio ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingBio(false); setBioValue(profile?.bio ?? ""); }}
                          className="rounded px-2 py-0.5 text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleBioEdit}
                      className="mt-1 w-full text-left"
                    >
                      {bio ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">{bio}</p>
                      ) : (
                        <p className="text-xs text-gray-400 italic hover:text-gray-500 dark:hover:text-gray-300 transition-colors">Add description...</p>
                      )}
                    </button>
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
                <span className="truncate text-sm">{displayEmail}</span>
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

            {/* Activity tab bar (UI only) */}
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
          </div>

          {/* Footer action */}
          <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-5 py-3">
            <button
              onClick={() => { onClose(); router.push("/settings"); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
          </div>
        </>
      )}
    </div>
  );
}
