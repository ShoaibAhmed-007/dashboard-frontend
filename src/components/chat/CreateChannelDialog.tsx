"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuInfo, LuX } from "react-icons/lu";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/** Shown in the copy on steps 2 and 3. Replace when this comes from the API. */
const ORG_NAME = "Dashboard Inc.";

type Step = "name" | "visibility";

/**
 * "Create a channel" — a two-step dialog for the Chat module.
 *
 * Steps share one gradient panel and only swap their contents, so the dialog
 * keeps its position and size rather than resizing between steps.
 *
 * The channel is created at the end of step 2. Inviting people is deliberately
 * NOT a third step — it happens afterwards, against the channel that now
 * exists, via `AddPeopleToChannelDialog`.
 *
 * Presentational for this UI pass: `onSubmit` hands the finished channel back
 * to the caller.
 *
 * Panel styling comes from the supplied design spec: 537px wide, 32px padding,
 * 24px radius, 1px white border, 101deg violet gradient.
 */
export default function CreateChannelDialog({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (channel: { name: string; isPrivate: boolean }) => void;
}) {
  /* No reset effect needed: the dialog returns null while closed, so it
     remounts with fresh state every time it opens. */
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [inviteExternal, setInviteExternal] = useState(false);
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

  const trimmed = name.trim();

  /* Transparent fields: the field is just a white outline with the panel's own
     gradient reading through it — any fill lightens it away from the design. */
  const fieldClass =
    "h-12 w-full rounded-xl border border-white bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/70 focus:ring-2 focus:ring-white/40";
  const primaryButtonClass =
    "h-10 shrink-0 rounded-lg bg-white px-6 text-sm font-medium text-gray-900 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryButtonClass =
    "h-10 shrink-0 rounded-lg border border-white bg-transparent px-6 text-sm font-medium text-white transition-colors hover:bg-white/15";

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-channel-title"
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
          background:
            "linear-gradient(101deg, #8B5CF6 3.33%, #B16CFF 100.31%)",
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

        {/* ── Step 1: name ─────────────────────────────────────────────── */}
        {step === "name" && (
          <form
            className="w-full"
            onSubmit={(event) => {
              event.preventDefault();
              if (!trimmed) return;
              setStep("visibility");
            }}
          >
            <h2
              id="create-channel-title"
              className="text-[22px] font-semibold leading-tight text-white"
            >
              Create a channel
            </h2>

            <label
              htmlFor="create-channel-name"
              className="mt-4 block text-sm font-medium text-white"
            >
              Name
            </label>
            <input
              id="create-channel-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="# e.g. subscription-budget"
              className={`mt-2 ${fieldClass}`}
            />

            <p className="mt-3 text-sm leading-relaxed text-white/90">
              Channels are where conversations happen around a topic. Use a name
              that is easy to find and understand.
            </p>

            <div className="mt-6 flex items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={inviteExternal}
                  onChange={(event) => setInviteExternal(event.target.checked)}
                  className="h-4 w-4 rounded border-white/70 bg-transparent accent-white"
                />
                Invite external people
                <LuInfo className="h-3.5 w-3.5 text-white/80" />
                {/* Plan badge — presentational, matching the design. */}
                <span className="rounded bg-black px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                  PRO
                </span>
              </label>

              <button type="submit" disabled={!trimmed} className={primaryButtonClass}>
                Next
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: visibility ───────────────────────────────────────── */}
        {step === "visibility" && (
          <form
            className="w-full"
            onSubmit={(event) => {
              event.preventDefault();
              /* Creation completes here. Inviting people is a separate action
                 on the created channel, not a third step — see
                 `AddPeopleToChannelDialog`. */
              onSubmit?.({ name: trimmed, isPrivate });
              onClose();
            }}
          >
            <h2
              id="create-channel-title"
              className="text-[22px] font-semibold leading-tight text-white"
            >
              Create a channel
            </h2>
            <p className="mt-1 text-sm font-medium text-white">Name</p>

            <div className="mt-3 space-y-3">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-white">
                <input
                  type="radio"
                  name="channel-visibility"
                  checked={!isPrivate}
                  onChange={() => setIsPrivate(false)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-white"
                />
                <span>
                  Public – Anyone in <strong className="font-semibold">{ORG_NAME}</strong>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 text-sm text-white">
                <input
                  type="radio"
                  name="channel-visibility"
                  checked={isPrivate}
                  onChange={() => setIsPrivate(true)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-white"
                />
                <span>
                  <span className="font-semibold">Private – Only specific people</span>
                  <span className="mt-0.5 block text-white/90">
                    Can only be viewed or joined by invitation
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <p className="text-sm text-white">Step 2 of 2</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep("name")}
                  className={secondaryButtonClass}
                >
                  Back
                </button>
                <button type="submit" className={primaryButtonClass}>
                  Create
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>,
    document.body
  );
}
