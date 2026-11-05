"use client";

import { createElement, useState } from "react";
import { LuDownload, LuFile, LuRotateCcw } from "react-icons/lu";
import { getFileIcon, getFileColor, formatBytes } from "@/lib/fileDisplay";
import type { ChatMessageAttachment } from "@/hooks/useChatConversations";
import ImageViewerModal from "@/components/ui/ImageViewerModal";

function isImageAttachment(attachment: ChatMessageAttachment): boolean {
  return (
    attachment.mimeType.startsWith("image/") ||
    attachment.attachmentType === "image" ||
    attachment.attachmentType === "generated-image"
  );
}

export default function ChatAttachmentCard({
  attachment,
  onRegenerate,
  regenerating,
}: {
  attachment: ChatMessageAttachment;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const href = attachment.url ?? attachment.previewUrl;
  const isImage = isImageAttachment(attachment);
  const [viewerOpen, setViewerOpen] = useState(false);

  if (isImage && href) {
    return (
      <>
        <div className="relative h-56 w-56 shrink-0">
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="block h-full w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
            title={attachment.fileName}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={href} alt={attachment.fileName} className="h-full w-full object-cover" />
          </button>
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              title="Regenerate image"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-600 shadow-md hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <LuRotateCcw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
        <ImageViewerModal
          isOpen={viewerOpen}
          url={href}
          fileName={attachment.fileName}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  const color = getFileColor(attachment.mimeType);

  return (
    <div className="flex max-w-[240px] items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 dark:border-gray-700 dark:bg-gray-900">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}18` }}
      >
        {attachment.status === "error"
          ? createElement(LuFile, { className: "h-4 w-4 text-red-500" })
          : createElement(getFileIcon(attachment.mimeType), { className: "h-4 w-4", style: { color } })}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
          {attachment.fileName}
        </p>
        <p className="text-[11px] text-gray-400">
          {attachment.status === "uploading"
            ? "Uploading…"
            : attachment.status === "error"
              ? attachment.error ?? "Upload failed"
              : formatBytes(attachment.fileSize)}
        </p>
      </div>
      {attachment.url && (
        <a
          href={attachment.url}
          download={attachment.fileName}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          title="Download"
        >
          <LuDownload className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
