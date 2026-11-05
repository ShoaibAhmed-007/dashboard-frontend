"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  isLoading?: boolean;
  requireText?: string;
  requireTextLabel?: string;
}

export default function ConfirmActionModal({
  isOpen,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  isLoading = false,
  requireText,
  requireTextLabel,
}: ConfirmActionModalProps) {
  const [value, setValue] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const requiresMatch = typeof requireText === "string" && requireText.length > 0;
  const canConfirm = !isLoading && (!requiresMatch || value === requireText);

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      <div ref={panelRef} className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <LuX className="h-4 w-4" />
        </button>

        <h3 className="pr-8 text-lg font-normal text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>

        {requiresMatch && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              {requireTextLabel ?? `Type "${requireText}" to confirm`}
            </p>
            <input
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              placeholder={requireText}
              autoFocus
            />
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="rounded-lg border border-red-500/70 bg-red-500 px-3 py-2 text-sm font-normal text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
