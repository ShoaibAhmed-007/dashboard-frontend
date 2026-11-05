"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { parseApiError } from "@/lib/api";

export default function UserAddressCard() {
  const { profile, isLoading, fetch, update } = useProfile();

  useEffect(() => {
    if (!profile) fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleLocalTime = async () => {
    if (!profile) return;
    try {
      await update({ showLocalTime: !profile.showLocalTime });
      toast.success("Preference updated");
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <h4 className="text-lg font-normal text-gray-800 dark:text-white/90 mb-6">
        Account Info
      </h4>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
            Member Since
          </p>
          <p className="text-sm font-normal text-gray-800 dark:text-white/90">
            {joinedDate}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
            Account Status
          </p>
          <span className="inline-flex items-center gap-1.5 text-sm font-normal text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Active
          </span>
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
              aria-checked={profile?.showLocalTime ?? false}
              disabled={isLoading || !profile}
              onClick={handleToggleLocalTime}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                profile?.showLocalTime ? "bg-brand-500" : "bg-gray-200 dark:bg-white/10"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  profile?.showLocalTime ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
