"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuPaperclip,
  LuUpload,
  LuLink2,
  LuFile,
  LuFileImage,
  LuFileText,
  LuFileCode,
  LuFileVideo,
  LuFileAudio,
  LuTrash2,
  LuDownload,
  LuLoader,
  LuPencil,
  LuSearch,
  LuX,
  LuMaximize2,
  LuExternalLink,
  LuChevronDown,
} from "react-icons/lu";
import {
  projectAttachmentService,
  ProjectAttachment,
  ProjectFileAttachment,
  AttachmentKindFilter,
} from "@/services/project-attachment.service";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import AddLinkModal from "./AddLinkModal";
import EditAttachmentModal from "./EditAttachmentModal";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  progress: number;
  s3Key?: string;
  confirmFailed?: boolean;
}

interface ProjectAttachmentsProps {
  projectId: string;
  currentUserId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return LuFileImage;
  if (mimeType.startsWith("video/")) return LuFileVideo;
  if (mimeType.startsWith("audio/")) return LuFileAudio;
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("document")) return LuFileText;
  if (
    mimeType.includes("javascript") || mimeType.includes("typescript") ||
    mimeType.includes("json") || mimeType.includes("xml") ||
    mimeType.includes("html") || mimeType.includes("css")
  ) return LuFileCode;
  return LuFile;
}

function getFileColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "#8b5cf6";
  if (mimeType.startsWith("video/")) return "#ef4444";
  if (mimeType.startsWith("audio/")) return "#f59e0b";
  if (mimeType.includes("pdf")) return "#ef4444";
  if (mimeType.includes("word") || mimeType.includes("document")) return "#3b82f6";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "#22c55e";
  if (mimeType.includes("json") || mimeType.includes("javascript")) return "#f97316";
  return "#6b7280";
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

