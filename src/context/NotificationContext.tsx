"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { notificationService } from "@/services/notification.service";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";
import { useChatStore } from "@/stores/chat.store";
import { useTaskStore } from "@/stores/task.store";
import { Notification, resolveNotificationRoute } from "@/types/notification";
import { notificationIconFor } from "@/lib/notification-icon";

interface NotificationContextValue {
  notifications: Notification[];
  replies: Notification[];
  assignedComments: Notification[];
  unreadCount: number;
  isLoading: boolean;
  memberName: (userId: string) => string;
  clearNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  snoozeNotification: (id: string, until?: string) => Promise<void>;
  unsnoozeNotification: (id: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markUnread: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function isPrimaryNotification(item: Notification): boolean {
  return !item.isCleared && !item.isSnoozed;
}

/**
 * Chat notifications carry the message id, never the room's, so the room has
 * to be found from the message already in the chat store (the socket delivers
 * it alongside the notification). Returns null when the message is not held
 * locally — a room whose history has never been opened — and the caller then
 * links to Chat itself.
 */
function findChannelIdForMessage(messageId: string | null): string | null {
  if (!messageId) return null;
  const { messagesByChannel } = useChatStore.getState();
  for (const [channelId, messages] of Object.entries(messagesByChannel)) {
    if (messages.some((m) => m.id === messageId)) return channelId;
  }
  return null;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { members: storeMembers } = useWorkspaceMembers();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const notificationsRef = useRef(notifications);
  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);
  const { showNotification } = useSystemNotifications();

  const memberMap = useMemo(
    () => new Map(storeMembers.map((m) => [m.id, m.fullName])),
    [storeMembers]
  );

  // Refs so SSE closure always reads the latest values without needing to restart the stream
  const memberMapRef = useRef(memberMap);
  useEffect(() => { memberMapRef.current = memberMap; }, [memberMap]);
  const showNotificationRef = useRef(showNotification);
  useEffect(() => { showNotificationRef.current = showNotification; }, [showNotification]);
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  /**
   * Live banner for a freshly-created notification — an in-app toast
   * (always) plus a native OS notification when the tab isn't visible. Chat
   * gets its own presentation (sender's name as the title, resolves the
   * room from the chat store since the fanout carries no channelId); every
   * other type — including the IT-management ones (asset/company_employee/
   * it_bill/it_request) — falls through to a generic banner keyed off the
   * notification's own title/message, with a "View" action wherever the
   * target is resolvable (an open task, or `resolveNotificationRoute`).
   * Wrapped in `useCallback` with no deps — it only ever reads through
   * refs, so its identity can stay stable and the SSE effect below doesn't
   * need to list it as a dependency.
   */
  const showLiveToast = useCallback((item: Notification) => {
    const Icon = notificationIconFor(item.type, item.referenceType);
    const icon = <Icon className="h-4 w-4" />;

    const isChatNotif = item.type === "chat:message" || item.type === "chat:mention";
    if (isChatNotif) {
      const senderName = memberMapRef.current.get(item.actorId ?? "") || "Someone";
      const body = item.message ?? item.title;
      /* `referenceId` is the *message* id, not the room's — the fanout
         sends no channelId. The socket has already put that message in the
         store, so the room is resolved from there; failing that the link
         falls back to Chat itself rather than a URL that cannot resolve.
         (It previously pointed at /messages/:id and /channels/:id, both of
         which were removed with the old chat surface.) */
      const channelId = findChannelIdForMessage(item.referenceId);
      const channelPath = channelId ? `/workspace-chat?channel=${channelId}` : "/workspace-chat";

      toast(senderName, {
        description: body,
        duration: 5000,
        position: "bottom-right",
        icon,
        action: { label: "View", onClick: () => routerRef.current.push(channelPath) },
      });

      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        showNotificationRef.current(senderName, { body, tag: item.id });
      }
      return;
    }

    const onView = item.taskId
      ? () => { void useTaskStore.getState().openTaskDetail(item.taskId as string); }
      : (() => {
          const route = resolveNotificationRoute(item.referenceType, item.referenceId);
          return route ? () => routerRef.current.push(route) : null;
        })();

    toast(item.title, {
      description: item.message ?? undefined,
      duration: 5000,
      position: "bottom-right",
      icon,
      action: onView ? { label: "View", onClick: onView } : undefined,
    });

    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      showNotificationRef.current(item.title, { body: item.message ?? undefined, tag: item.id });
    }
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!isAuthenticated || !userId || !activeWorkspaceId) return;

