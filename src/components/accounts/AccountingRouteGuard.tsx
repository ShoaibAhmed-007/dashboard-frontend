"use client";

import { useAccountingAccess } from "@/hooks/useAccountingAccess";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Gates entry to the `/accounts` area:
 *
 * - `null` role             → no access; toast + bounce to /university.
 * - `CEO` / `ACCOUNTANT`    → read every page.
 *
 * Read access is all this guard decides. Write controls are hidden per-component
 * via `canWrite` (accountant-only), mirroring the backend's per-handler
 * `@RequireUserRole('ACCOUNTANT')` on every POST/PATCH/DELETE.
 *
 * Client-side only, matching how the rest of the app guards routes (middleware.ts
 * deliberately defers auth to the client) — the backend enforces the same rules
 * independently, so this is UX, not the security boundary.
 */
export default function AccountingRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { canAccessAccounting, isLoading } = useAccountingAccess();
  const router = useRouter();

  // The redirect below runs on a path change too, so without this the toast
  // would fire again on every navigation while the redirect settles.
  const hasWarned = useRef(false);

  const deniedEntirely = !isLoading && !canAccessAccounting;

  useEffect(() => {
    if (isLoading || !deniedEntirely) return;

    if (!hasWarned.current) {
      hasWarned.current = true;
      toast.error("You don't have access to the accounts portal.");
    }
    router.replace("/university");
  }, [isLoading, deniedEntirely, router]);

  // Never flash protected content while the redirect is in flight.
  if (isLoading || deniedEntirely) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center bg-[#FAFAFF] dark:bg-gray-907">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
