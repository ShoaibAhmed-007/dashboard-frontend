"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useAuth } from "@/context/AuthContext";
import UserAvatar from "@/components/ui/UserAvatar";
import { useProfile } from "@/hooks/useProfile";
import { parseApiError } from "@/lib/api";

const editSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  designation: z.string().max(100).optional().or(z.literal("")),
  bio: z.string().max(500).optional().or(z.literal("")),
});

type EditValues = z.infer<typeof editSchema>;

export default function UserMetaCard() {
  const { isOpen, openModal, closeModal } = useModal();
  const { user } = useAuth();
  const { profile, isLoading, fetch, update } = useProfile();

  useEffect(() => {
    if (!profile) fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  });

  const handleOpen = () => {
    reset({
      fullName: profile?.fullName ?? user?.fullName ?? "",
      designation: profile?.designation ?? "",
      bio: profile?.bio ?? "",
    });
    openModal();
  };

  const onSubmit = async (values: EditValues) => {
    try {
      await update({
        fullName: values.fullName,
        designation: values.designation || undefined,
        bio: values.bio || undefined,
      });
      toast.success("Profile updated");
      closeModal();
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const displayName = profile?.fullName ?? user?.fullName;
  const displayEmail = profile?.email ?? user?.email;
  const avatarColor = user?.avatarColor ?? "#6366f1";

  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
            <UserAvatar
              name={displayName}
              avatarUrl={profile?.profilePicture}
              size={80}
              color={avatarColor}
            />

            <div className="order-3 xl:order-2 flex-1">
              <h4 className="mb-1 text-lg font-normal text-center text-gray-800 dark:text-white/90 xl:text-left">
                {displayName ?? "—"}
              </h4>
              {profile?.designation && (
                <p className="text-sm text-brand-500 text-center xl:text-left mb-1">
                  {profile.designation}
                </p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center xl:text-left">
                {displayEmail ?? "—"}
              </p>
              {profile?.bio && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 text-center xl:text-left line-clamp-2">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleOpen}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-normal text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3 dark:hover:text-gray-200 lg:inline-flex lg:w-auto disabled:opacity-50"
          >
            <svg className="fill-current" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z" fill="" />
            </svg>
            Edit
          </button>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[560px] m-4">
        <div className="no-scrollbar relative w-full max-w-[560px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-10">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-normal text-gray-800 dark:text-white/90">
              Edit Profile
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Update your display name, role, and bio.
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col px-2">
            <div className="space-y-5">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your full name"
                  error={!!errors.fullName}
                  hint={errors.fullName?.message}
                  {...register("fullName")}
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
                  {...register("designation")}
                />
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  type="text"
                  placeholder="A short bio about yourself"
                  error={!!errors.bio}
                  hint={errors.bio?.message}
                  {...register("bio")}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6 lg:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm font-normal text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/3 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-normal text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
