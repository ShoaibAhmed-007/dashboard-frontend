import type { ChatMessage } from "@/hooks/useChatConversations";
import type { ChatMessageAttachment } from "@/services/chatAttachment.service";
import type { ChatCompletionContentPart, ChatCompletionMessage } from "@/services/ai/chatbot.service";
import { chatAttachmentService } from "@/services/chatAttachment.service";

// Cumulative cap across the whole request — once exceeded, older documents
// degrade to a placeholder note instead of their full extracted text.
export const MAX_TOTAL_ATTACHMENT_CONTEXT_CHARS = 60_000;
// Older images beyond this count degrade to a text placeholder — keeps a
// long conversation from re-sending dozens of full images on every turn.
export const MAX_IMAGES_PER_REQUEST = 6;

function isImageAttachment(attachment: ChatMessageAttachment): boolean {
  return (
    attachment.mimeType.startsWith("image/") ||
    attachment.attachmentType === "image" ||
    attachment.attachmentType === "generated-image"
  );
}

function docContextNote(attachment: ChatMessageAttachment): string {
  if (attachment.extractionStatus === "unsupported") {
    return `Attached document "${attachment.fileName}": I can see you attached this file, but I can't read its contents (unsupported file type).`;
  }
  if (attachment.extractionStatus === "failed") {
    return `Attached document "${attachment.fileName}": I can see you attached this file, but couldn't read its contents.`;
  }
  if (!attachment.extractedText) {
    return `Attached document "${attachment.fileName}": (content not available).`;
  }
  return `Attached document "${attachment.fileName}":\n${attachment.extractedText}`;
}

// Images always need a URL OpenAI's servers can actually fetch — a local
// blob: preview URL only exists in this tab's memory, and even a
// previously-cached signed S3 URL may have expired (15 min TTL) by the time
// an older message is re-sent — so always ask the backend for a fresh one.
async function resolveImageUrl(attachment: ChatMessageAttachment): Promise<string | null> {
  try {
    const fresh = await chatAttachmentService.get(attachment.id);
    return fresh.url;
  } catch {
    return attachment.url ?? null;
  }
}

export async function buildApiMessages(messages: ChatMessage[]): Promise<ChatCompletionMessage[]> {
  let remainingCharBudget = MAX_TOTAL_ATTACHMENT_CONTEXT_CHARS;
  let remainingImageBudget = MAX_IMAGES_PER_REQUEST;

  // Walk newest-first so the caps are spent on the most recent context first,
  // then reverse back into chronological order before returning.
  const built: ChatCompletionMessage[] = [];

  for (const message of [...messages].reverse()) {
    const attachments = message.attachments ?? [];
    const images = attachments.filter(isImageAttachment);
    const docs = attachments.filter((a) => !isImageAttachment(a));

    for (const doc of docs) {
      if (remainingCharBudget <= 0) {
        built.push({
          role: "system",
          content: `Attached document "${doc.fileName}": (omitted — conversation context limit reached).`,
        });
        continue;
      }
      const note = docContextNote(doc);
      const clipped = note.length > remainingCharBudget ? note.slice(0, remainingCharBudget) : note;
      remainingCharBudget -= clipped.length;
      built.push({ role: "system", content: clipped });
    }

    const imageParts: ChatCompletionContentPart[] = [];
    for (const image of images) {
      if (remainingImageBudget <= 0) {
        imageParts.push({
          type: "text",
          text: `[Image attachment "${image.fileName}" omitted — too many images in this conversation]`,
        });
        continue;
      }
      const url = await resolveImageUrl(image);
      if (!url) {
        imageParts.push({ type: "text", text: `[Image attachment "${image.fileName}" could not be loaded]` });
        continue;
      }
      imageParts.push({ type: "image_url", image_url: { url } });
      remainingImageBudget -= 1;
    }

    if (imageParts.length > 0) {
      built.push({ role: message.role, content: [{ type: "text", text: message.content }, ...imageParts] });
    } else {
      built.push({ role: message.role, content: message.content });
    }
  }

  return built.reverse();
}
