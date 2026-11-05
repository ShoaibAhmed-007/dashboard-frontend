"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { LuBell } from "react-icons/lu";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { useNotificationsOptional } from "@/context/NotificationContext";
import { Notification, resolveNotificationRoute } from "@/types/notification";
import { notificationIconFor } from "@/lib/notification-icon";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NotificationTypeIcon({ type, referenceType }: { type: string; referenceType: string }) {
  // `React.createElement`, not `<Icon />` — the resolved icon is a variable,
  // and JSX would need it capitalized as a "component created during render"
  // for the react-hooks/static-components rule to allow it.
  return React.createElement(notificationIconFor(type, referenceType), { className: "w-5 h-5 text-brand-500" });
}

function NotifRow({ item, onClose, onRead }: { item: Notification; onClose: () => void; onRead: (id: string) => void }) {
  const router = useRouter();
  const handleClick = () => {
    if (!item.isRead) onRead(item.id);
    onClose();
    const route = resolveNotificationRoute(item.referenceType, item.referenceId);
    if (route) router.push(route);
  };

  return (
    <li>
      <DropdownItem
        onItemClick={handleClick}
        className="flex gap-3 rounded-lg border-b border-gray-100 px-4 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
      >
        <span className="w-10 h-10 shrink-0 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
          <NotificationTypeIcon type={item.type} referenceType={item.referenceType} />
        </span>
        <span className="block min-w-0 flex-1">
          <span className={`mb-1 block text-theme-sm font-normal truncate ${item.isRead ? "text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-white/90"}`}>
            {item.title}
          </span>
          {item.message && (
            <span className="block text-theme-xs text-gray-500 dark:text-gray-400 truncate">{item.message}</span>
          )}
          <span className="text-theme-xs text-gray-400">{formatRelativeTime(item.createdAt)}</span>
        </span>
        {!item.isRead && (
          <span className="mt-1 shrink-0 w-2 h-2 rounded-full bg-brand-500" />
        )}
      </DropdownItem>
    </li>
  );
}

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  // `AppHeader` is shared with the University portal, which doesn't mount
  // `NotificationProvider` (same reasoning as the admin-only Project/TaskList/
  // Docs providers) — render nothing there rather than crash the layout.
  const ctx = useNotificationsOptional();
  if (!ctx) return null;
  const { notifications, unreadCount, markRead } = ctx;
  const recent = notifications.slice(0, 5);

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors rounded-full hover:text-gray-700 h-8 w-8 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        aria-label="Notifications"
        onClick={toggleDropdown}
      >
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400 flex">
            <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping" />
          </span>
        )}
        <svg
          className="fill-current"
          width="16"
          height="16"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-normal text-gray-800 dark:text-gray-200">
            Notifications {unreadCount > 0 && <span className="ml-1 text-sm text-brand-500">({unreadCount})</span>}
          </h5>
          <button
            onClick={toggleDropdown}
            className="text-gray-500 transition dropdown-toggle dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <svg className="fill-current" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {recent.length === 0 ? (
            <li className="flex flex-col items-center justify-center py-12 text-sm text-gray-400">
              <LuBell className="w-8 h-8 mb-2 opacity-40" />
              No notifications
            </li>
          ) : (
            recent.map((item) => (
              <NotifRow key={item.id} item={item} onClose={closeDropdown} onRead={markRead} />
            ))
          )}
        </ul>

        <Link
          href="/"
          className="block px-4 py-2 mt-3 text-sm font-normal text-center text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          View All Notifications
        </Link>
      </Dropdown>
    </div>
  );
}
