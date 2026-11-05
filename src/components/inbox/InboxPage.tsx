"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuSettings2,
  LuCheck,
  LuClock,
  LuListFilter,
  LuMail,
  LuMailOpen,
} from "react-icons/lu";
import { toast } from "sonner";
import { useNotifications } from "@/context/NotificationContext";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useTaskStore } from "@/stores/task.store";
import { notificationService } from "@/services/notification.service";
import { taskService, TaskStatusInfo, TaskUserInfo } from "@/services/task.service";
import { Notification, resolveNotificationRoute } from "@/types/notification";
import StatusIcon from "@/components/projects/StatusIcon";
import SnoozePopover from "./SnoozePopover";
import UserAvatar from "@/components/ui/UserAvatar";
import { RiInbox2Fill } from "react-icons/ri";
import { IoCheckmarkOutline } from "react-icons/io5";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "primary" | "other" | "later" | "cleared";
type DateGroup = "Today" | "Yesterday" | "Last 7 days" | "Earlier this month";

interface TaskMeta {
  title: string;
  status: TaskStatusInfo;
  // keyed by userId
  users: Record<string, TaskUserInfo>;
}

const GROUP_ORDER: DateGroup[] = ["Today", "Yesterday", "Last 7 days", "Earlier this month"];

// ── Utilities ─────────────────────────────────────────────────────────────────
function getDateGroup(iso: string): DateGroup {
  const now = new Date();
  const date = new Date(iso);
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  if (date >= sevenDaysAgo) return "Last 7 days";
  return "Earlier this month";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatSnoozedUntil(iso: string | null): string {
  if (!iso) return "Indefinitely";
  const date = new Date(iso);
  return (
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " at " +
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

// ── Avatar helpers ─────────────────────────────────────────────────────────────
function hashColor(id: string): string {
  const colors = [
    "#6366f1","#8b5cf6","#ec4899","#f59e0b",
    "#10b981","#3b82f6","#ef4444","#14b8a6",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}


interface ActorAvatarProps {
  actorId: string | null;
  userInfo?: TaskUserInfo;
  size?: number;
}

function ActorAvatar({ actorId, userInfo, size = 28 }: ActorAvatarProps) {
  if (!actorId) return null;

  const name = userInfo?.fullName ?? "";
  const bg = userInfo?.avatarColor ?? hashColor(actorId);

  return (
    <UserAvatar
      name={name || "?"}
      avatarUrl={userInfo?.avatarUrl}
      size={size}
      color={bg}
    />
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ message = "Congratulations! You cleared your important notifications" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 h-full select-none">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-2xl bg-brand-100 dark:bg-brand-400 flex items-center justify-center">
          <svg className="w-12 h-12 text-brand-501" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
          </svg>
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 rounded-lg bg-brand-501 flex items-center justify-center shadow-md">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
            <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
          </svg>
        </div>
      </div>
      <h3 className="text-[18px] font-bold text-gray-800 dark:text-gray-100 mb-1">Inbox Zero</h3>
      <p className="text-sm text-gray-400">{message}</p>
      <div className="mt-10 flex flex-col items-center gap-3">
        <span className="text-[11px] font-normal uppercase tracking-widest text-gray-300 dark:text-gray-600 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-0.5">ClickTip</span>
        <p className="text-sm text-gray-500 text-center max-w-xs leading-relaxed">
          Create a Reminder on the fly by pressing &apos;R&apos;<br />anywhere in your Workspace!
        </p>
        <button className="text-xs font-normal text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Learn more
        </button>
      </div>
    </div>
  );
}

// ── Primary inbox row ─────────────────────────────────────────────────────────
interface PrimaryRowProps {
  item: Notification;
  isLast: boolean;
  taskMeta: TaskMeta | undefined;
  onClear: (id: string) => void;
  onSnooze: (id: string, until?: string) => void;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onRowClick: (item: Notification) => void;
}

function PrimaryRow({ item, isLast, taskMeta, onClear, onSnooze, onMarkRead, onMarkUnread, onRowClick }: PrimaryRowProps) {
  const [snoozeAnchor, setSnoozeAnchor] = useState<DOMRect | null>(null);
  const snoozeRef = useRef<HTMLButtonElement>(null);

  const handleSnoozeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (snoozeRef.current) setSnoozeAnchor(snoozeRef.current.getBoundingClientRect());
  };

  const actorInfo = item.actorId ? taskMeta?.users[item.actorId] : undefined;
  const taskTitle = taskMeta?.title ?? item.title;
  const taskStatus = taskMeta?.status;

  return (
    <>
      <div
        onClick={() => onRowClick(item)}
        className={`group flex items-center gap-3 mx-2 px-3 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-905 cursor-pointer transition-colors ${!isLast ? "border-b border-gray-100 dark:border-gray-800" : ""} ${item.isRead ? "opacity-70" : ""}`}
      >
        {/* Task status icon */}
        <div className="shrink-0 flex items-center justify-center w-5">
          {taskStatus ? (
            <StatusIcon
              group={taskStatus.group}
              color={taskStatus.group === "CLOSED" ? "#2a9764" : taskStatus.color}
              size={16}
            />
          ) : (
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
            </svg>
          )}
        </div>

        {/* Task title */}
        <p className={`w-64 shrink-0 text-sm truncate ${item.isRead ? "text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-100"}`}>
          {taskTitle}
        </p>

        {/* Actor: icon + name + action */}
        <div className="flex-1 flex items-center gap-1.5">
          <ActorAvatar actorId={item.actorId} userInfo={actorInfo} size={16} />
          {actorInfo?.fullName && (
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium">
              {actorInfo.fullName}
            </span>
          )}
          <span className="text-xs text-brand-500 truncate">{item.title}</span>
        </div>

        {/* Right col: date on idle, actions on hover */}
        <div className="relative flex items-center justify-end w-40 h-6 shrink-0">
          <div className="absolute inset-0 flex items-center justify-end group-hover:opacity-0 group-hover:pointer-events-none transition-opacity">
            <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(item.createdAt)}</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
            <button
              title={item.isRead ? "Mark unread" : "Mark read"}
              onClick={(e) => { e.stopPropagation(); item.isRead ? onMarkUnread(item.id) : onMarkRead(item.id); }}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {item.isRead ? <LuMail className="w-4 h-4" /> : <LuMailOpen className="w-4 h-4" />}
            </button>
            <button
              ref={snoozeRef}
              title="Snooze"
              onClick={handleSnoozeClick}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <LuClock className="w-4 h-4" />
            </button>
            <button
              title="Clear"
              onClick={(e) => { e.stopPropagation(); onClear(item.id); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-500 text-white text-xs hover:bg-brand-600 transition-colors"
            >
              <LuCheck className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {snoozeAnchor && (
        <SnoozePopover
          notificationId={item.id}
          anchorRect={snoozeAnchor}
          onClose={() => setSnoozeAnchor(null)}
          onSnooze={(id, until) => { onSnooze(id, until); setSnoozeAnchor(null); }}
        />
      )}
    </>
  );
}

// ── Later row (snoozed) ───────────────────────────────────────────────────────
interface LaterRowProps {
  item: Notification;
  isLast: boolean;
  taskMeta: TaskMeta | undefined;
  onUnsnooze: (id: string) => void;
}

function LaterRow({ item, isLast, taskMeta, onUnsnooze }: LaterRowProps) {
  const taskTitle = taskMeta?.title ?? item.title;
  const taskStatus = taskMeta?.status;
  const actorInfo = item.actorId ? taskMeta?.users[item.actorId] : undefined;

  return (
    <div className={`group flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-default transition-colors ${!isLast ? "border-b border-gray-100 dark:border-gray-800" : ""}`}>
      <div className="shrink-0 flex items-center justify-center w-5">
        {taskStatus ? (
          <StatusIcon group={taskStatus.group} color={taskStatus.group === "CLOSED" ? "#2a9764" : taskStatus.color} size={16} />
        ) : (
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          </svg>
        )}
      </div>
      <p className="w-64 shrink-0 text-sm text-gray-800 dark:text-gray-100 truncate">{taskTitle}</p>
      <div className="flex-1 flex items-center gap-1.5">
        <ActorAvatar actorId={item.actorId} userInfo={actorInfo} size={16} />
        {actorInfo?.fullName && (
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium">{actorInfo.fullName}</span>
        )}
        <span className="text-xs text-brand-500 truncate">Snoozed until {formatSnoozedUntil(item.snoozedAt)}</span>
      </div>
      <div className="relative flex items-center justify-end w-40 h-6 shrink-0">
        <div className="absolute inset-0 flex items-center justify-end group-hover:opacity-0 group-hover:pointer-events-none transition-opacity">
          <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(item.createdAt)}</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-end opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
          <button
            onClick={() => onUnsnooze(item.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <LuClock className="w-3.5 h-3.5" />
            Unsnooze
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cleared row ───────────────────────────────────────────────────────────────
interface ClearedRowProps {
  item: Notification;
  isLast: boolean;
  taskMeta: TaskMeta | undefined;
  onRestore: (id: string) => void;
}

function ClearedRow({ item, isLast, taskMeta, onRestore }: ClearedRowProps) {
  const taskTitle = taskMeta?.title ?? item.title;
  const taskStatus = taskMeta?.status;
  const actorInfo = item.actorId ? taskMeta?.users[item.actorId] : undefined;

  return (
    <div className={`group flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-default transition-colors opacity-60 ${!isLast ? "border-b border-gray-100 dark:border-gray-800" : ""}`}>
      <div className="shrink-0 flex items-center justify-center w-5">
        {taskStatus ? (
          <StatusIcon group={taskStatus.group} color={taskStatus.group === "CLOSED" ? "#2a9764" : taskStatus.color} size={16} />
        ) : (
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          </svg>
        )}
      </div>
      <p className="w-64 shrink-0 text-sm text-gray-800 dark:text-gray-100 truncate">{taskTitle}</p>
      <div className="flex-1 flex items-center gap-1.5">
        <ActorAvatar actorId={item.actorId} userInfo={actorInfo} size={16} />
        {actorInfo?.fullName && (
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium">{actorInfo.fullName}</span>
        )}
        <span className="text-xs text-brand-500 truncate">{item.title}</span>
      </div>
      <div className="relative flex items-center justify-end w-40 h-6 shrink-0">
        <div className="absolute inset-0 flex items-center justify-end group-hover:opacity-0 group-hover:pointer-events-none transition-opacity">
          <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(item.createdAt)}</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-end opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
          <button
            onClick={() => onRestore(item.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Move to inbox
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grouped list ──────────────────────────────────────────────────────────────
function GroupedList<T extends { createdAt: string }>({
  items,
  renderRow,
  headerExtra,
}: {
  items: T[];
  renderRow: (item: T, isLast: boolean) => React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  const grouped = GROUP_ORDER.reduce<Record<string, T[]>>((acc, g) => {
    acc[g] = [];
    return acc;
  }, {} as Record<string, T[]>);

  for (const item of items) {
    const g = getDateGroup(item.createdAt);
    grouped[g].push(item);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {headerExtra}
      {items.length === 0 && <EmptyState />}
      {GROUP_ORDER.map((group) => {
        const groupItems = grouped[group];
        if (!groupItems.length) return null;
        return (
          <div key={group}>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400 px-1">{group}</p>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
              {groupItems.map((item, idx) => renderRow(item, idx === groupItems.length - 1))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab config ────────────────────────────────────────────────────────────────
const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "primary", label: "Primary",
    icon: (
      <RiInbox2Fill className="w-4 h-4" />
    ),
  },
  {
    id: "other", label: "Other",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>

      // <svg className="w-4 h-4" fill _ngcontent-ng-c3229594917="" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" data-test="icon" class="svg ng-star-inserted"><use _ngcontent-ng-c3229594917="" href="#cu3-icon-activityView" xlink:href="#cu3-icon-activityView"></use></svg>


    ),
  },
  {
    id: "later", label: "Later",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "cleared", label: "Cleared",
    icon: (
      // <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      //   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      // </svg>
      <IoCheckmarkOutline className="w-4 h-4 " />
    ),
  },
];

// ── Main InboxPage ────────────────────────────────────────────────────────────
export default function InboxPage() {
  const { notifications, unreadCount, clearNotification, clearAll, snoozeNotification, unsnoozeNotification, markRead, markUnread } = useNotifications();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const openTaskDetail = useTaskStore((s) => s.openTaskDetail);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("primary");

  const [snoozed, setSnoozed] = useState<Notification[]>([]);
  const [cleared, setCleared] = useState<Notification[]>([]);
  const [laterLoaded, setLaterLoaded] = useState(false);
  const [clearedLoaded, setClearedLoaded] = useState(false);
  const [laterLoading, setLaterLoading] = useState(false);
  const [clearedLoading, setClearedLoading] = useState(false);
  const primaryNotifications = notifications.filter((item) => !item.isCleared && !item.isSnoozed);

  // taskId → TaskMeta cache
  const [taskMetaMap, setTaskMetaMap] = useState<Record<string, TaskMeta>>({});
  const fetchingRef = useRef<Set<string>>(new Set());
  const taskMetaMapRef = useRef(taskMetaMap);
  useEffect(() => { taskMetaMapRef.current = taskMetaMap; }, [taskMetaMap]);

  // Fetch task metadata for notifications that have a taskId.
  // taskMetaMap is read via ref to avoid adding it to deps (which would cause
  // an infinite loop: fetch → update map → re-run effect → fetch again).
  useEffect(() => {
    const allItems = [...notifications, ...snoozed, ...cleared];
    const needed = allItems
      .map((n) => n.taskId)
      .filter((id): id is string => !!id && !taskMetaMapRef.current[id] && !fetchingRef.current.has(id));

    const unique = [...new Set(needed)];
    if (!unique.length) return;

    unique.forEach((taskId) => fetchingRef.current.add(taskId));

    // One batched request instead of one GET /tasks/:id per referenced task.
    taskService.getByIds(unique).then((tasks) => {
      const updates: Record<string, TaskMeta> = {};
      tasks.forEach((task) => {
        const users: Record<string, TaskUserInfo> = {};
        users[task.creator.id] = task.creator;
        task.assignees.forEach((a) => { users[a.user.id] = a.user; });
        updates[task.id] = { title: task.title, status: task.status, users };
      });
      if (Object.keys(updates).length) {
        setTaskMetaMap((prev) => ({ ...prev, ...updates }));
      }
    }).finally(() => {
      unique.forEach((taskId) => fetchingRef.current.delete(taskId));
    });
  }, [notifications, snoozed, cleared]);

  // Reset secondary tabs on workspace switch
  useEffect(() => {
    setLaterLoaded(false);
    setClearedLoaded(false);
    setLaterLoading(false);
    setClearedLoading(false);
    setSnoozed([]);
    setCleared([]);
    setTaskMetaMap({});
    fetchingRef.current.clear();
  }, [activeWorkspaceId]);

  // Re-fetch "later" tab whenever laterLoaded is reset while the tab is active
  useEffect(() => {
    if (activeTab !== "later" || laterLoaded) return;
    let cancelled = false;
    setLaterLoading(true);
    notificationService.getSnoozed()
      .then((data) => { if (!cancelled) { setSnoozed(Array.isArray(data) ? data : []); setLaterLoaded(true); } })
      .catch(() => { if (!cancelled) toast.error("Failed to load snoozed notifications"); })
      .finally(() => { if (!cancelled) setLaterLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, laterLoaded]);

  // Re-fetch "cleared" tab whenever clearedLoaded is reset while the tab is active
  useEffect(() => {
    if (activeTab !== "cleared" || clearedLoaded) return;
    let cancelled = false;
    setClearedLoading(true);
    notificationService.getCleared()
      .then((data) => { if (!cancelled) { setCleared(Array.isArray(data) ? data : []); setClearedLoaded(true); } })
      .catch(() => { if (!cancelled) toast.error("Failed to load cleared notifications"); })
      .finally(() => { if (!cancelled) setClearedLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, clearedLoaded]);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    // Fetching is now handled by the useEffects above — switching to a tab
    // with !loaded triggers them automatically.
  }, []);

  const handleRowClick = useCallback((item: Notification) => {
    if (!item.isRead) markRead(item.id);
    if (item.taskId) {
      openTaskDetail(item.taskId);
      return;
    }
    const route = resolveNotificationRoute(item.referenceType, item.referenceId);
    if (route) router.push(route);
  }, [markRead, openTaskDetail, router]);

  const handleClear = useCallback(async (id: string) => {
    await clearNotification(id);
    setLaterLoaded(false);
    setClearedLoaded(false);
  }, [clearNotification]);

  const handleClearAll = useCallback(async () => {
    await clearAll();
    setLaterLoaded(false);
    setClearedLoaded(false);
  }, [clearAll]);

  const handleSnooze = useCallback(async (id: string, until?: string) => {
    await snoozeNotification(id, until);
    setLaterLoaded(false);
  }, [snoozeNotification]);

  const handleUnsnooze = useCallback(async (id: string) => {
    await unsnoozeNotification(id);
    setSnoozed((prev) => prev.filter((n) => n.id !== id));
  }, [unsnoozeNotification]);

  const handleRestore = useCallback(async (id: string) => {
    try {
      await notificationService.patchClear(id, false);
      setCleared((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast.error("Failed to restore notification");
    }
  }, []);

  const primaryHeader = (
    <div className="flex items-center justify-between">
      <button className="flex items-center gap-1.5 text-[12px] border px-1.5 py-0.5 border-gray-200 dark:border-gray-800 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        <LuListFilter className="w-4 h-4" />
        Filter
      </button>
      <div className="flex items-center gap-2">
        <button className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <LuSettings2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleClearAll}
          className="flex items-center p-1 rounded-lg gap-1.5 text-sm border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-gray-000 transition-colors"
        >
          <LuCheck className="w-4 h-4" />
          Clear all
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="flex border-b  border-gray-200 dark:border-gray-800 shrink-0 px-2">
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const count = tab.id === "primary" && unreadCount > 0 ? `${unreadCount} unread` : undefined;
          const showDivider = index < tabs.length - 1;
          return (
            <div
              key={tab.id}
              className="relative flex flex-1 items-center"
            >
              {showDivider && (
                <span className="absolute right-0 top-4 bottom-4 w-px bg-gray-200 dark:bg-gray-800" />
              )}
              <button
                onClick={() => handleTabChange(tab.id)}
                className="flex flex-1 flex-row items-center gap-2 py-3.5 text-sm transition-colors group"
              >
                <div className={`flex w-full gap-2 flex-row items-center  mx-2 px-3 py-4 rounded-lg transition-colors
                  ${isActive
                    ? "text-brand-501 dark:text-brand-400 hover:bg-gray-100 dark:group-hover:bg-gray-800"
                    : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 group-hover:bg-gray-100 dark:group-hover:bg-gray-800"
                  }`}
                >
                  <span className={`${isActive ? "text-brand-501 dark:text-brand-400" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"}`}>{tab.icon}</span>
                  <span className="font-semibold leading-none">{tab.label}</span>
                  {count && (
                    <span className={`text-[11px] pl-3 leading-none ${isActive ? "text-brand-501 dark:text-brand-400" : "text-gray-400"}`}>
                      {count}
                    </span>
                  )}
                </div>
              </button>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-501 dark:bg-brand-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
        {activeTab === "primary" && (
          primaryNotifications.length === 0
            ? <EmptyState />
            : (
              <GroupedList
                items={primaryNotifications}
                headerExtra={primaryHeader}
                renderRow={(item, isLast) => (
                  <PrimaryRow
                    key={item.id}
                    item={item}
                    isLast={isLast}
                    taskMeta={item.taskId ? taskMetaMap[item.taskId] : undefined}
                    onClear={handleClear}
                    onSnooze={handleSnooze}
                    onMarkRead={markRead}
                    onMarkUnread={markUnread}
                    onRowClick={handleRowClick}
                  />
                )}
              />
            )
        )}

        {activeTab === "other" && <EmptyState message="No other notifications" />}

        {activeTab === "later" && (
          (!laterLoaded || laterLoading)
            ? <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
            : snoozed.length === 0
              ? <EmptyState message="No snoozed notifications" />
              : (
                <GroupedList
                  items={snoozed}
                  renderRow={(item, isLast) => (
                    <LaterRow
                      key={item.id}
                      item={item}
                      isLast={isLast}
                      taskMeta={item.taskId ? taskMetaMap[item.taskId] : undefined}
                      onUnsnooze={handleUnsnooze}
                    />
                  )}
                />
              )
        )}

        {activeTab === "cleared" && (
          (!clearedLoaded || clearedLoading)
            ? <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
            : cleared.length === 0
              ? <EmptyState message="No cleared notifications" />
              : (
                <GroupedList
                  items={cleared}
                  renderRow={(item, isLast) => (
                    <ClearedRow
                      key={item.id}
                      item={item}
                      isLast={isLast}
                      taskMeta={item.taskId ? taskMetaMap[item.taskId] : undefined}
                      onRestore={handleRestore}
                    />
                  )}
                />
              )
        )}
      </div>
    </div>
  );
}
