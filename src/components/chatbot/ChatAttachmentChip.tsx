"use client";

import { createElement } from "react";
import { LuX, LuRotateCcw, LuLoader } from "react-icons/lu";
import { getFileIcon, getFileColor, formatBytes } from "@/lib/fileDisplay";

export interface AttachmentDraft {
  localId: string;
  file: File;
  previewUrl?: string;
  status: "uploading" | "uploaded" | "error";
  progress: number;
  error?: string;
  attachmentId?: string;
  s3Key?: string;
}

interface Props {
  draft: AttachmentDraft;
  onRetry: (localId: string) => void;
  onRemove: (localId: string) => void;
}

export default function ChatAttachmentChip({ draft, onRetry, onRemove }: Props) {
  const mimeType = draft.file.type || "application/octet-stream";
  const color = getFileColor(mimeType);
  const isImage = mimeType.startsWith("image/");

  return (
    <div className="relative flex max-w-[220px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 pr-6 dark:border-gray-700 dark:bg-gray-800/60">
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md">
        {isImage && draft.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.previewUrl} alt={draft.file.name} className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: `${color}18` }}
          >
            {createElement(getFileIcon(mimeType), { className: "h-4 w-4", style: { color } })}
          </div>
        )}
        {draft.status === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <LuLoader className="h-3.5 w-3.5 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
          {draft.file.name}
        </p>
        {draft.status === "error" ? (
          <button
            type="button"
            onClick={() => onRetry(draft.localId)}
            className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600"
          >
            <LuRotateCcw className="h-2.5 w-2.5" /> Retry
          </button>
        ) : (
          <p className="text-[11px] text-gray-400">
            {draft.status === "uploading"
              ? `Uploading… ${draft.progress}%`
              : formatBytes(draft.file.size)}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(draft.localId)}
        className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        title="Remove"
      >
        <LuX className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
