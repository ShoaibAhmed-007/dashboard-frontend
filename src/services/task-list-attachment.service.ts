import { api } from "@/lib/api";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export type TaskListAttachmentUploader = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export type TaskListFileAttachment = {
  id: string;
  kind: "FILE";
  title: string | null;
  description: string | null;
  uploadedBy: TaskListAttachmentUploader;
  createdAt: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  viewUrl: string;
};

export type TaskListLinkAttachment = {
  id: string;
  kind: "LINK";
  title: string | null;
  description: string | null;
  uploadedBy: TaskListAttachmentUploader;
  createdAt: string;
  linkUrl: string;
};

export type TaskListAttachment = TaskListFileAttachment | TaskListLinkAttachment;

export type TaskListAttachmentListResponse = {
  items: TaskListAttachment[];
  nextCursor: string | null;
  limit: number;
};

export interface ListTaskListAttachmentsParams {
  cursor?: string;
  limit?: number;
}

export interface TaskListPresignPayload {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface TaskListPresignResponse {
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
  attachmentId: null;
}

export interface TaskListConfirmPayload {
  s3Key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  title?: string;
  description?: string;
}

export interface TaskListCreateLinkPayload {
  linkUrl: string;
  title: string;
  description?: string;
}

export interface TaskListUpdateAttachmentPayload {
  title?: string | null;
  description?: string | null;
}

export const taskListAttachmentService = {
  presign: (listId: string, payload: TaskListPresignPayload) =>
    api
      .post<ApiWrapper<TaskListPresignResponse>>(
        `/task-lists/${listId}/attachments/presign`,
        payload
      )
      .then((r) => r.data.data),

  confirm: (listId: string, payload: TaskListConfirmPayload) =>
    api
      .post<ApiWrapper<TaskListAttachment>>(
        `/task-lists/${listId}/attachments/confirm`,
        payload
      )
      .then((r) => r.data.data),

  createLink: (listId: string, payload: TaskListCreateLinkPayload) =>
    api
      .post<ApiWrapper<TaskListAttachment>>(
        `/task-lists/${listId}/attachments/links`,
        payload
      )
      .then((r) => r.data.data),

  list: (listId: string, params?: ListTaskListAttachmentsParams) =>
    api
      .get<ApiWrapper<TaskListAttachmentListResponse>>(
        `/task-lists/${listId}/attachments`,
        { params }
      )
      .then((r) => r.data.data),

  get: (listId: string, attachmentId: string) =>
    api
      .get<ApiWrapper<TaskListAttachment>>(
        `/task-lists/${listId}/attachments/${attachmentId}`
      )
      .then((r) => r.data.data),

  update: (listId: string, attachmentId: string, payload: TaskListUpdateAttachmentPayload) =>
    api
      .patch<ApiWrapper<TaskListAttachment>>(
        `/task-lists/${listId}/attachments/${attachmentId}`,
        payload
      )
      .then((r) => r.data.data),

  delete: (listId: string, attachmentId: string) =>
    api
      .delete<ApiWrapper<{ id: string; s3Key: string | null }>>(
        `/task-lists/${listId}/attachments/${attachmentId}`
      )
      .then((r) => r.data.data),
};