    setIsLoading(true);
    const ctrl = new AbortController();

    // Safety net: if onInit hasn't fired within 8 s (e.g. first attempt failed
    // and reconnect is in progress), stop showing the loading spinner so the
    // inbox renders with whatever data is available.
    const loadingTimeout = setTimeout(() => setIsLoading(false), 8_000);

    notificationService.openStream(
      user.id,
      {
        onInit: (items) => {
          clearTimeout(loadingTimeout);
          setNotifications(items.filter(isPrimaryNotification));
          setIsLoading(false);
        },
        onCreated: (item) => {
          if (!isPrimaryNotification(item)) return;
          setNotifications((prev) => [item, ...prev]);
          showLiveToast(item);
        },
        onUpdated: (item) => {
          if (!isPrimaryNotification(item)) {
            // Cleared or snoozed — remove from primary list
            setNotifications((prev) => prev.filter((n) => n.id !== item.id));
          } else {
            setNotifications((prev) => {
              const exists = prev.some((n) => n.id === item.id);
              if (exists) {
                // Already in list — update in place
                return prev.map((n) => (n.id === item.id ? { ...n, ...item } : n));
              }
              // Was cleared/snoozed before — prepend back to primary
              return [item, ...prev];
            });
          }
        },
      },
      ctrl.signal
    );

    return () => {
      clearTimeout(loadingTimeout);
      /* Bare abort(), matching every other abort site in the app. Passing a
         reason makes the dev overlay surface that reason as an uncaught error
         instead of staying quiet — the stream treats any abort as a clean
         stop either way, so the reason bought nothing. */
      ctrl.abort();
    };
  }, [isAuthenticated, user?.id, activeWorkspaceId, showLiveToast]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const replies = useMemo(
    () => notifications.filter((n) => n.type === "comment:reply"),
    [notifications]
  );

  const assignedComments = useMemo(
    () => notifications.filter((n) => n.type === "mentioned"),
    [notifications]
  );

  const memberName = useCallback((userId: string): string => {
    return memberMap.get(userId) ?? userId;
  }, [memberMap]);

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationService.patchRead(id, true);
    } catch {
      toast.error("Failed to mark notification as read");
    }
  }, []);

  const markUnread = useCallback(async (id: string) => {
    try {
      await notificationService.patchRead(id, false);
    } catch {
      toast.error("Failed to mark notification as unread");
    }
  }, []);

  const clearNotification = useCallback(async (id: string) => {
    try {
      await notificationService.patchClear(id, true);
    } catch {
      toast.error("Failed to clear notification");
    }
  }, []);

  const clearAll = useCallback(async () => {
    const ids = notificationsRef.current.map((n) => n.id);
    if (!ids.length) return;
    const results = await Promise.allSettled(
      ids.map((id) => notificationService.patchClear(id, true))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) toast.error(`Failed to clear ${failed} notification(s)`);
  }, []);

  const snoozeNotification = useCallback(async (id: string, until?: string) => {
    try {
      await notificationService.patchSnooze(id, true, until);
    } catch {
      toast.error("Failed to snooze notification");
    }
  }, []);

  const unsnoozeNotification = useCallback(async (id: string) => {
    try {
      await notificationService.patchSnooze(id, false);
    } catch {
      toast.error("Failed to unsnooze notification");
    }
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      replies,
      assignedComments,
      unreadCount,
      isLoading,
      memberName,
      clearNotification,
      clearAll,
      snoozeNotification,
      unsnoozeNotification,
      markRead,
      markUnread,
    }),
    [
      notifications,
      replies,
      assignedComments,
      unreadCount,
      isLoading,
      memberName,
      clearNotification,
      clearAll,
      snoozeNotification,
      unsnoozeNotification,
      markRead,
      markUnread,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}

/** Same context, without the throw — for shared components (e.g. `AppHeader`)
 *  that render across layouts which don't all mount `NotificationProvider`
 *  (the University portal deliberately skips it, same as it skips
 *  Project/TaskList/Docs — see the comment in `AdminLayoutClient`). Returns
 *  `null` outside the provider instead of crashing the whole layout. */
export function useNotificationsOptional(): NotificationContextValue | null {
  return useContext(NotificationContext);
}
