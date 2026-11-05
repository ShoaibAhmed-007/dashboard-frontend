import { api } from "@/lib/api";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export type ProjectAttachmentUploader = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export type ProjectFileAttachment = {
  id: string;
  kind: "FILE";
  title: string | null;
  description: string | null;
  uploadedBy: ProjectAttachmentUploader;
  createdAt: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  viewUrl: string;
};

export type ProjectLinkAttachment = {
  id: string;
  kind: "LINK";
  title: string | null;
  description: string | null;
  uploadedBy: ProjectAttachmentUploader;
  createdAt: string;
  linkUrl: string;
};

export type ProjectAttachment = ProjectFileAttachment | ProjectLinkAttachment;

export type ProjectAttachmentListResponse = {
  items: ProjectAttachment[];
  nextCursor: string | null;
  limit: number;
};

export type AttachmentKindFilter = "FILE" | "LINK";

export interface ListProjectAttachmentsParams {
  kind?: AttachmentKindFilter;
  uploadedBy?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface PresignPayload {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface PresignResponse {
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
  attachmentId: null;
}

export interface ConfirmPayload {
  s3Key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  title?: string;
  description?: string;
}

export interface CreateLinkPayload {
  linkUrl: string;
  title: string;
  description?: string;
}

export interface UpdateAttachmentPayload {
  title?: string | null;
  description?: string | null;
}

export const projectAttachmentService = {
  presign: (projectId: string, payload: PresignPayload) =>
    api
      .post<ApiWrapper<PresignResponse>>(
        `/projects/${projectId}/attachments/presign`,
        payload
      )
      .then((r) => r.data.data),

  confirm: (projectId: string, payload: ConfirmPayload) =>
    api
      .post<ApiWrapper<ProjectAttachment>>(
        `/projects/${projectId}/attachments/confirm`,
        payload
      )
      .then((r) => r.data.data),

  createLink: (projectId: string, payload: CreateLinkPayload) =>
    api
      .post<ApiWrapper<ProjectAttachment>>(
        `/projects/${projectId}/attachments/links`,
        payload
      )
      .then((r) => r.data.data),

  list: (projectId: string, params?: ListProjectAttachmentsParams) =>
    api
      .get<ApiWrapper<ProjectAttachmentListResponse>>(
        `/projects/${projectId}/attachments`,
        { params }
      )
      .then((r) => r.data.data),

  get: (projectId: string, attachmentId: string) =>
    api
      .get<ApiWrapper<ProjectAttachment>>(
        `/projects/${projectId}/attachments/${attachmentId}`
      )
      .then((r) => r.data.data),

  update: (projectId: string, attachmentId: string, payload: UpdateAttachmentPayload) =>
    api
      .patch<ApiWrapper<ProjectAttachment>>(
        `/projects/${projectId}/attachments/${attachmentId}`,
        payload
      )
      .then((r) => r.data.data),

  delete: (projectId: string, attachmentId: string) =>
    api
      .delete<ApiWrapper<{ id: string; s3Key: string | null }>>(
        `/projects/${projectId}/attachments/${attachmentId}`
      )
      .then((r) => r.data.data),
};
