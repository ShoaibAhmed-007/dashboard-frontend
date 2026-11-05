"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/context/ThemeContext";
import { api, parseApiError } from "@/lib/api";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import UserAvatar from "@/components/ui/UserAvatar";
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
} from "@/services/user.service";

function SectionRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-0 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="w-[200px] shrink-0 py-5 pr-6">
        <p className="text-[14px] font-semibold text-gray-900 dark:text-white/90">{label}</p>
        {description && <p className="mt-1 text-xs text-[#838383] dark:text-gray-501 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-1 py-5 min-w-0">{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 text-xs font-normal text-gray-900 dark:text-gray-401">{label}</p>
      {children}
    </div>
  );
}


export default function MySettingsPage() {
  const { user, logout } = useAuth();
  const { profile, fetch, update, uploadAvatar, removeAvatar } =
    useProfile();
  const { theme, toggleTheme } = useTheme();

  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [appearance, setAppearance] = useState<"light" | "dark" | "auto">("light");
  const [timezone, setTimezone] = useState("Asia/Karachi");
  const [onlineStatus, setOnlineStatus] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [savedOnlineStatus, setSavedOnlineStatus] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [logoutAllModalOpen, setLogoutAllModalOpen] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // Track saved baseline to detect dirty state
  const [savedName, setSavedName] = useState("");
  const [savedTimezone, setSavedTimezone] = useState("Asia/Karachi");

  const isDirty =
    fullName !== savedName ||
    timezone !== savedTimezone ||
    onlineStatus !== savedOnlineStatus ||
    !!currentPassword ||
    !!newPassword ||
    !!confirmPassword;

  useEffect(() => {
    if (!profile) fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setSavedName(profile.fullName);
      setTimezone(profile.timezone ?? "Asia/Karachi");
      setSavedTimezone(profile.timezone ?? "Asia/Karachi");
      setOnlineStatus(profile.status);
      setSavedOnlineStatus(profile.status);
    }
  }, [profile]);

  useEffect(() => {
    setAppearance(theme === "dark" ? "dark" : "light");
  }, [theme]);

  const avatarColor = user?.avatarColor ?? "#6366f1";
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  /* An `initials:` token is the API's way of spelling "no photo", so
     offering Remove for it would be a no-op. */
  const hasPicture = Boolean(
    profile?.profilePicture && !profile.profilePicture.startsWith("initials:")
  );

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    // Cleared immediately so re-picking the same file still fires onChange.
    event.target.value = "";
    if (!file) return;

    if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.type as never)) {
      toast.error("Use a PNG, JPEG, WebP or GIF image.");
      return;
    }
    if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) {
      toast.error("That image is larger than 5MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      toast.success("Profile picture updated.");
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't upload that image.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    setUploadingAvatar(true);
    try {
      await removeAvatar();
      toast.success("Profile picture removed.");
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't remove the picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Parameters<typeof update>[0] = {};
      if (fullName !== profile?.fullName) updates.fullName = fullName;
      if (timezone !== profile?.timezone) updates.timezone = timezone;
      if (onlineStatus !== profile?.status) updates.status = onlineStatus;
      if (Object.keys(updates).length) await update(updates);

      if (currentPassword || newPassword || confirmPassword) {
        setPasswordError("");
        if (!currentPassword) { setPasswordError("Current password is required"); setSaving(false); return; }
        if (!newPassword) { setPasswordError("New password is required"); setSaving(false); return; }
        if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match"); setSaving(false); return; }
        try {
          await api.patch("/user/change-password", { currentPassword, newPassword });
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        } catch (err) {
          setPasswordError(parseApiError(err).message);
          setSaving(false);
          return;
        }
      }

      setSavedName(fullName);
      setSavedTimezone(timezone);
      setSavedOnlineStatus(onlineStatus);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete("/user/profile");
      await logout();
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setDeletingAccount(false);
      setDeleteModalOpen(false);
    }
  };

  const handleLogoutAll = async () => {
    setLoggingOutAll(true);
    try {
      const { userService } = await import("@/services/user.service");
      await userService.logoutAll();
      toast.success("Signed out of all sessions");
      await logout();
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setLoggingOutAll(false);
      setLogoutAllModalOpen(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-900 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
      <div className="mx-auto max-w-full px-8 py-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">My Settings</h1>

        {/* ── Profile ─────────────────────────────────────────── */}
        <SectionRow label="Profile" description="Your personal information and account security settings.">
          <div className="space-y-1">
            {/* Avatar */}
            <div className="mb-5">
              <p className="text-xs font-normal text-gray-500 dark:text-gray-401 mb-2">Avatar</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="group relative shrink-0">
                    <UserAvatar
                      name={profile?.fullName ?? user?.fullName}
                      avatarUrl={profile?.profilePicture}
                      size={56}
                      color={avatarColor}
                    />
                    {/* The label *is* the control: a file dialog cannot be
                        opened from script without a gesture on the input. */}
                    <label
                      className={`absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 text-[10px] font-medium text-white transition-opacity ${
                        uploadingAvatar
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                      title="Change profile picture"
                    >
                      {uploadingAvatar ? "…" : "Change"}
                      <input
                        type="file"
                        accept={AVATAR_ALLOWED_MIME_TYPES.join(",")}
                        className="sr-only"
                        disabled={uploadingAvatar}
                        onChange={handleAvatarChange}
                      />
                    </label>
                    <span className={`pointer-events-none absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-950 ${onlineStatus === "ONLINE" ? "bg-green-500" : "bg-gray-401"}`} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="cursor-pointer text-xs font-medium text-brand-500 hover:text-brand-600">
                      {hasPicture ? "Change photo" : "Upload photo"}
                      <input
                        type="file"
                        accept={AVATAR_ALLOWED_MIME_TYPES.join(",")}
                        className="sr-only"
                        disabled={uploadingAvatar}
                        onChange={handleAvatarChange}
                      />
                    </label>
                    {hasPicture && (
                      <button
                        type="button"
                        onClick={handleAvatarRemove}
                        disabled={uploadingAvatar}
                        className="text-left text-xs text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>

                {/* Pill switcher */}
                <div
                  className={`relative flex items-center rounded-full border-2 p-1 cursor-pointer select-none transition-colors duration-300 ${onlineStatus === "ONLINE" ? "border-green-500" : "border-gray-400"}`}
                  onClick={() => setOnlineStatus(s => s === "ONLINE" ? "OFFLINE" : "ONLINE")}
                >
                  {/* Sliding background */}
                  <span
                    className={`absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-in-out ${onlineStatus === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`}
                    style={{
                      left: onlineStatus === "ONLINE" ? "calc(50% - 2px)" : "4px",
                      right: onlineStatus === "ONLINE" ? "4px" : "calc(50% - 2px)",
                    }}
                  />
                  <span className={`relative z-10 px-4 py-1.5 rounded-full text-sm font-normal transition-colors duration-300 ${onlineStatus === "OFFLINE" ? "text-white" : "text-gray-400"}`}>
                    Offline
                  </span>
                  <span className={`relative z-10 px-4 py-1.5 rounded-full text-sm font-normal transition-colors duration-300 ${onlineStatus === "ONLINE" ? "text-white" : "text-green-500"}`}>
                    Online
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm font-normal text-gray-800 dark:text-gray-401">
                {profile?.fullName ?? user?.fullName ?? "—"}
              </p>
            </div>

            <FieldRow label="Full Name">
              <div className="relative flex items-center rounded-xl border border-gray-200 hover:border-gray-300 focus-within:border-gray-905 focus-within:shadow-md focus-within:hover:border-gray-905 dark:border-gray-800 dark:hover:border-gray-801  dark:focus-within:border-gray-000 dark:focus-within:hover:border-gray-000 bg-white dark:bg-gray-900 px-3 h-10">
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                </svg>
                <input
                  type="text"
                  autoComplete=".."
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="flex-1 text-sm text-gray-800 dark:text-gray-100 bg-transparent  outline-none"
                />
              </div>
            </FieldRow>

            <FieldRow label="Email">
              <div className="relative flex items-center rounded-xl border border-gray-200 hover:border-gray-300 focus-within:border-gray-905 focus-within:shadow-md focus-within:hover:border-gray-905 dark:border-gray-800 dark:hover:border-gray-801  dark:focus-within:border-gray-000 dark:focus-within:hover:border-gray-000 bg-white dark:bg-gray-900 px-3 h-10">
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <input
                  type="email"
                  value={profile?.email ?? user?.email ?? ""}
                  disabled
                  className="flex-1 text-sm text-gray-400 bg-transparent outline-none cursor-not-allowed"
                />
              </div>
            </FieldRow>

            <FieldRow label="Current Password">
              <div className={`relative flex items-center rounded-xl border border-gray-200 hover:border-gray-300 focus-within:border-gray-905 focus-within:shadow-md focus-within:hover:border-gray-905 dark:border-gray-800 dark:hover:border-gray-801  dark:focus-within:border-gray-000 dark:focus-within:hover:border-gray-000 bg-white dark:bg-gray-900 px-3 h-10 ${passwordError && !currentPassword ? "border-red-400" : "border-gray-200 dark:border-gray-700"}`}>
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={e => { setCurrentPassword(e.target.value); setPasswordError(""); }}
                  placeholder="Enter current password"
                  className="flex-1 text-sm text-gray-800 dark:text-gray-100 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>
            </FieldRow>

            <FieldRow label="New Password">
              <div className="relative flex items-center rounded-xl border border-gray-200 hover:border-gray-300 focus-within:border-gray-905 focus-within:shadow-md focus-within:hover:border-gray-905 dark:border-gray-800 dark:hover:border-gray-801  dark:focus-within:border-gray-000 dark:focus-within:hover:border-gray-000 bg-white dark:bg-gray-900 px-3 h-10">
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPasswordError(""); }}
                  placeholder="Enter new password"
                  className="flex-1 text-sm text-gray-800 dark:text-gray-100 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>
            </FieldRow>

            <FieldRow label="Confirm New Password">
              <div className={`relative flex items-center rounded-xl border border-gray-200 hover:border-gray-300 focus-within:border-gray-905 focus-within:shadow-md focus-within:hover:border-gray-905 dark:border-gray-800 dark:hover:border-gray-801  dark:focus-within:border-gray-000 dark:focus-within:hover:border-gray-000 bg-white dark:bg-gray-900 px-3 h-10 ${passwordError === "Passwords do not match" ? "border-red-400" : "border-gray-200 dark:border-gray-700"}`}>
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setPasswordError(""); }}
                  placeholder="Confirm new password"
                  className="flex-1 text-sm text-gray-800 dark:text-gray-100 bg-transparent outline-none placeholder:text-gray-400"
                />
              </div>
            </FieldRow>

            {passwordError && (
              <p className="mt-1 text-xs text-red-500">{passwordError}</p>
            )}
          </div>
        </SectionRow>

        {/* ── Appearance ───────────────────────────────────────── */}
        <SectionRow label="Appearance" description="Choose light or dark mode, or switch your mode automatically based on your system settings.">
          <div className="flex items-center gap-3 flex-wrap">
            {(["light", "dark", "auto"] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setAppearance(mode);
                  if (mode !== "auto") {
                    if ((mode === "dark") !== (theme === "dark")) toggleTheme();
                  }
                }}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-2 transition-colors ${
                  appearance === mode
                    ? "border-brand-500"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                {/* Mini preview */}
                <div className={`w-24 h-14 rounded-lg overflow-hidden flex ${mode === "dark" ? "bg-gray-900" : mode === "auto" ? "bg-gradient-to-r from-white to-gray-900" : "bg-white"} border border-gray-200 dark:border-gray-700`}>
                  <div className={`w-8 h-full ${mode === "dark" ? "bg-gray-800" : mode === "auto" ? "bg-gray-100" : "bg-gray-100"}`} />
                  <div className="flex-1 p-1.5 space-y-1">
                    <div className={`h-1.5 rounded-full w-full ${mode === "dark" ? "bg-gray-700" : "bg-gray-200"}`} />
                    <div className={`h-1.5 rounded-full w-3/4 ${mode === "dark" ? "bg-gray-700" : "bg-gray-200"}`} />
                    <div className={`h-1.5 rounded-full w-1/2 ${mode === "dark" ? "bg-gray-700" : "bg-gray-200"}`} />
                  </div>
                </div>
                <span className="text-xs font-normal text-gray-700 dark:text-gray-300 capitalize">{mode}</span>
              </button>
            ))}
          </div>
        </SectionRow>

        {/* ── Language & Region ────────────────────────────────── */}
        <SectionRow label="Language & Region" description="Customize your timezone.">
          <FieldRow label="Timezone">
            <div className="relative">
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full h-10  rounded-xl border border-gray-200 hover:border-gray-300 focus-within:border-gray-905 focus-within:shadow-md focus-within:hover:border-gray-905 dark:border-gray-800 dark:hover:border-gray-801  dark:focus-within:border-gray-000 dark:focus-within:hover:border-gray-000 bg-white dark:bg-gray-900 dark:text-gray-100  px-3 pr-8 text-sm appearance-none outline-none"
              >
                <option value="Asia/Karachi">Asia/Karachi</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </div>
          </FieldRow>
        </SectionRow>

        {/* ── Danger zone ──────────────────────────────────────── */}
        <SectionRow label="Danger zone" description="Proceed with caution.">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">Log out all sessions including any session on mobile, iPad, and other browsers</p>
            <button
              type="button"
              onClick={() => setLogoutAllModalOpen(true)}
              className="shrink-0 text-sm font-normal text-brand-500  hover:text-brand-600 whitespace-nowrap"
            >
              Log out of all sessions
            </button>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-normal text-white hover:bg-red-600 transition-colors"
            >
              Delete account
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-normal text-white dark:bg-gray-000 dark:text-black hover:bg-brand-600 dark:hover:bg-gray-200  duration-200 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </SectionRow>
      </div>

      <ConfirmActionModal
        isOpen={deleteModalOpen}
        title="Delete account"
        description="This will permanently delete your account and all associated data. This action cannot be undone."
        confirmLabel="Delete my account"
        requireText="DELETE"
        requireTextLabel='Type "DELETE" to confirm'
        onClose={() => { if (!deletingAccount) setDeleteModalOpen(false); }}
        onConfirm={handleDeleteAccount}
        isLoading={deletingAccount}
      />

      <ConfirmActionModal
        isOpen={logoutAllModalOpen}
        title="Sign out of all devices"
        description="This will end all active sessions across every device. You will be signed out of this session too."
        confirmLabel="Sign out everywhere"
        onClose={() => { if (!loggingOutAll) setLogoutAllModalOpen(false); }}
        onConfirm={handleLogoutAll}
        isLoading={loggingOutAll}
      />

      {/* ── Sticky save bar ──────────────────────────────────── */}
      {isDirty && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">You have unsaved changes</p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-normal text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
