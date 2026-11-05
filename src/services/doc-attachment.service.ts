import { api } from "@/lib/api";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface DocAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  s3Key: string;
  url: string;        // presigned 15-min GET URL (from /attachments/docs/view)
  viewUrl?: string;   // alias some backends return
  expiresAt?: string;
  createdAt: string;
}

export const docAttachmentService = {
  presign: (payload: { docId: string; fileName: string; mimeType: string }) =>
    api
      .post<ApiWrapper<{ uploadUrl: string; s3Key: string; expiresAt: string }>>(
        "/attachments/presign",
        payload
      )
      .then((r) => r.data.data),

  uploadToS3: async (uploadUrl: string, file: File) => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
  },

  record: (payload: {
    docId: string;
    s3Key: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }) =>
    api
      .post<ApiWrapper<DocAttachment>>("/attachments/docs", payload)
      .then((r) => r.data.data),

  list: (docId: string) =>
    api
      .post<ApiWrapper<DocAttachment[]>>("/attachments/docs/view", { docId })
      .then((r) => r.data.data),

  delete: (docId: string, s3Key: string) =>
    api
      .delete<ApiWrapper<unknown>>("/attachments/docs", {
        data: { docId, s3Key },
      })
      .then((r) => r.data),

  /**
   * One-shot helper: presign → upload → record. Returns the recorded attachment.
   */
  /** Convenience: presign → S3 upload → record → return the recorded attachment. */
  upload: async (docId: string, file: File): Promise<DocAttachment> => {
    const presigned = await docAttachmentService.presign({
      docId,
      fileName: file.name,
      mimeType: file.type,
    });
    await docAttachmentService.uploadToS3(presigned.uploadUrl, file);
    return docAttachmentService.record({
      docId,
      s3Key: presigned.s3Key,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });
  },
};
