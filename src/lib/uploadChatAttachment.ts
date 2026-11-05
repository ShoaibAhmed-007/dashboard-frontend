import {
  chatAttachmentService,
  inferAttachmentType,
  type ChatAttachmentType,
} from "@/services/chatAttachment.service";

export interface UploadChatAttachmentResult {
  attachmentId: string;
  s3Key: string;
}

export async function uploadChatAttachment(
  file: File,
  conversationId: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
  attachmentType?: ChatAttachmentType
): Promise<UploadChatAttachmentResult> {
  const mimeType = file.type || "application/octet-stream";

  const { attachmentId, uploadUrl, s3Key } = await chatAttachmentService.presign({
    conversationId,
    fileName: file.name,
    mimeType,
    fileSize: file.size,
    attachmentType: attachmentType ?? inferAttachmentType(mimeType),
  });

  await putToS3WithProgress(uploadUrl, file, mimeType, onProgress, signal);

  return { attachmentId, s3Key };
}

function putToS3WithProgress(
  url: string,
  file: File,
  mimeType: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mimeType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("S3 upload failed"));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort());
    }

    xhr.send(file);
  });
}
