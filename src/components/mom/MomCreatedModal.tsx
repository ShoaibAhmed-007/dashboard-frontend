"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/**
 * Confirmation shown once a MOM is saved.
 *
 * Deliberately has no dismiss affordance of its own: both buttons navigate
 * away, so there is no state to return to — the form behind it has already
 * been submitted. Escape is wired to the safer of the two (back to the list)
 * rather than leaving the dialog inescapable by keyboard.
 */
export default function MomCreatedModal({
  isOpen,
  taskCount,
  onBackToList,
  onViewMom,
}: {
  isOpen: boolean;
  /** Drives the "N tasks assigned" line under the heading. */
  taskCount: number;
  onBackToList: () => void;
  onViewMom: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBackToList();
    };
    document.addEventListener("keydown", onKeyDown);
    // The page behind is a long form; stop it scrolling under the dialog.
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onBackToList]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mom-created-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
    >
      <div
        ref={panelRef}
        className="w-full max-w-[615px] rounded-3xl bg-white px-8 py-12 text-center shadow-2xl dark:bg-gray-900"
      >
        <Image
          src="/images/MOM/green-tick.svg"
          alt=""
          width={112}
          height={112}
          className="mx-auto"
          // Decorative: the heading beside it already says what happened.
          aria-hidden="true"
        />

        <h2
          id="mom-created-title"
          className="mt-6 text-3xl font-bold text-gray-900 dark:text-gray-100"
        >
          MOM Created Successfully
        </h2>
        <p className="mt-3 text-base text-gray-500 dark:text-gray-400">
          {taskCount} {taskCount === 1 ? "task" : "tasks"} assigned
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onBackToList}
            className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-brand-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Back to list
          </button>
          <button
            type="button"
            onClick={onViewMom}
            className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            View MOM
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
