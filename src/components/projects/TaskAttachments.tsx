"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuUpload,
  LuTrash2,
  LuDownload,
  LuLoader,
  LuPaperclip,
  LuX,
  LuMaximize2,
} from "react-icons/lu";
import { attachmentService, Attachment } from "@/services/attachment.service";
import { uploadAttachment } from "@/lib/uploadAttachment";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import { formatBytes, getFileIcon, getFileColor } from "@/lib/fileDisplay";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface TaskAttachmentsProps {
  taskId: string;
  userId: string;
  refreshKey?: number;
}

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  progress: number;
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

// ── Lightbox ─────────────────────────────────────────────────────────────────
function ImageLightbox({ url, fileName, onClose }: { url: string; fileName: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={fileName}
          className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
        {/* Download + Close buttons aligned horizontally in top-right */}
        <div className="absolute -right-3 -top-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void triggerDownload(url, fileName); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg text-gray-700 hover:bg-gray-100"
            title="Download"
          >
            <LuDownload className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg text-gray-700 hover:bg-gray-100"
            title="Close"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-white/70">{fileName}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TaskAttachments({ taskId, userId, refreshKey }: TaskAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      const data = await attachmentService.list(taskId, userId);
      setAttachments(data);
    } catch {
      // silently fail — attachments are optional
    } finally {
      setLoading(false);
    }
  }, [taskId, userId]);

  useEffect(() => {
    void fetchAttachments();
  }, [fetchAttachments, refreshKey]);

  const uploadFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`"${file.name}" exceeds the 10 MB limit`);
      return;
    }

    const uploadId = `${Date.now()}-${Math.random()}`;
    const mimeType = file.type || "application/octet-stream";
    setUploading((prev) => [...prev, { id: uploadId, name: file.name, size: file.size, mimeType, progress: 0 }]);

    try {
      setUploading((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: 30 } : u)));
      await uploadAttachment(file, taskId, userId);
      setUploading((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: 80 } : u)));
      setUploading((prev) => prev.filter((u) => u.id !== uploadId));
      toast.success(`"${file.name}" uploaded`);
      void fetchAttachments();
    } catch (err) {
      setUploading((prev) => prev.filter((u) => u.id !== uploadId));
      toast.error(parseApiError(err).message || `Failed to upload "${file.name}"`);
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((f) => void uploadFile(f));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current = 0;
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (attachment: Attachment) => {
    setDeletingId(attachment.id);
    try {
      await attachmentService.delete(taskId, userId, attachment.s3Key);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      toast.success("Attachment deleted");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenAttachment = (att: Attachment) => {
    if (att.mimeType.startsWith("image/")) {
      setViewingAttachment(att);
    } else {
      window.open(att.url, "_blank", "noreferrer");
    }
  };

  const isImage = (mimeType: string) => mimeType.startsWith("image/");

  return (
    <>
      {viewingAttachment && (
        <ImageLightbox
          url={viewingAttachment.url}
          fileName={viewingAttachment.fileName}
          onClose={() => setViewingAttachment(null)}
        />
      )}

      <div className="mb-6">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuPaperclip className="h-4 w-4 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">Attachments</h3>
            {attachments.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {attachments.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:border-brand-400 hover:bg-brand-50  hover:text-brand-600 dark:border-gray-800 dark:hover:border-gray-000 dark:hover:bg-transparent dark:hover:text-gray-000 transition-colors"
          >
            <LuUpload className="h-3 w-3" />
            Upload
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Drop zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => attachments.length === 0 && uploading.length === 0 && inputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 ${
            dragOver
              ? "border-brand-400 bg-brand-50 dark:border-brand-500 dark:bg-brand-950/40"
              : attachments.length === 0 && uploading.length === 0
              ? "cursor-pointer border-gray-200 hover:border-brand-300 hover:bg-gray-50/80 dark:border-gray-700 dark:hover:border-gray-000 dark:hover:bg-gray-800/40"
              : "border-gray-200 dark:border-gray-700"
          }`}
        >
          {/* Empty state */}
          {!loading && attachments.length === 0 && uploading.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-brand-950 to-brand-900 dark:from-brand-950 dark:to-brand-900">
                <LuUpload className={`h-6 w-6 transition-colors ${dragOver ? "text-brand-500" : "text-brand-400"}`} />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {dragOver ? "Drop files to upload" : "Drop files here or click to upload"}
              </p>
              <p className="mt-1 text-xs text-gray-400">Any file type up to 10 MB</p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="p-4 space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-gray-100 p-3 animate-pulse dark:bg-gray-800">
                  <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2.5 w-16 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* File grid */}
          {(attachments.length > 0 || uploading.length > 0) && (
            <div className="p-3 space-y-2">
              {/* Existing attachments */}
              {attachments.map((att) => {
                const Icon = getFileIcon(att.mimeType);
                const color = getFileColor(att.mimeType);
                const isImg = isImage(att.mimeType);

                return (
                  <div
                    key={att.id}
                    className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm transition-all hover:border-gray-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-000"
                  >
                    {/* Thumbnail / icon — click to view */}
                    <button
                      type="button"
                      onClick={() => handleOpenAttachment(att)}
                      className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                      title={isImg ? "Click to view" : "Click to open"}
                    >
                      {isImg ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={att.url}
                            alt={att.fileName}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                            <LuMaximize2 className="h-4 w-4 text-white opacity-0 drop-shadow group-hover:opacity-100 transition-opacity" />
                          </div>
                        </>
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          <Icon className="h-5 w-5" style={{ color }} />
                        </div>
                      )}
                    </button>

                    {/* Info — click to open */}
                    <button
                      type="button"
                      onClick={() => handleOpenAttachment(att)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-gray-700 hover:text-brand-600 dark:text-gray-200 dark:hover:text-brand-400 transition-colors">
                        {att.fileName}
                      </p>
                      <p className="text-xs text-gray-400">{formatBytes(att.fileSize)}</p>
                    </button>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void triggerDownload(att.url, att.fileName); }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                        title="Download"
                      >
                        <LuDownload className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(att)}
                        disabled={deletingId === att.id}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400 disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === att.id ? (
                          <LuLoader className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LuTrash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Uploading files */}
              {uploading.map((u) => {
                const Icon = getFileIcon(u.mimeType);
                const color = getFileColor(u.mimeType);
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-2.5 dark:border-brand-900 dark:bg-brand-950/30"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${color}18` }}
                    >
                      <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{u.name}</p>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all duration-300"
                          style={{ width: `${u.progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {u.progress < 30 ? "Preparing…" : u.progress < 80 ? "Uploading…" : "Saving…"}
                      </p>
                    </div>
                    <LuLoader className="h-4 w-4 shrink-0 animate-spin text-brand-400" />
                  </div>
                );
              })}

              {/* Drag overlay when files already exist */}
              {dragOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-brand-500/10 backdrop-blur-[1px]">
                  <LuUpload className="h-8 w-8 text-brand-500" />
                  <p className="mt-2 text-sm font-semibold text-brand-600 dark:text-brand-400">Drop to upload</p>
                </div>
              )}

              {/* Add more */}
              {!dragOver && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-2.5 text-xs text-gray-400 transition-colors hover:border-brand-300 hover:text-brand-500 dark:border-gray-700 dark:hover:border-gray-000 dark:hover:text-brand-400"
                >
                  <LuX className="h-3 w-3 rotate-45" />
                  Add more files
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
