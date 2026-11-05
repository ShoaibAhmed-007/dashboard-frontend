"use client";

import ChatAttachmentCard from "@/components/chatbot/ChatAttachmentCard";
import type { ChatMessageAttachment } from "@/hooks/useChatConversations";

export default function ChatAttachmentList({
  attachments,
  onRegenerate,
  regenerating,
}: {
  attachments?: ChatMessageAttachment[];
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mb-1.5 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <ChatAttachmentCard
          key={attachment.id}
          attachment={attachment}
          onRegenerate={attachment.attachmentType === "generated-image" ? onRegenerate : undefined}
          regenerating={attachment.attachmentType === "generated-image" ? regenerating : undefined}
        />
      ))}
    </div>
  );
}
