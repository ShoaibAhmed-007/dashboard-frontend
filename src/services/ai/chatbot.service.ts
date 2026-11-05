import { getAccessToken } from "@/stores/auth.store";
import { getActiveWorkspaceId } from "@/stores/workspace.store";
import { AiHttpError } from "@/services/ai/http";
import { api } from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export type ChatCompletionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatCompletionMessage {
  role: "user" | "assistant" | "system";
  content: string | ChatCompletionContentPart[];
}

/** Final frame of a completion stream — usage attribution for the turn. */
export interface CompletionDone {
  messageId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number | null;
}

export interface ChatQuota {
  /** False for standard tier and for premium members with no allowance assigned. */
  metered: boolean;
  tokenLimit: number;
  consumedTokens: number;
  remainingTokens: number;
  percentUsed: number;
  resetsAt: string;
  exhausted: boolean;
  fallbackOptIn: boolean;
  band: "ok" | "warn" | "critical";
}

export interface ChatModelInfo {
  tier: "PREMIUM" | "STANDARD";
  model: string;
  quota: ChatQuota;
}

export const chatbotService = {
  /**
   * Which model this member's chats resolve to. Read from the server rather
   * than mapped locally — the premium model id is env-overridable, so a
   * frontend copy of that mapping would silently drift.
   */
  async getModelInfo(): Promise<ChatModelInfo> {
    const { data } = await api.get<{ data: ChatModelInfo }>("/ai-conversations/model-info");
    return data.data;
  },

  /**
   * Accepts the standard model for the rest of the period after the premium
   * allowance is exhausted. Cleared automatically on the weekly reset.
   */
  async optIntoFallback(): Promise<{ model: string }> {
    const { data } = await api.post<{ data: { model: string } }>(
      "/ai-conversations/quota/fallback-opt-in",
    );
    return data.data;
  },

  /**
   * Streams an assistant turn from the backend.
   *
   * The conversation history and the model both live server-side — the model is
   * chosen from the caller's workspace AI tier and cannot be set from here.
   * The backend persists the assistant message itself, so no follow-up write
   * is needed.
   */
  async streamCompletion(
    conversationId: string,
    onToken: (token: string) => void,
    signal?: AbortSignal
  ): Promise<CompletionDone | null> {
    const workspaceId = getActiveWorkspaceId();
    const res = await fetch(
      `${API_BASE}/ai-conversations/${conversationId}/completions`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken() ?? ""}`,
          ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
        },
        signal,
      }
    );

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      throw new AiHttpError(
        body?.message ?? `Chat request failed (${res.status})`,
        res.status
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done: CompletionDone | null = null;

    while (true) {
      const { done: streamEnded, value } = await reader.read();
      if (streamEnded) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line; keep any partial tail.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const isError = frame.includes("event: error");
        const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;

        const payload = JSON.parse(dataLine.slice(6));
        if (isError) throw new AiHttpError(payload.message ?? "Chat failed", 500);
        if (payload.delta) onToken(payload.delta);
        if (payload.done) done = payload.done;
      }
    }

    return done;
  },
};
