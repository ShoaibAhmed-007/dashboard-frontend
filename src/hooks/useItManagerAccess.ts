"use client";

import { useAuth } from "@/context/AuthContext";
import { useAccountingRole } from "@/hooks/useAccounting";

export interface ItManagerAccess {
  /** Independent of workspace `role` — a plain MEMBER can be an IT Manager. */
  isItManager: boolean;
  isOwner: boolean;
  isManager: boolean;
  /** OWNER, or a member explicitly flagged `isItManager` — the only two ways
   *  into the IT Management module (`ItManagerGuard`). A generic MANAGER
   *  with no IT flag does not qualify. */
  canAccessItModule: boolean;
  /**
   * True for a plain MEMBER whose only elevated capability is `isItManager`
   * — someone invited specifically to run the IT module and nothing else.
   * The OWNER and a MANAGER never get scoped down this way even when also
   * flagged `isItManager`: both already have legitimate access to every
   * other area, and an OWNER commonly flags themselves IT Manager purely to
   * receive IT-module notifications (doc §7/§8) — locking them out of their
   * own workspace over that would be a severe regression, not the intended
   * behavior. Mirrors `useAccountingAccess`'s `isAccountant` lockdown, just
   * for a different module.
   */
  isScopedToItModule: boolean;
  /** true while the session or the workspace membership is still resolving —
   *  guards must wait on this or they'll bounce users mid-load. */
  isLoading: boolean;
}

/**
 * Single source of truth for IT Management module gating, mirroring
 * `useAccountingAccess`. `isItManager` lives on `WorkspaceMember.isItManager`
 * and is read from `GET /workspaces/:id` (via `useAccountingRole`, which
 * already fetches the whole "who am I" payload — no separate request here).
 *
 * Mirrors the backend guard: every route under `/assets`, `/company-employees`,
 * `/it-requests`, `/it-bills` and `/it-dashboard` is behind `ItManagerGuard`,
 * which lets in the workspace OWNER or anyone with `isItManager: true` and
 * 403s everyone else — including a generic MANAGER with no IT flag. This
 * hook hides what the server would reject anyway.
 */
export function useItManagerAccess(): ItManagerAccess {
  const { isLoading: isAuthLoading } = useAuth();
  const { workspaceRole, isItManager, isLoading: isRoleLoading } = useAccountingRole();

  const isOwner = workspaceRole === "OWNER";
  const isManager = workspaceRole === "MANAGER";

  return {
    isItManager,
    isOwner,
    isManager,
    canAccessItModule: isOwner || isItManager,
    isScopedToItModule: isItManager && !isOwner && !isManager,
    isLoading: isAuthLoading || isRoleLoading,
  };
}
