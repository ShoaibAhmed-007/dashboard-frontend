"use client";

import { useAuth } from "@/context/AuthContext";
import { useAccountingRole } from "@/hooks/useAccounting";
import type { AccountingRole } from "@/services/workspace.service";

export interface AccountingAccess {
  role: AccountingRole | null;
  /** CEO and ACCOUNTANT may open the accounting area; no role may not. */
  canAccessAccounting: boolean;
  /** Only ACCOUNTANT may create/edit/delete accounting records. */
  canWrite: boolean;
  /** Both roles read every accounting page; only the write controls differ. */
  canSeeAllMenus: boolean;
  isAccountant: boolean;
  isCeo: boolean;
  /** true while the session or the workspace membership is still resolving —
   *  guards must wait on this or they'll bounce users mid-load. */
  isLoading: boolean;
}

/**
 * Single source of truth for accounting role gating so no component re-derives
 * it from the role directly.
 *
 * The role is **per workspace**, not per user: it lives on
 * `WorkspaceMember.accountingRole` and is read from `GET /workspaces/:id`. The
 * same person can be ACCOUNTANT in one workspace and have no access in another,
 * so this re-resolves whenever the active workspace changes.
 *
 * Mirrors the backend guards: all four accounting controllers are
 * `@RequireAccountingRole('CEO','ACCOUNTANT')` at class level (both roles can
 * read), with every POST/PATCH/DELETE overridden to `('ACCOUNTANT')`. So a CEO
 * is read-only and no role gets 403 — this hook hides what the server would
 * reject anyway.
 */
export function useAccountingAccess(): AccountingAccess {
  const { isLoading: isAuthLoading } = useAuth();
  const { accountingRole, isLoading: isRoleLoading } = useAccountingRole();

  const isAccountant = accountingRole === "ACCOUNTANT";
  const isCeo = accountingRole === "CEO";
  const canAccessAccounting = isAccountant || isCeo;

  return {
    role: accountingRole,
    canAccessAccounting,
    canWrite: isAccountant,
    canSeeAllMenus: canAccessAccounting,
    isAccountant,
    isCeo,
    isLoading: isAuthLoading || isRoleLoading,
  };
}
