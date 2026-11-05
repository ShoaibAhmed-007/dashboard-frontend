import { api } from "@/lib/api";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  s3Key: string;
  fileSize: number;
  url: string;
  expiresAt: string;
}

export const attachmentService = {
  presign: (payload: { mimeType: string; fileName: string; taskId: string }) =>
    api
      .post<ApiWrapper<{ uploadUrl: string; s3Key: string; expiresAt: string }>>(
        "/attachments/presign",
        payload
      )
      .then((r) => r.data.data),

  record: (payload: {
    taskId: string;
    memberId: string;
    s3Key: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }) =>
    api
      .post<ApiWrapper<{ id: string; s3Key: string; fileName: string; mimeType: string; fileSize: number; createdAt: string }>>(
        "/attachments",
        payload
      )
      .then((r) => r.data.data),

  list: (taskId: string, memberId: string) =>
    api
      .post<ApiWrapper<Attachment[]>>("/attachments/view", { taskId, memberId })
      .then((r) => r.data.data),

  delete: (taskId: string, memberId: string, s3Key: string) =>
    api
      .delete<ApiWrapper<{ id: string; s3Key: string }>>("/attachments", {
        data: { taskId, memberId, s3Key },
      })
      .then((r) => r.data.data),
};
