import { api } from "@/lib/api";

export type ChatAttachmentType =
  | "image"
  | "pdf"
  | "ppt"
  | "excel"
  | "csv"
  | "document"
  | "code"
  | "text"
  | "generated-image"
  | "generated-pdf"
  | "generated-ppt";

export type ExtractionStatus = "ok" | "unsupported" | "failed";

export interface ChatAttachment {
  id: string;
  conversationId: string;
  messageId: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  attachmentType: ChatAttachmentType;
  url: string | null;
  createdAt: string;
  /** Extracted plain text, present for non-image documents once confirmed. */
  extractedText?: string | null;
  extractionStatus?: ExtractionStatus | null;
}

export interface PresignChatAttachmentPayload {
  conversationId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  attachmentType: ChatAttachmentType;
}

export interface PresignChatAttachmentResult {
  attachmentId: string;
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

/**
 * UI-facing attachment shape shared by both server-fetched messages
 * (AiConversationMessage) and locally-composed ones (ChatMessage), so the
 * cache never mixes two incompatible attachment types.
 */
export interface ChatMessageAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  attachmentType: ChatAttachmentType;
  url?: string | null;
  /** Local blob preview shown before the signed `url` is known. */
  previewUrl?: string;
  status?: "uploading" | "ready" | "error";
  error?: string;
  extractedText?: string | null;
  extractionStatus?: ExtractionStatus | null;
}

export function inferAttachmentType(mimeType: string): ChatAttachmentType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "ppt";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "excel";
  if (mimeType === "text/csv" || mimeType === "application/csv") return "csv";
  if (mimeType.includes("word") || mimeType.includes("document") || mimeType === "application/rtf")
    return "document";
  if (mimeType === "text/plain" || mimeType === "text/markdown") return "text";
  return "code";
}

export const chatAttachmentService = {
  presign: (payload: PresignChatAttachmentPayload) =>
    api
      .post<{ data: PresignChatAttachmentResult }>("/ai-attachments/presign", payload)
      .then((r) => r.data.data),

  confirm: (id: string, payload?: { messageId?: string }) =>
    api
      .post<{ data: ChatAttachment }>(`/ai-attachments/${id}/confirm`, payload ?? {})
      .then((r) => r.data.data),

  get: (id: string) =>
    api.get<{ data: ChatAttachment }>(`/ai-attachments/${id}`).then((r) => r.data.data),

  listByConversation: (conversationId: string) =>
    api
      .get<{ data: ChatAttachment[] }>(`/ai-conversations/${conversationId}/attachments`)
      .then((r) => r.data.data),

  remove: (id: string) => api.delete(`/ai-attachments/${id}`),
};
