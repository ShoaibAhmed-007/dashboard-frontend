"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import { useVendorMutations } from "@/hooks/useAccounting";
import { fieldErrorsFrom } from "@/components/accounts/validationErrors";
import { SingleDateField } from "@/components/accounts/accountingFilters";
import {
  fromDateInputValue,
  toDateInputValue,
} from "@/components/accounts/platformMeta";
import type {
  AccountingVendor,
  UpdateVendorPayload,
} from "@/services/accounting.service";

/**
 * Create-or-edit in one modal — a vendor is a name and one amount owed.
 *
 * The same shape as EmployeeFormModal with one figure instead of a paid /
 * pending / total trio. `pendingPayment` is PKR and never converted, so there
 * is no currency selector, and there is nothing computed to display alongside.
 */
export default function VendorFormModal({
  isOpen,
  onClose,
  vendor = null,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Present = edit this vendor. Absent = create a new one. */
  vendor?: AccountingVendor | null;
  onSaved?: (vendor: AccountingVendor) => void;
}) {
  const { createVendor, updateVendor } = useVendorMutations();
  const isEditing = vendor !== null;
  const [name, setName] = useState(vendor?.name ?? "");
  const [pending, setPending] = useState("0");
  /** `YYYY-MM-DD`, or "" for no due date. */
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  /** Per-input messages from a 422, keyed by the API's `errors[].field`. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(vendor?.name ?? "");
    setPending(String(vendor?.pendingPayment ?? 0));
    setDueDate(vendor?.dueDate ? toDateInputValue(vendor.dueDate) : "");
    setError("");
    setFieldErrors({});
  }, [isOpen, vendor]);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Blank counts as zero, matching the API's own default for an omitted field.
  const pendingValue = pending.trim() === "" ? 0 : Number(pending);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    setFieldErrors({});

    if (!trimmed) {
      setError("Enter a vendor name.");
      return;
    }
    if (!Number.isFinite(pendingValue) || pendingValue < 0) {
      setError("Pending payment must be zero or more.");
      return;
    }

    setSaving(true);
    try {
      let saved: AccountingVendor;
      if (isEditing) {
        // Send only what changed — the fields are independent server-side, and
        // an empty body is rejected with a 422, so a no-op edit just closes.
        /* `dueDate` has three states server-side: a string sets it, an
           explicit null clears it, and omitting it leaves it alone. Comparing
           the normalised `YYYY-MM-DD` forms keeps an untouched field out of
           the patch entirely, so a no-op edit still 422s rather than silently
           rewriting the date. */
        const originalDue = vendor.dueDate ? toDateInputValue(vendor.dueDate) : "";
        const patch: UpdateVendorPayload = {
          ...(trimmed !== vendor.name ? { name: trimmed } : {}),
          ...(pendingValue !== vendor.pendingPayment
            ? { pendingPayment: pendingValue }
            : {}),
          ...(dueDate !== originalDue
            ? { dueDate: dueDate ? fromDateInputValue(dueDate) ?? null : null }
            : {}),
        };
        if (Object.keys(patch).length === 0) {
          onClose();
          return;
        }
        saved = await updateVendor(vendor.id, patch);
      } else {
        saved = await createVendor({
          name: trimmed,
          pendingPayment: pendingValue,
          // Omitted entirely when blank — the column is nullable.
          ...(dueDate ? { dueDate: fromDateInputValue(dueDate) } : {}),
        });
      }
      toast.success(isEditing ? "Vendor updated" : `${saved.name} created`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const perField = fieldErrorsFrom(err);
      if (Object.keys(perField).length > 0) {
        setFieldErrors(perField);
      } else {
        const { message } = parseApiError(err);
        setError(
          message || `Couldn't ${isEditing ? "update" : "create"} the vendor.`
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClass = (field: string) =>
    `mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-brand-500/10 dark:bg-gray-800 dark:text-gray-100 ${
      fieldErrors[field]
        ? "border-red-400"
        : "border-gray-200 focus:border-brand-500 dark:border-gray-700"
    }`;

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-form-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-[380px] rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950"
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
          id="vendor-form-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {isEditing ? "Edit Vendor" : "Add Vendor"}
        </h2>

        <label className="mt-5 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Vendor Name
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass("name")}
          />
          {fieldErrors.name && (
            <span role="alert" className="mt-1 block text-xs font-normal text-red-500">
              {fieldErrors.name}
            </span>
          )}
        </label>

        <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Pending Payment (PKR)
          <input
            type="number"
            min="0"
            step="0.01"
            value={pending}
            onChange={(event) => setPending(event.target.value)}
            onFocus={() => {
              if (Number(pending) === 0) setPending("");
            }}
            onBlur={() => {
              if (pending.trim() === "") setPending("0");
            }}
            placeholder="0"
            className={inputClass("pendingPayment")}
          />
          {fieldErrors.pendingPayment && (
            <span role="alert" className="mt-1 block text-xs font-normal text-red-500">
              {fieldErrors.pendingPayment}
            </span>
          )}
        </label>

        {/* Optional — the server stores it and nothing more: no reminder, no
            notification, no overdue state. Clearing the field clears the date. */}
        <div className="mt-3 text-xs font-medium text-gray-600 dark:text-gray-300">
          Due Date <span className="font-normal text-gray-400">(optional)</span>
          <SingleDateField
            value={dueDate}
            onChange={setDueDate}
            placeholder="No due date"
            clearable
          />
          {fieldErrors.dueDate && (
            <span role="alert" className="mt-1 block text-xs font-normal text-red-500">
              {fieldErrors.dueDate}
            </span>
          )}
        </div>

        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5 text-[11px] leading-4 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          Pending payment is entered by hand and always in PKR — it is not
          derived from any transaction.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-[linear-gradient(90deg,#6547f7_0%,#5431ed_100%)] text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
