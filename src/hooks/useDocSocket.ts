"use client";

import { useEffect, useRef } from "react";
import type { Doc } from "@/services/docs.service";
import { getDocSocket } from "@/lib/doc-socket";

export interface PresenceUser {
  userId: string;
  name: string;
  email: string;
  socketIds: string[];
  lockedBlockIds: string[];
}

export interface BlockLock {
  docId: string;
  blockId: string;
  userId: string;
  socketId: string;
  expiresAt: number;
}

export interface DocSavedPayload {
  docId: string;
  doc: Doc;
  changedBlockIds: string[];
  orphanedThreadCount: number;
}

export interface DocSaveConflictPayload {
  conflictBlockIds: string[];
  reason: string;
}

export interface DocLockRejectedPayload {
  blockId: string;
  ownerUserId: string;
  expiresAt: number;
}

export interface UseDocSocketCallbacks {
  onPresenceSnapshot?: (users: PresenceUser[]) => void;
  onLockSnapshot?: (locks: BlockLock[]) => void;
  onSaved?: (payload: DocSavedPayload) => void;
  onSaveConflict?: (payload: DocSaveConflictPayload) => void;
  onLockRejected?: (payload: DocLockRejectedPayload) => void;
}

export interface DocSocketControls {
  autosave: (contentJson: Record<string, unknown>, baseVersion: number) => void;
  lockBlock: (blockId: string) => void;
  lockHeartbeat: (blockId: string) => void;
  unlockBlock: (blockId: string) => void;
  isConnected: () => boolean;
}

export function useDocSocket(
  docId: string | null,
  callbacks: UseDocSocketCallbacks
): DocSocketControls {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (!docId) return;
    const socket = getDocSocket();

    const onPresence = (data: { users: PresenceUser[] }) =>
      cbRef.current.onPresenceSnapshot?.(data.users);
    const onLockSnap = (data: { locks: BlockLock[] }) =>
      cbRef.current.onLockSnapshot?.(data.locks);
    const onSaved = (data: DocSavedPayload) => {
      if (data.docId !== docId) return;
      cbRef.current.onSaved?.(data);
    };
    const onConflict = (data: DocSaveConflictPayload) =>
      cbRef.current.onSaveConflict?.(data);
    const onLockReject = (data: DocLockRejectedPayload) =>
      cbRef.current.onLockRejected?.(data);

    socket.on("doc:presence-snapshot", onPresence);
    socket.on("doc:lock-snapshot", onLockSnap);
    socket.on("doc:saved", onSaved);
    socket.on("doc:save-conflict", onConflict);
    socket.on("doc:lock-rejected", onLockReject);

    const join = () => socket.emit("doc:join", { docId });
    if (socket.connected) join();
    socket.on("connect", join);

    return () => {
      socket.emit("doc:leave", { docId });
      socket.off("doc:presence-snapshot", onPresence);
      socket.off("doc:lock-snapshot", onLockSnap);
      socket.off("doc:saved", onSaved);
      socket.off("doc:save-conflict", onConflict);
      socket.off("doc:lock-rejected", onLockReject);
      socket.off("connect", join);
    };
  }, [docId]);

  return {
    autosave: (contentJson, baseVersion) => {
      if (!docId) return;
      getDocSocket().emit("doc:autosave", { docId, contentJson, baseVersion });
    },
    lockBlock: (blockId) => {
      if (!docId) return;
      getDocSocket().emit("doc:lock-block", { docId, blockId });
    },
    lockHeartbeat: (blockId) => {
      if (!docId) return;
      getDocSocket().emit("doc:lock-heartbeat", { docId, blockId });
    },
    unlockBlock: (blockId) => {
      if (!docId) return;
      getDocSocket().emit("doc:unlock-block", { docId, blockId });
    },
    isConnected: () => getDocSocket().connected,
  };
}
