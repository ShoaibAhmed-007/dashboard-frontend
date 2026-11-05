"use client";

import { useItManagerAccess } from "@/hooks/useItManagerAccess";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Paths a scoped IT Manager is allowed to visit outside the IT module. */
const ALLOWED_PREFIXES = ["/it-management", "/settings"];

/**
 * A plain MEMBER whose only elevated capability is `isItManager` (see
 * `useItManagerAccess.isScopedToItModule`) is scoped to the IT Management
 * area, the same way `useAccountantLockIn` scopes an accountant to `/accounts`.
 * If one lands anywhere else (typed URL, bookmark, a link from a shared
 * component), bounce them back to `/it-management`. `/settings` stays
 * reachable because the IT panel links to it.
 *
 * Returns true while a redirect is pending so the caller can hold off on
 * rendering the page it was about to show.
 */
export function useItManagerLockIn(): boolean {
  const { isScopedToItModule, isLoading } = useItManagerAccess();
  const router = useRouter();
  const pathname = usePathname();

  const shouldRedirect =
    !isLoading &&
    isScopedToItModule &&
    !ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (shouldRedirect) router.replace("/it-management");
  }, [shouldRedirect, router]);

  return shouldRedirect;
}
