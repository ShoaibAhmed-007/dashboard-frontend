import { api, refreshSession, redirectToLogin } from "@/lib/api";
import { getAccessToken } from "@/stores/auth.store";

interface ApiWrapper<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface CommentAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface ReactionMember {
  id: string;
  userId: string;
  role: string;
  user?: { id: string; fullName: string; avatarUrl: string | null };
}

export interface CommentReaction {
  id: string;
  commentId: string;
  memberId: string;
  reactFace: string;
  createdAt: string;
  member?: ReactionMember;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  parentId: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  author: CommentAuthor;
  reactions: CommentReaction[];
}

export type SSEHandlers = {
  onInit: (comments: Comment[]) => void;
  onCreated: (comment: Comment) => void;
  onUpdated: (comment: Comment) => void;
  onDeleted: (deletedIds: string[]) => void;
  onReactionCreated: (commentId: string, reaction: CommentReaction) => void;
  onReactionUpdated: (commentId: string, reaction: CommentReaction) => void;
  onReactionDeleted: (commentId: string, reactionId: string) => void;
};

function unwrapSsePayload<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export const commentService = {
  createComment: (taskId: string, content: string, parentId?: string, mentionedUserIds?: string[]) =>
    api
      .post<ApiWrapper<Comment>>(`/tasks/${taskId}/comments`, { content, parentId, mentionedUserIds })
      .then((r) => r.data.data),

  updateComment: (commentId: string, content: string, mentionedUserIds?: string[]) =>
    api
      .put<ApiWrapper<Comment>>(`/comments/${commentId}`, { content, mentionedUserIds })
      .then((r) => r.data.data),

  deleteComment: (commentId: string) =>
    api.delete(`/comments/${commentId}`),

  addReaction: (commentId: string, reactFace: string) =>
    api
      .post<ApiWrapper<CommentReaction>>(`/comments/${commentId}/reactions`, { reactFace })
      .then((r) => r.data.data),

  patchReaction: (reactionId: string, reactFace: string) =>
    api
      .patch<ApiWrapper<CommentReaction>>(`/reactions/${reactionId}`, { reactFace })
      .then((r) => r.data.data),

  deleteReaction: (reactionId: string) =>
    api.delete(`/reactions/${reactionId}`),

  openStream: (taskId: string, workspaceId: string, handlers: SSEHandlers, signal: AbortSignal): void => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
    const url = `${baseUrl}/tasks/${taskId}/comments/stream`;

    const dispatch = (eventName: string, raw: string) => {
      try {
        const payload = unwrapSsePayload<unknown>(JSON.parse(raw));
        if (eventName === "comments:init") {
          if (Array.isArray(payload)) handlers.onInit(payload as Comment[]);
        } else if (eventName === "comment:created") {
          handlers.onCreated(payload as Comment);
        } else if (eventName === "comment:updated") {
          handlers.onUpdated(payload as Comment);
        } else if (eventName === "comment:deleted") {
          const p = payload as { id?: string; deletedIds?: string[] };
          handlers.onDeleted(p.deletedIds ?? (p.id ? [p.id] : []));
        } else if (eventName === "reaction:created") {
          const r = payload as CommentReaction & { commentId: string };
          handlers.onReactionCreated(r.commentId, r);
        } else if (eventName === "reaction:updated") {
          const r = payload as CommentReaction & { commentId: string };
          handlers.onReactionUpdated(r.commentId, r);
        } else if (eventName === "reaction:deleted") {
          const r = payload as { id: string; commentId: string };
          handlers.onReactionDeleted(r.commentId, r.id);
        }
      } catch (e) {
        console.warn("[CommentSSE] dispatch error:", e, "event:", eventName, "raw:", raw);
      }
    };

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
      });

    const connect = async (): Promise<"done" | "reconnect"> => {
      if (signal.aborted) return "done";

      // Read credentials fresh on every attempt so token refreshes are picked up.
      const token = getAccessToken() ?? "";
      if (!token || !workspaceId) return "reconnect";

      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-workspace-id": workspaceId,
            Accept: "text/event-stream",
          },
          signal,
        });

        // 401 = expired JWT — refresh before the retry loop re-reads the token.
        if (res.status === 401) {
          try {
            await refreshSession();
            return "reconnect";
          } catch {
            redirectToLogin();
            return "done";
          }
        }

        if (!res.ok || !res.body) {
          return "reconnect";
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        // Accumulate per-event fields; reset on blank-line boundary
        let currentEvent = "message";
        let currentData = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) return "reconnect";
          if (signal.aborted) return "done";

          buf += decoder.decode(value, { stream: true });
          const lines = buf.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              currentData += (currentData ? "\n" : "") + line.slice(5).trim();
            } else if (line === "") {
              // Blank line = end of event block
              if (currentData) {
                dispatch(currentEvent, currentData);
              }
              currentEvent = "message";
              currentData = "";
            }
          }
        }
      } catch (err) {
        if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return "done";
        console.warn("[CommentSSE] fetch error, will reconnect:", err);
        return "reconnect";
      }
    };

    const run = async () => {
      let delay = 1000;
      while (!signal.aborted) {
        const result = await connect();
        if (result === "done" || signal.aborted) break;
        await sleep(delay);
        delay = Math.min(delay * 2, 30_000);
      }
    };

    void run();
  },
};
