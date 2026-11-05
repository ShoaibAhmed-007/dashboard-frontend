"use client";

import { useItManagerAccess } from "@/hooks/useItManagerAccess";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Manager-only IT Management routes — gated server-side by `ItManagerGuard`.
 *  `/it-management/my-requests` is deliberately absent: the backend
 *  self-scopes that one to the caller's own requests for anyone, so it's
 *  open to every workspace member. */
const MANAGER_ONLY_PATHS = [
  "/it-management/assets",
  "/it-management/employees",
  "/it-management/requests",
  "/it-management/bills",
];

/**
 * A plain workspace member (no `isItManager`, not OWNER) who lands on a
 * manager-only IT Management route — via the sidebar's "IT Management" rail
 * item, a typed URL, or a stale link — gets bounced to
 * /it-management/my-requests, the one IT Management screen open to everyone.
 * Mirrors useAccountantLockIn/useItManagerLockIn's shape, but the other
 * direction: those scope a privileged-but-limited user OUT of the rest of
 * the app, this scopes an unprivileged one OUT of the manager-only corner of
 * one module.
 *
 * Returns true while a redirect is pending, so the caller (AdminLayoutClient)
 * can hold off on rendering the manager-only page it was about to show.
 */
export function useItModuleMemberRedirect(): boolean {
  const { canAccessItModule, isLoading } = useItManagerAccess();
  const router = useRouter();
  const pathname = usePathname();

  const isManagerOnlyRoute =
    pathname === "/it-management" || MANAGER_ONLY_PATHS.some((prefix) => pathname.startsWith(prefix));

  const shouldRedirect = !isLoading && !canAccessItModule && isManagerOnlyRoute;

  useEffect(() => {
    if (shouldRedirect) router.replace("/it-management/my-requests");
  }, [shouldRedirect, router]);

  return shouldRedirect;
}
