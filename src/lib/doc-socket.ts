import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/stores/auth.store";
import { refreshSession, redirectToLogin } from "@/lib/api";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v\d+\/?$/, "") ??
  "http://localhost:3000";

let socket: Socket | null = null;
// Guards against retrying a refresh-driven reconnect more than once per
// auth failure — if the refresh token is also expired, give up immediately.
let authRetryInFlight = false;

// On a JWT auth failure, refresh the access token via the same single-flight
// refreshSession() the main api client uses, then reconnect with it.
async function refreshAndReconnect() {
  if (authRetryInFlight || !socket) return;
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

export function getDocSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    // Update auth before reconnecting in case token rotated
    socket.auth = { token: getAccessToken() };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(`${WS_BASE}/docs`, {
    auth: { token: getAccessToken() },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
  });

  socket.on("connect_error", (err) => {
     
    console.error("[doc-socket] connect_error:", err.message);
    if (isAuthError(err.message)) {
      refreshAndReconnect();
    }
  });

  socket.on("doc:error", ({ reason }: { reason: string }) => {
     
    console.error("[doc-socket] server error:", reason);
    refreshAndReconnect();
  });

  return socket;
}

export function disconnectDocSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
