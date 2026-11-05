"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useProfile } from "@/hooks/useProfile";
import { parseApiError } from "@/lib/api";

const editSchema = z.object({
  timezone: z.string().max(100).optional().or(z.literal("")),
  status: z.enum(["ONLINE", "OFFLINE"]),
  showLocalTime: z.boolean(),
});

type EditValues = z.infer<typeof editSchema>;

export default function UserInfoCard() {
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
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  });

  const showLocalTime = watch("showLocalTime");

  const handleOpen = () => {
    reset({
      timezone: profile?.timezone ?? "",
      status: profile?.status ?? "ONLINE",
      showLocalTime: profile?.showLocalTime ?? false,
    });
    openModal();
  };

  const onSubmit = async (values: EditValues) => {
    try {
      await update({
        timezone: values.timezone || undefined,
        status: values.status,
        showLocalTime: values.showLocalTime,
      });
      toast.success("Profile updated");
      closeModal();
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const firstName = (profile?.fullName ?? user?.fullName ?? "").split(" ")[0] || "—";
  const lastName = (profile?.fullName ?? user?.fullName ?? "").split(" ").slice(1).join(" ") || "—";
  const email = profile?.email ?? user?.email ?? "—";
  const status = profile?.status ?? "ONLINE";
  const timezone = profile?.timezone;
  const localTime = profile?.localTime;

  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <h4 className="text-lg font-normal text-gray-800 dark:text-white/90 lg:mb-6">
              Personal Information
            </h4>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">First Name</p>
                <p className="text-sm font-normal text-gray-800 dark:text-white/90">{firstName}</p>
              </div>
              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Last Name</p>
                <p className="text-sm font-normal text-gray-800 dark:text-white/90">{lastName}</p>
              </div>
              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Email Address</p>
                <p className="text-sm font-normal text-gray-800 dark:text-white/90">{email}</p>
              </div>
              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Status</p>
                <span className={`inline-flex items-center gap-1.5 text-sm font-normal ${status === "ONLINE" ? "text-green-600" : "text-gray-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${status === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`} />
                  {status === "ONLINE" ? "Online" : "Offline"}
                </span>
              </div>
              {timezone && (
                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Timezone</p>
                  <p className="text-sm font-normal text-gray-800 dark:text-white/90">{timezone}</p>
                </div>
              )}
              {localTime && (
                <div>
                  <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Local Time</p>
                  <p className="text-sm font-normal text-gray-800 dark:text-white/90">{localTime}</p>
                </div>
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
              Edit Personal Info
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Update your timezone, status, and local time preference.
            </p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col px-2">
            <div className="space-y-5">
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  type="text"
                  placeholder="e.g. Asia/Karachi"
                  error={!!errors.timezone}
                  hint={errors.timezone?.message ?? "IANA timezone string"}
                  {...register("timezone")}
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  {...register("status")}
                  className="w-full h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-colors"
                >
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                </select>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <div>
                  <p className="text-sm font-normal text-gray-800 dark:text-white/90">Show Local Time</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Display your local time to teammates</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showLocalTime}
                  onClick={() => setValue("showLocalTime", !showLocalTime)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showLocalTime ? "bg-brand-500" : "bg-gray-200 dark:bg-white/10"}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${showLocalTime ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
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
