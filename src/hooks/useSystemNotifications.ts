"use client";

import { useState, useCallback } from "react";

export function useSystemNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof Notification === "undefined") return "denied";
    return Notification.permission;
  });

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof Notification === "undefined") return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const n = new Notification(title, {
      icon: "/images/logo/logo-icon.svg",
      badge: "/images/logo/logo-icon.svg",
      ...options,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }, []);

  return { permission, requestPermission, showNotification };
}
