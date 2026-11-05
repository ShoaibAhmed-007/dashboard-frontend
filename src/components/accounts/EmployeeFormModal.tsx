"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import { useEmployeeMutations } from "@/hooks/useAccounting";
import { fieldErrorsFrom } from "@/components/accounts/validationErrors";
import type {
  AccountingEmployee,
  UpdateEmployeePayload,
} from "@/services/accounting.service";
import { formatMoney } from "@/components/accounts/platformMeta";

/**
 * Create-or-edit in one modal — the same three inputs either way: name, paid
 * commission, pending commission.
 *
 * All commission figures are PKR; the API has no currency column and never
 * converts, so there is deliberately no currency selector here. Total is
 * derived (`paid + pending`) and computed server-side, so it is displayed
 * read-only and never sent.
 */
export default function EmployeeFormModal({
  isOpen,
  onClose,
  employee = null,
  initialName = "",
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Present = edit this employee. Absent = create a new one. */
  employee?: AccountingEmployee | null;
  /** Prefills the name when opened from the "Create <term>" row of a picker. */
  initialName?: string;
  onSaved?: (employee: AccountingEmployee) => void;
}) {
  const { createEmployee, updateEmployee } = useEmployeeMutations();
  const isEditing = employee !== null;
  const [name, setName] = useState(employee?.name ?? initialName);
  const [paid, setPaid] = useState("0");
  const [pending, setPending] = useState("0");
  const [error, setError] = useState("");
  /** Per-input messages from a 422, keyed by the API's `errors[].field`. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(employee?.name ?? initialName);
    setPaid(String(employee?.paidCommission ?? 0));
    setPending(String(employee?.pendingCommission ?? 0));
    setError("");
    setFieldErrors({});
  }, [isOpen, employee, initialName]);

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
  const paidValue = paid.trim() === "" ? 0 : Number(paid);
  const pendingValue = pending.trim() === "" ? 0 : Number(pending);
  // Mirrors the server's own sum so the user sees the result before saving.
  // The server's value is still authoritative — this is a preview, not a source.
  const totalPreview =
    Number.isFinite(paidValue) && Number.isFinite(pendingValue)
      ? paidValue + pendingValue
      : 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    setFieldErrors({});

    if (!trimmed) {
      setError("Enter an employee name.");
      return;
    }
    if (!Number.isFinite(paidValue) || paidValue < 0) {
      setError("Paid commission must be zero or more.");
      return;
    }
    if (!Number.isFinite(pendingValue) || pendingValue < 0) {
      setError("Pending commission must be zero or more.");
      return;
    }

    setSaving(true);
    try {
      let saved: AccountingEmployee;
      if (isEditing) {
        // Send only what changed — each field is independent server-side, and
        // an empty body is rejected with a 422, so a no-op edit just closes.
        const patch: UpdateEmployeePayload = {
          ...(trimmed !== employee.name ? { name: trimmed } : {}),
          ...(paidValue !== employee.paidCommission
            ? { paidCommission: paidValue }
            : {}),
          ...(pendingValue !== employee.pendingCommission
            ? { pendingCommission: pendingValue }
            : {}),
        };
        if (Object.keys(patch).length === 0) {
          onClose();
          return;
        }
        saved = await updateEmployee(employee.id, patch);
      } else {
        saved = await createEmployee({
          name: trimmed,
          paidCommission: paidValue,
          pendingCommission: pendingValue,
        });
      }
      toast.success(isEditing ? "Employee updated" : `${saved.name} created`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const perField = fieldErrorsFrom(err);
      if (Object.keys(perField).length > 0) {
        setFieldErrors(perField);
      } else {
        const { message } = parseApiError(err);
        setError(
          message || `Couldn't ${isEditing ? "update" : "create"} the employee.`
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const amountClass = (field: string) =>
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
      aria-labelledby="employee-form-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950"
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
          id="employee-form-title"
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {isEditing ? "Edit Employee" : "Add Employee"}
        </h2>

        <label className="mt-5 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Employee Name
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={amountClass("name")}
          />
          {fieldErrors.name && (
            <span role="alert" className="mt-1 block text-xs font-normal text-red-500">
              {fieldErrors.name}
            </span>
          )}
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Paid Commission (PKR)
            <input
              type="number"
              min="0"
              step="0.01"
              value={paid}
              onChange={(event) => setPaid(event.target.value)}
              onFocus={() => {
                if (Number(paid) === 0) setPaid("");
              }}
              onBlur={() => {
                if (paid.trim() === "") setPaid("0");
              }}
              placeholder="0"
              className={amountClass("paidCommission")}
            />
            {fieldErrors.paidCommission && (
              <span role="alert" className="mt-1 block text-xs font-normal text-red-500">
                {fieldErrors.paidCommission}
              </span>
            )}
          </label>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Pending Commission (PKR)
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
              className={amountClass("pendingCommission")}
            />
            {fieldErrors.pendingCommission && (
              <span role="alert" className="mt-1 block text-xs font-normal text-red-500">
                {fieldErrors.pendingCommission}
              </span>
            )}
          </label>
        </div>

        {/* Derived, never an input: the server recomputes it on every read, so
            sending it would be ignored. */}
        <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Total Commission
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatMoney("PKR", totalPreview)}
          </span>
        </div>

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
