export interface Notification {
  id: string;
  userId?: string;
  type: string;
  title: string;
  message: string | null;
  referenceType: string;
  referenceId: string;
  taskId: string | null;
  taskName: string | null;
  commentId: string | null;
  commentName: string | null;
  actorId: string | null;
  isCommented: boolean;
  replyCommentId: string | null;
  repliedToCommentId: string | null;
  isRead: boolean;
  readAt?: string | null;
  isCleared: boolean;
  isSnoozed: boolean;
  snoozedAt: string | null;
  createdAt: string;
}

export type NotificationSSEHandlers = {
  onInit: (items: Notification[]) => void;
  onCreated: (item: Notification) => void;
  onUpdated: (item: Notification) => void;
};

/**
 * Where clicking a notification should navigate, built from `referenceType`
 * + `referenceId` per the IT Management integration doc (§8). Only Assets
 * has its own detail route (`/it-management/assets/:id`) — Company
 * Employees, IT Bills and IT Requests have no per-entity route today, so
 * those land on the entity's list screen instead. Returns `null` for
 * reference types this app has no route for (e.g. `comment`/`task`, which
 * the caller already handles separately via `taskId`).
 */
export function resolveNotificationRoute(referenceType: string, referenceId: string): string | null {
  switch (referenceType) {
    case "asset":
      return `/it-management/assets/${referenceId}`;
    case "company_employee":
      return "/it-management/employees";
    case "it_bill":
      return "/it-management/bills";
    case "it_request":
      return "/it-management/requests";
    default:
      return null;
  }
}
