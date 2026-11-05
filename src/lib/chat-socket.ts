import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/stores/auth.store";
import { refreshSession, redirectToLogin } from "@/lib/api";
import { toast } from "sonner";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v\d+\/?$/, "") ??
  "http://localhost:3000";

let socket: Socket | null = null;
// Guards against retrying a refresh-driven reconnect more than once per
// auth failure — if the refresh token is also expired, give up immediately
// instead of looping.
let authRetryInFlight = false;

// On a JWT auth failure, refresh the access token via the same single-flight
// refreshSession() the main api client uses, then reconnect with it. Falls
// back to the caller-provided behavior (toast/redirect) if refresh fails.
async function refreshAndReconnect(onFailure: () => void) {
  if (authRetryInFlight || !socket) {
    onFailure();
    return;
  }
  authRetryInFlight = true;
  try {
    const { accessToken } = await refreshSession();
    socket.auth = { token: accessToken };
    socket.connect();
  } catch {
    redirectToLogin();
  } finally {
    authRetryInFlight = false;
  }
}

function isAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("jwt") || m.includes("unauthorized") || m.includes("token");
}

export function getChatSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.auth = { token: getAccessToken() };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(`${WS_BASE}/chat`, {
    auth: { token: getAccessToken() },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect_error", (err) => {
    console.error("[chat-socket] connect_error:", err.message);
    if (isAuthError(err.message)) {
      refreshAndReconnect(() => {});
    }
  });

  // Server emits chat:error on JWT failure then disconnects
  socket.on("chat:error", ({ reason }: { reason: string }) => {
    console.error("[chat-socket] server error:", reason);
    refreshAndReconnect(() => toast.error(`Chat connection error: ${reason}`));
  });

  // Catch WS-level errors (e.g. typing rate limit: "Too many typing events. Please slow down.")
  socket.on("error", (err: Error | string) => {
    const msg = typeof err === "string" ? err : err?.message ?? "Socket error";
    if (msg.toLowerCase().includes("typing")) {
      toast.error("Too many typing events. Please slow down.");
    } else {
      console.error("[chat-socket] error:", msg);
    }
  });

  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
