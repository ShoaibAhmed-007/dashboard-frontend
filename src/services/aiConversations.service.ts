import { api } from "@/lib/api";
import {
  chatAttachmentService,
  type ChatAttachment,
  type ChatMessageAttachment,
} from "@/services/chatAttachment.service";

export type AiMessageRole = "user" | "assistant";
export type AiMessageStatus = "complete" | "aborted";

export interface AiConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversationMessage {
  id: string;
  role: AiMessageRole;
  content: string;
  status: AiMessageStatus;
  createdAt: string;
  attachments?: ChatMessageAttachment[];
}

export interface AiConversationDetail extends AiConversationSummary {
  messages: AiConversationMessage[];
}

interface WireMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  status: "COMPLETE" | "ABORTED";
  createdAt: string;
}
interface WireConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}
interface WireConversationDetail extends WireConversationSummary {
  messages: WireMessage[];
}

function fromWireMessage(m: WireMessage): AiConversationMessage {
  return {
    id: m.id,
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
    status: m.status === "ABORTED" ? "aborted" : "complete",
    createdAt: m.createdAt,
  };
}

function toWireRole(role: AiMessageRole): "USER" | "ASSISTANT" {
  return role === "user" ? "USER" : "ASSISTANT";
}

function toWireStatus(status?: AiMessageStatus): "COMPLETE" | "ABORTED" | undefined {
  if (!status) return undefined;
  return status === "aborted" ? "ABORTED" : "COMPLETE";
}

export const aiConversationsService = {
  async list(): Promise<AiConversationSummary[]> {
    const { data } = await api.get<{ data: WireConversationSummary[] }>("/ai-conversations");
    return data.data;
  },

  async get(id: string): Promise<AiConversationDetail> {
    const [{ data }, attachments] = await Promise.all([
      api.get<{ data: WireConversationDetail }>(`/ai-conversations/${id}`),
      chatAttachmentService.listByConversation(id).catch(() => [] as ChatAttachment[]),
    ]);

    const attachmentsByMessageId = new Map<string, ChatAttachment[]>();
    for (const attachment of attachments) {
      if (!attachment.messageId) continue;
      const existing = attachmentsByMessageId.get(attachment.messageId);
      if (existing) existing.push(attachment);
      else attachmentsByMessageId.set(attachment.messageId, [attachment]);
    }

    return {
      ...data.data,
      messages: data.data.messages.map((m) => ({
        ...fromWireMessage(m),
        attachments: attachmentsByMessageId.get(m.id) ?? [],
      })),
    };
  },

  async create(title?: string): Promise<AiConversationSummary> {
    const { data } = await api.post<{ data: WireConversationSummary }>("/ai-conversations", {
      title,
    });
    return data.data;
  },

  async rename(id: string, title: string): Promise<AiConversationSummary> {
    const { data } = await api.patch<{ data: WireConversationSummary }>(
      `/ai-conversations/${id}`,
      { title }
    );
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/ai-conversations/${id}`);
  },

  async appendMessage(
    conversationId: string,
    message: { role: AiMessageRole; content: string; status?: AiMessageStatus; title?: string }
  ): Promise<AiConversationMessage> {
    const { data } = await api.post<{ data: WireMessage }>(
      `/ai-conversations/${conversationId}/messages`,
      {
        role: toWireRole(message.role),
        content: message.content,
        status: toWireStatus(message.status),
        title: message.title,
      }
    );
    return fromWireMessage(data.data);
  },

  async removeMessage(conversationId: string, messageId: string): Promise<void> {
    await api.delete(`/ai-conversations/${conversationId}/messages/${messageId}`);
  },
};