function ImageLightbox({ url, fileName, onClose }: { url: string; fileName: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={fileName} className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl" />
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

export default function ProjectAttachments({ projectId, currentUserId }: ProjectAttachmentsProps) {
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<ProjectFileAttachment | null>(null);
  const [editingAttachment, setEditingAttachment] = useState<ProjectAttachment | null>(null);
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<AttachmentKindFilter | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeSearch, setActiveSearch] = useState("");

  const fetchAttachments = useCallback(async (opts?: { cursor?: string; reset?: boolean }) => {
    const isLoadMore = !!opts?.cursor;
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const result = await projectAttachmentService.list(projectId, {
        kind: kindFilter,
        q: activeSearch || undefined,
        cursor: opts?.cursor,
        limit: 30,
      });
      if (isLoadMore) {
        setAttachments((prev) => [...prev, ...result.items]);
      } else {
        setAttachments(result.items);
      }
      setNextCursor(result.nextCursor);
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  }, [projectId, kindFilter, activeSearch]);

  useEffect(() => {
    void fetchAttachments({ reset: true });
  }, [fetchAttachments]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setActiveSearch(value);
    }, 350);
  };

  const handleKindFilter = (kind: AttachmentKindFilter | undefined) => {
    setKindFilter(kind);
  };

  // ── File Upload ────────────────────────────────────────────────────────────
  const uploadFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`"${file.name}" exceeds the 50 MB limit`);
      return;
    }

    const uploadId = `${Date.now()}-${Math.random()}`;
    const mimeType = file.type || "application/octet-stream";
    setUploading((prev) => [...prev, { id: uploadId, name: file.name, size: file.size, mimeType, progress: 0 }]);

    try {
      // Step 1: presign
      setUploading((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: 15 } : u)));
      const { uploadUrl, s3Key } = await projectAttachmentService.presign(projectId, {
        fileName: file.name,
        mimeType,
        fileSize: file.size,
      });

      setUploading((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: 30, s3Key } : u)));

      // Step 2: PUT directly to S3 (no app auth headers)
      const s3Res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: file,
      });

      if (!s3Res.ok) throw new Error("S3 upload failed");

      setUploading((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: 75 } : u)));

      // Step 3: confirm
      await projectAttachmentService.confirm(projectId, {
        s3Key,
        fileName: file.name,
        mimeType,
        fileSize: file.size,
      });

      setUploading((prev) => prev.filter((u) => u.id !== uploadId));
      toast.success(`"${file.name}" uploaded`);
      void fetchAttachments({ reset: true });
    } catch (err) {
      // If confirm failed after S3 success, mark for retry
      setUploading((prev) =>
        prev.map((u) =>
          u.id === uploadId ? { ...u, progress: 0, confirmFailed: true } : u
        )
      );
      toast.error(parseApiError(err).message || `Failed to upload "${file.name}"`);
    }
  };

  const retryConfirm = async (u: UploadingFile) => {
    if (!u.s3Key) return;
    setUploading((prev) => prev.map((x) => (x.id === u.id ? { ...x, confirmFailed: false, progress: 75 } : x)));
    try {
      await projectAttachmentService.confirm(projectId, {
        s3Key: u.s3Key,
        fileName: u.name,
        mimeType: u.mimeType,
        fileSize: u.size,
      });
      setUploading((prev) => prev.filter((x) => x.id !== u.id));
      toast.success(`"${u.name}" saved`);
      void fetchAttachments({ reset: true });
    } catch (err) {
      setUploading((prev) => prev.map((x) => (x.id === u.id ? { ...x, confirmFailed: true, progress: 0 } : x)));
      toast.error(parseApiError(err).message);
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

  // ── Link ──────────────────────────────────────────────────────────────────
  const handleAddLink = async (payload: { linkUrl: string; title: string; description?: string }) => {
    try {
      await projectAttachmentService.createLink(projectId, payload);
      toast.success("Link added");
      setAddLinkOpen(false);
      void fetchAttachments({ reset: true });
    } catch (err) {
      toast.error(parseApiError(err).message);
      throw err;
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleEdit = async (payload: { title: string | null; description: string | null }) => {
    if (!editingAttachment) return;
    try {
      const updated = await projectAttachmentService.update(projectId, editingAttachment.id, payload);
      setAttachments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      toast.success("Attachment updated");
      setEditingAttachment(null);
    } catch (err) {
      toast.error(parseApiError(err).message);
      throw err;
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (att: ProjectAttachment) => {
    setDeletingId(att.id);
    try {
      await projectAttachmentService.delete(projectId, att.id);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
      toast.success("Attachment deleted");
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenAttachment = (att: ProjectAttachment) => {
    if (att.kind === "FILE") {
      if (att.mimeType.startsWith("image/")) {
        setViewingImage(att);
      } else {
        window.open(att.viewUrl, "_blank", "noreferrer");
      }
    } else {
      window.open(att.linkUrl, "_blank", "noreferrer noopener");
    }
  };

  const isEmpty = !loading && attachments.length === 0 && uploading.length === 0;

  return (
    <>
      {viewingImage && (
        <ImageLightbox
          url={viewingImage.viewUrl}
          fileName={viewingImage.fileName}
          onClose={() => setViewingImage(null)}
        />
      )}

      <AddLinkModal
        isOpen={addLinkOpen}
        onClose={() => setAddLinkOpen(false)}
        onSubmit={handleAddLink}
      />

      <EditAttachmentModal
        isOpen={!!editingAttachment}
        onClose={() => setEditingAttachment(null)}
        attachment={editingAttachment}
        onSubmit={handleEdit}
      />

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

      <div className="flex h-full flex-col">
        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search attachments…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors
                dark:border-gray-700 dark:bg-gray-800 dark:text-white placeholder-gray-400
                focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setActiveSearch(""); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <LuX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Kind filter */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700 p-1">
            {([undefined, "FILE", "LINK"] as (AttachmentKindFilter | undefined)[]).map((k) => (
              <button
                key={k ?? "all"}
                type="button"
                onClick={() => handleKindFilter(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  kindFilter === k
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {k === undefined ? "All" : k === "FILE" ? "Files" : "Links"}
              </button>
            ))}
          </div>

          {/* <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAddLinkOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-brand-400 hover:text-brand-600 dark:hover:border-gray-000 dark:hover:text-brand-400 transition-colors"
            >
              <LuLink2 className="h-3.5 w-3.5" />
              Add Link
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-medium text-white dark:bg-gray-000 dark:text-black hover:bg-brand-600 transition-colors dark:hover:bg-gray-200"
            >
              <LuUpload className="h-3.5 w-3.5" />
              Upload File
            </button>
          </div> */}
        </div>

        {/* ── Drop zone + content ──────────────────────────────────────── */}
        <div
          className="flex-1"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {dragOver && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-500/10 backdrop-blur-[2px] pointer-events-none">
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-400 bg-white/80 dark:bg-gray-900/80 px-12 py-10 shadow-2xl">
                <LuUpload className="h-10 w-10 text-brand-500" />
                <p className="text-base font-semibold text-brand-600 dark:text-brand-400">Drop files to upload</p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 animate-pulse">
                  <div className="h-12 w-12 rounded-xl bg-gray-200 dark:bg-gray-700 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-brand-50 to-brand-100 dark:from-brand-950 dark:to-brand-900">
                <LuPaperclip className="h-7 w-7 text-brand-500 dark:text-brand-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">No attachments yet</h3>
              <p className="mt-1.5 max-w-xs text-sm text-gray-400">
                Upload files or add external links to keep resources organized in this project.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white dark:bg-gray-000 dark:text-black hover:bg-brand-600 transition-colors dark:hover:bg-gray-200"
                >
                  <LuUpload className="h-4 w-4" />
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setAddLinkOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600  dark:text-gray-300 hover:border-brand-400 dark:hover:border-gray-000 hover:text-brand-600 transition-colors"
                >
                  <LuLink2 className="h-4 w-4" />
                  Add Link
                </button>
              </div>
              <p className="mt-4 text-xs text-gray-400">Or drag and drop files anywhere on this page</p>
            </div>
          )}

          {/* Attachment list */}
          {!loading && (attachments.length > 0 || uploading.length > 0) && (
            <div className="space-y-2">
              {/* Uploading files */}
              {uploading.map((u) => {
                const Icon = getFileIcon(u.mimeType);
                const color = getFileColor(u.mimeType);
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-4 rounded-2xl border border-brand-100 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/30 p-4"
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${color}18` }}
                    >
                      <Icon className="h-6 w-6" style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{u.name}</p>
                      <p className="text-xs text-gray-400">{formatBytes(u.size)}</p>
                      {!u.confirmFailed && (
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full bg-brand-500 transition-all duration-300"
                            style={{ width: `${u.progress}%` }}
                          />
                        </div>
                      )}
                      {!u.confirmFailed && (
                        <p className="mt-1 text-[11px] text-gray-400">
                          {u.progress < 30 ? "Preparing…" : u.progress < 75 ? "Uploading…" : "Saving…"}
                        </p>
                      )}
                      {u.confirmFailed && (
                        <p className="mt-1 text-[11px] text-red-500">Failed to save. <button type="button" onClick={() => void retryConfirm(u)} className="underline hover:no-underline">Retry</button></p>
                      )}
                    </div>
                    <LuLoader className="h-4 w-4 shrink-0 animate-spin text-brand-400" />
                  </div>
                );
              })}

              {/* Existing attachments */}
              {attachments.map((att) => {
                const isFile = att.kind === "FILE";
                const isImg = isFile && att.mimeType.startsWith("image/");
                const Icon = isFile ? getFileIcon(att.mimeType) : LuLink2;
                const color = isFile ? getFileColor(att.mimeType) : "#3b82f6";
                const displayName = att.title ?? (isFile ? att.fileName : att.linkUrl);

                return (
                  <div
                    key={att.id}
                    className="group flex items-center gap-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm transition-all hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-md"
                  >
                    {/* Thumbnail / icon */}
                    <button
                      type="button"
                      onClick={() => handleOpenAttachment(att)}
                      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
                      title={isImg ? "Click to view" : isFile ? "Click to open" : "Open link"}
                    >
                      {isImg ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={att.viewUrl} alt={att.fileName} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                            <LuMaximize2 className="h-4 w-4 text-white opacity-0 drop-shadow group-hover:opacity-100 transition-opacity" />
                          </div>
                        </>
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          <Icon className="h-6 w-6" style={{ color }} />
                        </div>
                      )}
                    </button>

                    {/* Info */}
                    <button
                      type="button"
                      onClick={() => handleOpenAttachment(att)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                        {displayName}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {isFile && (
                          <span className="text-xs text-gray-400">{att.fileName} · {formatBytes(att.fileSize)}</span>
                        )}
                        {!isFile && (
                          <span className="flex items-center gap-1 text-xs text-brand-500 dark:text-brand-400">
                            <LuExternalLink className="h-3 w-3" />
                            {att.linkUrl.length > 50 ? att.linkUrl.slice(0, 50) + "…" : att.linkUrl}
                          </span>
                        )}
                        {att.description && (
                          <span className="text-xs text-gray-400 truncate max-w-[200px]">{att.description}</span>
                        )}
                      </div>
                    </button>

                    {/* Uploader + date */}
                    <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{att.uploadedBy.name ?? "Unknown"}</p>
                      <p className="text-[11px] text-gray-400">{formatDate(att.createdAt)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setEditingAttachment(att)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title="Edit"
                      >
                        <LuPencil className="h-3.5 w-3.5" />
                      </button>
                      {isFile && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void triggerDownload(att.viewUrl, att.fileName); }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title="Download"
                        >
                          <LuDownload className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(att)}
                        disabled={deletingId === att.id}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
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

              {/* Load more */}
              {nextCursor && (
                <div className="flex justify-center pt-2 pb-4">
                  <button
                    type="button"
                    onClick={() => void fetchAttachments({ cursor: nextCursor })}
                    disabled={loadingMore}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600 transition-colors disabled:opacity-60"
                  >
                    {loadingMore ? <LuLoader className="h-4 w-4 animate-spin" /> : <LuChevronDown className="h-4 w-4" />}
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
