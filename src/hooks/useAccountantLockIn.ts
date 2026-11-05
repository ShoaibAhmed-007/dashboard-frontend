"use client";

import { useAccountingAccess } from "@/hooks/useAccountingAccess";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Paths an ACCOUNTANT is allowed to visit outside the accounting area. */
const ALLOWED_PREFIXES = ["/accounts", "/settings"];

/**
 * Accountants are scoped to the accounting area. If one lands anywhere else
 * (typed URL, bookmark, a link from a shared component), bounce them back to
 * `/accounts`. `/settings` stays reachable because the accounting sidebar
 * panel links to it.
 *
 * Returns true while a redirect is pending so the caller can hold off on
 * rendering the page it was about to show.
 */
export function useAccountantLockIn(): boolean {
  const { isAccountant, isLoading } = useAccountingAccess();
  const router = useRouter();
  const pathname = usePathname();

  const shouldRedirect =
    !isLoading &&
    isAccountant &&
    !ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (shouldRedirect) router.replace("/accounts");
  }, [shouldRedirect, router]);

  return shouldRedirect;
}
