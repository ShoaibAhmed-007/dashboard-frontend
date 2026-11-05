"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { LuLink, LuLoader } from "react-icons/lu";

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { linkUrl: string; title: string; description?: string }) => Promise<void>;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AddLinkModal({ isOpen, onClose, onSubmit }: AddLinkModalProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ linkUrl?: string; title?: string }>({});

  const handleClose = () => {
    if (loading) return;
    setLinkUrl("");
    setTitle("");
    setDescription("");
    setErrors({});
    onClose();
  };

  const validate = () => {
    const errs: { linkUrl?: string; title?: string } = {};
    if (!linkUrl.trim()) {
      errs.linkUrl = "URL is required";
    } else if (!isValidUrl(linkUrl.trim())) {
      errs.linkUrl = "Must be a valid http:// or https:// URL";
    }
    if (!title.trim()) {
      errs.title = "Title is required";
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        linkUrl: linkUrl.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setLinkUrl("");
      setTitle("");
      setDescription("");
      setErrors({});
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-md mx-4" showCloseButton={false} backdropClassName="fixed inset-0 h-full w-full bg-black/30 backdrop-blur-[4px]">
      <div className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950">
            <LuLink className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add External Link</h2>
            <p className="text-xs text-gray-400">Attach a URL to this project</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => { setLinkUrl(e.target.value); setErrors((p) => ({ ...p, linkUrl: undefined })); }}
              placeholder="https://www.figma.com/file/..."
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400
                focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
                ${errors.linkUrl ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
              disabled={loading}
              autoFocus
            />
            {errors.linkUrl && <p className="mt-1 text-xs text-red-500">{errors.linkUrl}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: undefined })); }}
              placeholder="e.g. Figma Design Board"
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400
                focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
                ${errors.title ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
              disabled={loading}
            />
            {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this link..."
              rows={2}
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
              Add Link
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
