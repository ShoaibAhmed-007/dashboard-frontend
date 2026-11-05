import {
  LuFile,
  LuFileImage,
  LuFileText,
  LuFileCode,
  LuFileVideo,
  LuFileAudio,
} from "react-icons/lu";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return LuFileImage;
  if (mimeType.startsWith("video/")) return LuFileVideo;
  if (mimeType.startsWith("audio/")) return LuFileAudio;
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("document"))
    return LuFileText;
  if (
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("html") ||
    mimeType.includes("css")
  )
    return LuFileCode;
  return LuFile;
}

export function getFileColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "#8b5cf6";
  if (mimeType.startsWith("video/")) return "#ef4444";
  if (mimeType.startsWith("audio/")) return "#f59e0b";
  if (mimeType.includes("pdf")) return "#ef4444";
  if (mimeType.includes("word") || mimeType.includes("document")) return "#3b82f6";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "#22c55e";
  if (mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("code"))
    return "#f97316";
  return "#6b7280";
}
