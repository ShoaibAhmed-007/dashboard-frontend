"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";

interface RenameListModalProps {
  isOpen: boolean;
  initialName: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
  isLoading?: boolean;
}

export default function RenameListModal({
  isOpen,
  initialName,
  onClose,
  onSubmit,
  isLoading = false,
}: RenameListModalProps) {
  const [name, setName] = useState(initialName);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onSubmit(name.trim());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="mx-4 max-w-md">
      <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 dark:bg-gray-950">
        <h2 className="text-lg font-normal text-gray-900 dark:text-white">Rename List</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Update the list name shown in the sidebar and project views.
        </p>

        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-5 h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition-colors focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          autoFocus
        />

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-normal text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-normal text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
