import { attachmentService, Attachment } from "@/services/attachment.service";

export async function uploadAttachment(
  file: File,
  taskId: string,
  userId: string
): Promise<Attachment> {
  const mimeType = file.type || "application/octet-stream";

  // Step 1: get presigned S3 URL
  const { uploadUrl, s3Key } = await attachmentService.presign({
    mimeType,
    fileName: file.name,
    taskId,
  });

  // Step 2: upload directly to S3
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": mimeType },
  });
  if (!uploadRes.ok) throw new Error("S3 upload failed");

  // Step 3: register in DB
  await attachmentService.record({
    taskId,
    memberId: userId,
    s3Key,
    fileName: file.name,
    mimeType,
    fileSize: file.size,
  });

  // Step 4: fetch fresh list to get the presigned view URL for this file
  const all = await attachmentService.list(taskId, userId);
  const recorded = all.find((a) => a.s3Key === s3Key);
  if (!recorded) throw new Error("Attachment not found after upload");
  return recorded;
}
