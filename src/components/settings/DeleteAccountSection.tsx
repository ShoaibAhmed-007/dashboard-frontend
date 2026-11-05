"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import { api, parseApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function DeleteAccountSection() {
  const { isOpen, openModal, closeModal } = useModal();
  const { logout } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete("/user/profile");
      toast.success("Account deleted. Redirecting...");
      closeModal();
      await logout();
    } catch (err) {
      toast.error(parseApiError(err).message);
      setIsDeleting(false);
    }
  };

  return (
    <>
      <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        {/* Left label */}
        <div className="w-full lg:w-56 shrink-0">
          <h3 className="text-sm font-normal text-red-600">Danger Zone</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Permanently delete your account and all associated data.
          </p>
        </div>

        {/* Right */}
        <div className="flex-1 rounded-2xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-white/[0.03] p-6">
          <h4 className="text-sm font-normal text-gray-800 dark:text-white/90 mb-1">
            Delete Account
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Once deleted, your account cannot be recovered. All workspaces you own and your data will be permanently removed.
          </p>
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center justify-center rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-transparent px-5 py-2.5 text-sm font-normal text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            Delete My Account
          </button>
        </div>
      </section>

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[480px] m-4">
        <div className="relative w-full max-w-[480px] rounded-3xl bg-white dark:bg-gray-900 p-8">
          <div className="mb-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h4 className="text-xl font-normal text-gray-800 dark:text-white/90 text-center">
              Delete Account?
            </h4>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
              This action is permanent and cannot be undone. All your data will be lost.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={closeModal}
              disabled={isDeleting}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-normal text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-normal text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
