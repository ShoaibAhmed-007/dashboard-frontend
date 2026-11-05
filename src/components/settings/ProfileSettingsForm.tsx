"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import UserAvatar from "@/components/ui/UserAvatar";
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
} from "@/services/user.service";
import { parseApiError } from "@/lib/api";

const schema = z.object({
  fullName: z.string().min(2, "At least 2 characters").max(100),
  designation: z.string().max(100).optional().or(z.literal("")),
  bio: z.string().max(500).optional().or(z.literal("")),
  timezone: z.string().max(100).optional().or(z.literal("")),
  showLocalTime: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function ProfileSettingsForm() {
  const { user } = useAuth();
  const { profile, isLoading, fetch, update, uploadAvatar, removeAvatar } =
    useProfile();

  useEffect(() => {
    if (!profile) fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      designation: "",
      bio: "",
      timezone: "",
      showLocalTime: false,
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        fullName: profile.fullName,
        designation: profile.designation ?? "",
        bio: profile.bio ?? "",
        timezone: profile.timezone ?? "",
        showLocalTime: profile.showLocalTime,
      });
    }
  }, [profile, reset]);

  const showLocalTime = watch("showLocalTime");
  const avatarColor = user?.avatarColor ?? "#6366f1";
  const [uploading, setUploading] = useState(false);
  /* An `initials:` token counts as "no photo" — it is the API's way of
     spelling null, so offering "Remove" for it would be a no-op. */
  const hasPicture = Boolean(
    profile?.profilePicture &&
      !profile.profilePicture.startsWith("initials:")
  );

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    // Clear it immediately so re-picking the same file still fires onChange.
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

    setUploading(true);
    try {
      await uploadAvatar(file);
      toast.success("Profile picture updated.");
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    setUploading(true);
    try {
      await removeAvatar();
      toast.success("Profile picture removed.");
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't remove the picture.");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      await update({
        fullName: values.fullName,
        designation: values.designation || undefined,
        bio: values.bio || undefined,
        timezone: values.timezone || undefined,
        showLocalTime: values.showLocalTime,
      });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  return (
    <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      {/* Left label */}
      <div className="w-full lg:w-56 shrink-0">
        <h3 className="text-sm font-normal text-gray-800 dark:text-white/90">Profile</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Your personal information and display preferences.
        </p>
      </div>

      {/* Right form */}
      <div className="flex-1 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="group relative">
            <UserAvatar
              name={profile?.fullName ?? user?.fullName}
              avatarUrl={profile?.profilePicture}
              size={80}
              color={avatarColor}
            />
            {/* The label *is* the button — a file input cannot be opened from
                script without a user gesture on the input itself. */}
            <label
              className={`absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 text-[11px] font-medium text-white transition-opacity ${
                uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              title="Change profile picture"
            >
              {uploading ? "Uploading…" : "Change"}
              <input
                type="file"
                accept={AVATAR_ALLOWED_MIME_TYPES.join(",")}
                className="sr-only"
                disabled={uploading}
                onChange={handleAvatarChange}
              />
            </label>
          </div>
          {hasPicture && !uploading && (
            <button
              type="button"
              onClick={handleAvatarRemove}
              className="text-xs text-gray-400 transition-colors hover:text-red-500"
            >
              Remove photo
            </button>
          )}
          <p className="text-sm font-normal text-gray-800 dark:text-white/90">
            {profile?.fullName ?? user?.fullName ?? "—"}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Your full name"
                error={!!errors.fullName}
                hint={errors.fullName?.message}
                disabled={isLoading}
                {...register("fullName")}
              />
            </div>

            <div className="lg:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                defaultValue={profile?.email ?? user?.email ?? ""}
                disabled
              />
            </div>

            <div>
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                type="text"
                placeholder="e.g. Senior Engineer"
                error={!!errors.designation}
                hint={errors.designation?.message}
                disabled={isLoading}
                {...register("designation")}
              />
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                type="text"
                placeholder="e.g. Asia/Karachi"
                error={!!errors.timezone}
                hint={errors.timezone?.message}
                disabled={isLoading}
                {...register("timezone")}
              />
            </div>

            <div className="lg:col-span-2">
              <Label htmlFor="bio">Bio</Label>
              <Input
                id="bio"
                type="text"
                placeholder="A short bio about yourself"
                error={!!errors.bio}
                hint={errors.bio?.message}
                disabled={isLoading}
                {...register("bio")}
              />
            </div>

            <div className="lg:col-span-2">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <div>
                  <p className="text-sm font-normal text-gray-800 dark:text-white/90">Show Local Time</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Let teammates see your current local time
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showLocalTime}
                  onClick={() => setValue("showLocalTime", !showLocalTime, { shouldDirty: true })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showLocalTime ? "bg-brand-500" : "bg-gray-200 dark:bg-white/10"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      showLocalTime ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-normal text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
