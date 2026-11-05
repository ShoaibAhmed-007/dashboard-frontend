"use client";

import { useEffect } from "react";
import { LuDownload, LuX } from "react-icons/lu";

interface Props {
  isOpen: boolean;
  url: string | null;
  fileName: string;
  onClose: () => void;
  /**
   * A ready-made link that saves rather than displays — chat attachments come
   * with one already signed as `Content-Disposition: attachment`. When absent,
   * the file is pulled through our own proxy to attach that header, which is
   * the only way to force a save for a cross-origin URL.
   */
  downloadUrl?: string | null;
}

async function triggerDownload(url: string, fileName: string) {
  const proxyUrl = `/api/download-proxy?url=${encodeURIComponent(url)}&fileName=${encodeURIComponent(fileName)}`;
  const a = document.createElement("a");
  a.href = proxyUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Full-size image preview over the current screen.
 *
 * Shared between the AI assistant's attachments and chat messages — opening a
 * picture in a new tab loses the conversation behind it, so it is shown in
 * place and dismissed with Escape, the close button, or a click on the empty
 * surface around the image.
 */
export default function ImageViewerModal({
  isOpen,
  url,
  fileName,
  onClose,
  downloadUrl,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !url) return null;

  const download = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloadUrl) {
      // Already signed to save — no proxy round-trip needed.
      const a = document.createElement("a");
      a.href = downloadUrl;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      void triggerDownload(url, fileName);
    }
  };

  return (
    /* A solid surface rather than a translucent, blurred scrim: the point is
       to look at the picture, and a half-visible app behind it competes for
       attention. Above the app's other overlays (dialogs sit at 10000) so an
       image opened from inside one is not trapped behind it. */
    <div
      className="fixed inset-0 z-10001 flex flex-col bg-[#1c1c1c]"
      onClick={onClose}
    >
      {/* Title bar — filename on the left, controls on the right, both clear
          of the image rather than floating over its corner. */}
      <div
        className="flex shrink-0 items-center gap-3 px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="min-w-0 flex-1 truncate text-sm text-white/90">
          {fileName}
        </p>
        <button
          type="button"
          onClick={download}
          aria-label="Download"
          title="Download"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LuDownload className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LuX className="h-5 w-5" />
        </button>
      </div>

      {/* The image gets everything left over, so the frame is the same for
          every picture.

          `h/w-full` rather than `max-h/max-w-full`: the max- form caps the
          image at its natural size, so anything smaller than the frame opens
          small — the opposite of a large preview. Sizing to the frame lets it
          scale up as well as down, and `object-contain` fits the whole picture
          inside either way, so each one keeps its own aspect ratio. */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={fileName}
          onClick={(e) => e.stopPropagation()}
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  );
}
