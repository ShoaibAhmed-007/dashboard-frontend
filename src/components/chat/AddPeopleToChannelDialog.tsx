"use client";

import { useEffect, useRef, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { LuX } from "react-icons/lu";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { channelService } from "@/services/channel.service";
import { parseApiError } from "@/lib/api";
import { getInitials } from "@/lib/getInitials";

/** Shown in the copy. Replace when this comes from the API. */
const ORG_NAME = "Dashboard Inc.";

/**
 * "Add people or agents to #channel".
 *
 * Deliberately separate from `CreateChannelDialog`: the channel already exists
 * by the time this opens, so inviting is its own action rather than a step in
 * creation. That also makes it reusable from a channel's own "Add people"
 * card, not just straight after creating one.
 *
 * Same panel spec as the create dialog: 537px wide, 32px padding, 24px radius,
 * 1px white border, 101deg violet gradient.
 */
export default function AddPeopleToChannelDialog({
  isOpen,
  channelId,
  channelName,
  onClose,
  onAdded,
}: {
  isOpen: boolean;
  channelId: string;
  /** Rendered as `#channelName` in the title. */
  channelName: string;
  onClose: () => void;
  onAdded?: () => void;
}) {
  /* No reset effect needed: the dialog returns null while closed, so it
     remounts with fresh state every time it opens. */
  const [invitee, setInvitee] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { members } = useWorkspaceMembers();
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmed = invitee.trim();
  const needle = trimmed.toLowerCase();
  const matches = needle
    ? members.filter(
        (m) =>
          m.fullName.toLowerCase().includes(needle) ||
          m.email.toLowerCase().includes(needle)
      )
    : members;

  const toggle = (userId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const submit = async () => {
    if (selected.size === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await channelService.addMembers(
        channelId,
        Array.from(selected).map((userId) => ({ userId, role: "member" }))
      );
      toast.success(
        `Added ${selected.size} ${selected.size === 1 ? "person" : "people"}.`
      );
      onAdded?.();
      onClose();
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't add those people.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-people-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="dialog-backdrop-in fixed inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        style={{
          background: "linear-gradient(101deg, #8B5CF6 3.33%, #B16CFF 100.31%)",
        }}
        className="dialog-pop-in relative z-10 flex w-full max-w-[537px] flex-col gap-2.5 rounded-3xl border border-white p-8 shadow-2xl"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-6 top-6 flex h-7 w-7 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <LuX className="h-[18px] w-[18px]" />
        </button>

        <form
          className="w-full"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h2
            id="add-people-title"
            className="pr-8 text-[22px] font-semibold leading-tight text-white"
          >
            Add people or agents to #{channelName}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-white/90">
            You can also add email addresses of people who aren&apos;t members
            of {ORG_NAME}
          </p>

          <input
            autoFocus
            value={invitee}
            onChange={(event) => setInvitee(event.target.value)}
            placeholder="Enter a name or email address"
            aria-label="Enter a name or email address"
            /* Transparent so the panel's gradient reads through the outline. */
            className="mt-4 h-12 w-full rounded-xl border border-white bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/70 focus:ring-2 focus:ring-white/40"
          />

          {/* Search filters the workspace roster; picking is what actually
              adds people. The free-text box doubles as the filter so the
              design's single-field look is preserved. */}
          <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
            {matches.length === 0 && (
              <p className="py-3 text-center text-xs text-white/70">
                No one matches that search.
              </p>
            )}
            {matches.map((member) => {
              const picked = selected.has(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggle(member.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                    picked ? "bg-white/25" : "hover:bg-white/15"
                  }`}
                >
                  {/* The dialog sits on a violet gradient, so a member with
                      no picture keeps the translucent chip rather than the
                      pale default tint. */}
                  {member.avatarUrl ? (
                    <UserAvatar
                      name={member.fullName}
                      avatarUrl={member.avatarUrl}
                      size={28}
                    />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/25 text-[10px] font-semibold text-white">
                      {getInitials(member.fullName)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white">
                      {member.fullName}
                    </span>
                    <span className="block truncate text-[11px] text-white/70">
                      {member.email}
                    </span>
                  </span>
                  {picked && (
                    <span className="text-[11px] font-medium text-white">
                      Added
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="h-10 shrink-0 rounded-lg bg-white px-6 text-sm font-medium text-gray-900 transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving
                ? "Adding…"
                : selected.size > 0
                  ? `Add ${selected.size}`
                  : "Skip for now"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
