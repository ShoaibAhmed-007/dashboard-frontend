"use client";

import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useChatbotUiStore } from "@/stores/chatbotUi.store";
import { queryKeys } from "@/queries/keys";
import {
  aiConversationsService,
  type AiConversationSummary,
  type AiConversationDetail,
  type AiConversationMessage,
  type AiMessageRole,
  type AiMessageStatus,
} from "@/services/aiConversations.service";
import type { ChatMessageAttachment } from "@/services/chatAttachment.service";

export type { ChatMessageAttachment };

export interface ChatMessage {
  id: string;
  role: AiMessageRole;
  content: string;
  status?: AiMessageStatus;
  createdAt: string;
  attachments?: ChatMessageAttachment[];
}

export interface ChatConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatConversation extends ChatConversationSummary {
  messages: ChatMessage[];
}

const DEFAULT_TITLE = "New chat";
const TITLE_MAX_LENGTH = 40;

function isNotFound(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 404;
}

export function deriveTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, TITLE_MAX_LENGTH)}…`;
}

function toChatConversation(c: AiConversationSummary): ChatConversationSummary {
  return { id: c.id, title: c.title ?? DEFAULT_TITLE, createdAt: c.createdAt, updatedAt: c.updatedAt };
}

function toChatConversationDetail(c: AiConversationDetail): ChatConversation {
  return { ...toChatConversation(c), messages: c.messages };
}

export function useChatConversations() {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();
  const listKey = queryKeys.aiConversations(workspaceId);

  const activeConversationId = useChatbotUiStore((s) => s.activeConversationId);
  const setActiveConversationId = useChatbotUiStore((s) => s.setActiveConversationId);

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: aiConversationsService.list,
    enabled: !!workspaceId,
  });

  const detailKey = queryKeys.aiConversation(workspaceId, activeConversationId);
  const detailQuery = useQuery({
    queryKey: detailKey,
    queryFn: () => aiConversationsService.get(activeConversationId!),
    enabled: !!workspaceId && !!activeConversationId,
    retry: (failureCount, err) => (isNotFound(err) ? false : failureCount < 3),
  });

  // Recover from a stale/invalid activeConversationId — e.g. left over in
  // localStorage from a different backend/environment or a since-deleted
  // conversation — instead of getting permanently stuck failing to send.
  useEffect(() => {
    if (detailQuery.isError && isNotFound(detailQuery.error)) {
      setActiveConversationId(null);
    }
  }, [detailQuery.isError, detailQuery.error, setActiveConversationId]);

  const conversations: ChatConversationSummary[] = (listQuery.data ?? [])
    .map(toChatConversation)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const activeConversation = detailQuery.data ? toChatConversationDetail(detailQuery.data) : undefined;

  const createConversation = useCallback(async (): Promise<string> => {
    const summary = await aiConversationsService.create();
    queryClient.setQueryData<AiConversationSummary[]>(listKey, (prev) => [summary, ...(prev ?? [])]);
    queryClient.setQueryData<AiConversationDetail>(
      queryKeys.aiConversation(workspaceId, summary.id),
      { ...summary, messages: [] }
    );
    setActiveConversationId(summary.id);
    return summary.id;
  }, [queryClient, listKey, workspaceId, setActiveConversationId]);

  // Cache-only — shows a message immediately with no network call. Used for
  // the first token of a streamed assistant reply, where content isn't final
  // yet and the backend's message table is append-only (no per-token PATCH).
  const insertLocalMessage = useCallback(
    (conversationId: string, message: ChatMessage) => {
      const key = queryKeys.aiConversation(workspaceId, conversationId);
      queryClient.setQueryData<AiConversationDetail>(key, (prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, { ...message, status: message.status ?? "complete" }],
              updatedAt: message.createdAt,
            }
          : prev
      );
      queryClient.setQueryData<AiConversationSummary[]>(listKey, (prev) =>
        prev
          ? prev.map((c) => (c.id === conversationId ? { ...c, updatedAt: message.createdAt } : c))
          : prev
      );
    },
    [queryClient, workspaceId, listKey]
  );

  // Network-only — persists a message that's already showing in the cache
  // (by id), then reconciles the client-generated id with the server's.
  const persistMessage = useCallback(
    async (
      conversationId: string,
      message: ChatMessage,
      options?: { title?: string }
    ): Promise<AiConversationMessage | undefined> => {
      const key = queryKeys.aiConversation(workspaceId, conversationId);
      try {
        const saved = await aiConversationsService.appendMessage(conversationId, {
          role: message.role,
          content: message.content,
          status: message.status,
          title: options?.title,
        });
        queryClient.setQueryData<AiConversationDetail>(key, (prev) =>
          prev
            ? { ...prev, messages: prev.messages.map((m) => (m.id === message.id ? { ...m, id: saved.id } : m)) }
            : prev
        );
        if (options?.title) {
          queryClient.setQueryData<AiConversationSummary[]>(listKey, (prev) =>
            prev?.map((c) => (c.id === conversationId && !c.title ? { ...c, title: options.title! } : c))
          );
        }
        return saved;
      } catch (err) {
        if (isNotFound(err)) {
          // The conversation this message belongs to doesn't exist on this
          // backend (stale id from another environment, or deleted elsewhere).
          setActiveConversationId(null);
          return undefined;
        }
        // Otherwise the message stays visible locally for this session even
        // though persistence failed; a later reload reflects the backend truth.
        return undefined;
      }
    },
    [queryClient, workspaceId, listKey, setActiveConversationId]
  );

  // Combo of the two above — for messages whose content is final the moment
  // they're created (e.g. a user's turn, or a non-streamed fallback message).
  const appendMessage = useCallback(
    async (conversationId: string, message: ChatMessage, options?: { title?: string }) => {
      insertLocalMessage(conversationId, message);
      return persistMessage(conversationId, message, options);
    },
    [insertLocalMessage, persistMessage]
  );

  const updateLastMessage = useCallback(
    (conversationId: string, content: string) => {
      const key = queryKeys.aiConversation(workspaceId, conversationId);
      queryClient.setQueryData<AiConversationDetail>(key, (prev) => {
        if (!prev || prev.messages.length === 0) return prev;
        const messages = [...prev.messages];
        messages[messages.length - 1] = { ...messages[messages.length - 1], content };
        return { ...prev, messages };
      });
    },
    [queryClient, workspaceId]
  );

  // Cache-only — patches the attachments on a specific message once they're
  // known (e.g. after a synchronous document-generation call resolves for a
  // message that was created moments earlier without any attachments yet).
  const setMessageAttachments = useCallback(
    (conversationId: string, messageId: string, attachments: ChatMessageAttachment[]) => {
      const key = queryKeys.aiConversation(workspaceId, conversationId);
      queryClient.setQueryData<AiConversationDetail>(key, (prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((m) => (m.id === messageId ? { ...m, attachments } : m)),
            }
          : prev
      );
    },
    [queryClient, workspaceId]
  );

  // Cache-only — merges `patch` onto one existing attachment within a
  // message (by id), rather than replacing the whole list. Used after
  // `confirm()` resolves for a user-uploaded attachment, once extraction
  // results (or a fresh signed url) are known, so the CURRENT turn's context
  // build can see them immediately without waiting for a refetch.
  const patchMessageAttachment = useCallback(
    (
      conversationId: string,
      messageId: string,
      attachmentId: string,
      patch: Partial<ChatMessageAttachment>
    ) => {
      const key = queryKeys.aiConversation(workspaceId, conversationId);
      queryClient.setQueryData<AiConversationDetail>(key, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.id !== messageId
              ? m
              : {
                  ...m,
                  attachments: m.attachments?.map((a) =>
                    a.id === attachmentId ? { ...a, ...patch } : a
                  ),
                }
          ),
        };
      });
    },
    [queryClient, workspaceId]
  );

  const removeLastMessage = useCallback(
    async (conversationId: string) => {
      const key = queryKeys.aiConversation(workspaceId, conversationId);
      const current = queryClient.getQueryData<AiConversationDetail>(key);
      const last = current?.messages[current.messages.length - 1];
      if (!last) return;

      queryClient.setQueryData<AiConversationDetail>(key, (prev) =>
        prev ? { ...prev, messages: prev.messages.slice(0, -1) } : prev
      );

      try {
        await aiConversationsService.removeMessage(conversationId, last.id);
      } catch {
        // Best-effort — if this fails, the stale message may reappear after a
        // hard refetch; acceptable for v1 rather than blocking the retry flow.
      }
    },
    [queryClient, workspaceId]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      queryClient.setQueryData<AiConversationSummary[]>(listKey, (prev) =>
        prev?.filter((c) => c.id !== id)
      );
      queryClient.removeQueries({ queryKey: queryKeys.aiConversation(workspaceId, id) });
      if (activeConversationId === id) setActiveConversationId(null);

      try {
        await aiConversationsService.remove(id);
      } catch {
        queryClient.invalidateQueries({ queryKey: listKey });
      }
    },
    [queryClient, listKey, workspaceId, activeConversationId, setActiveConversationId]
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      queryClient.setQueryData<AiConversationSummary[]>(listKey, (prev) =>
        prev?.map((c) => (c.id === id ? { ...c, title } : c))
      );
      queryClient.setQueryData<AiConversationDetail>(
        queryKeys.aiConversation(workspaceId, id),
        (prev) => (prev ? { ...prev, title } : prev)
      );

      try {
        await aiConversationsService.rename(id, title);
      } catch {
        queryClient.invalidateQueries({ queryKey: listKey });
      }
    },
    [queryClient, listKey, workspaceId]
  );

  return {
    conversations,
    activeConversationId,
    activeConversation,
    setActiveConversationId,
    createConversation,
    appendMessage,
    insertLocalMessage,
    persistMessage,
    updateLastMessage,
    setMessageAttachments,
    patchMessageAttachment,
    removeLastMessage,
    deleteConversation,
    renameConversation,
  };
}
