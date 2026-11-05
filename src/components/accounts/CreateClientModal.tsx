"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import { useClientMutations } from "@/hooks/useAccounting";
import { type AccountingClient } from "@/services/accounting.service";

/**
 * Creates a client via `POST /clients`, which accepts `clientName` and nothing
 * else. There is no opening-revenue or currency input: the server assigns both
 * automatically and silently discards anything sent for them. Revenue is
 * derived from transactions (`totalRevenueUsd`) and always USD.
 */
export default function CreateClientModal({
  isOpen,
  onClose,
  initialName = "",
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Prefills the name when opened from the "Create <term>" row of a picker. */
  initialName?: string;
  onCreated?: (client: AccountingClient) => void;
}) {
  const { createClient } = useClientMutations();
  const [clientName, setClientName] = useState(initialName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset on each open so a prefill from the picker lands and stale input from a
  // cancelled attempt doesn't linger.
  useEffect(() => {
    if (!isOpen) return;
    setClientName(initialName);
    setError("");
  }, [isOpen, initialName]);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = clientName.trim();

    if (!name) {
      setError("Enter a client name.");
      return;
    }

    setSaving(true);
    try {
      const created = await createClient({ clientName: name });
      toast.success(`${created.clientName} created`);
      onCreated?.(created);
      onClose();
    } catch (err) {
      const { message } = parseApiError(err);
      setError(message || "Couldn't create the client.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-client-title"
    >
      <button
        type="button"
        aria-label="Close create client"
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <form
        onSubmit={submit}
        className="relative z-10 my-auto w-full max-w-[400px] rounded-[22px] bg-white p-6 shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-6 top-5 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
        >
          <LuX className="h-4 w-4" />
        </button>
        <h2
          id="create-client-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          Add Client
        </h2>

        <label className="mt-6 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Client Name
          <input
            autoFocus
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>

        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5 text-[11px] leading-4 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          The total amount is calculated from this client&apos;s sales and shown
          in USD. There is nothing to enter here.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-lg bg-[linear-gradient(90deg,#6547f7_0%,#7c2cf3_100%)] text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Client"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
