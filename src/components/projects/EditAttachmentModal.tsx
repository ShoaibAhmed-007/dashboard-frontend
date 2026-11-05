"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { LuPencil, LuLoader } from "react-icons/lu";
import { ProjectAttachment } from "@/services/project-attachment.service";

interface EditAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: ProjectAttachment | null;
  onSubmit: (payload: { title: string | null; description: string | null }) => Promise<void>;
}

export default function EditAttachmentModal({ isOpen, onClose, attachment, onSubmit }: EditAttachmentModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (attachment) {
      setTitle(attachment.title ?? "");
      setDescription(attachment.description ?? "");
    }
  }, [attachment]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim() || null,
        description: description.trim() || null,
      });
    } finally {
      setLoading(false);
    }
  };

  const displayName = attachment
    ? (attachment.title ?? (attachment.kind === "FILE" ? attachment.fileName : attachment.linkUrl))
    : "";

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-md mx-4" showCloseButton={false} backdropClassName="fixed inset-0 h-full w-full bg-black/30 backdrop-blur-[4px]">
      <div className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950">
            <LuPencil className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Edit Attachment</h2>
            <p className="max-w-[260px] truncate text-xs text-gray-400">{displayName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Attachment title..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors
                bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400
                focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors
                bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400
                focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-60"
            >
              {loading && <LuLoader className="h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
