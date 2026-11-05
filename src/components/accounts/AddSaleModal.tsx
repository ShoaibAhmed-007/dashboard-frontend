"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import { toast } from "sonner";
import { parseApiError } from "@/lib/api";
import { useTransactionMutations } from "@/hooks/useAccounting";
import {
  CURRENCIES,
  LOCAL_CURRENCY,
  transactionCurrenciesForAccountType,
  type BankAccount,
  type ClientSearchResult,
  type Currency,
  COMMISSION_CURRENCIES,
  type CommissionCurrency,
  type EmployeeSearchResult,
} from "@/services/accounting.service";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import ClientPicker from "@/components/accounts/ClientPicker";
import BankAccountPicker from "@/components/accounts/BankAccountPicker";
import EmployeePicker from "@/components/accounts/EmployeePicker";
import CreateClientModal from "@/components/accounts/CreateClientModal";
import EmployeeFormModal from "@/components/accounts/EmployeeFormModal";
import { SingleDateField } from "@/components/accounts/accountingFilters";
import {
  fromDateInputValue,
  todayDateInputValue,
} from "@/components/accounts/platformMeta";

export default function AddSaleModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { createTransaction } = useTransactionMutations();

  const [client, setClient] = useState<ClientSearchResult | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [amount, setAmount] = useState("0");
  const [saleDate, setSaleDate] = useState(todayDateInputValue);
  const [refId, setRefId] = useState("");
  const [description, setDescription] = useState("");
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  /* Commission is optional, but `employeeId` and `commissionAmount` are a
     both-or-neither pair server-side (422 otherwise), so the amount field only
     appears once an employee is picked, and clearing the employee clears it. */
  const [employee, setEmployee] = useState<EmployeeSearchResult | null>(null);
  const [commission, setCommission] = useState("0");
  /* The currency the commission is *entered* in. Write-only: the server
     converts to PKR once and stores that, so it never comes back on a read —
     and it is independent of the sale's own currency. */
  const [commissionCurrency, setCommissionCurrency] = useState<CommissionCurrency>("PKR");
  const [commissionError, setCommissionError] = useState("");
  // LOCAL accounts are PKR-only; INTERNATIONAL ones take any currency.
  const isLocalAccount = bankAccount?.accountType === "LOCAL";
  const currencyOptions = isLocalAccount
    ? transactionCurrenciesForAccountType("LOCAL")
    : CURRENCIES;
  const [error, setError] = useState("");
  const [refIdError, setRefIdError] = useState("");
  const [clientError, setClientError] = useState("");
  const [bankError, setBankError] = useState("");
  const [saving, setSaving] = useState(false);

  // Opened from the picker's "Create <term>" row.
  const [createClientName, setCreateClientName] = useState<string | null>(null);
  // Same flow for a first-time employee: typing a name offers "Create <term>"
  // rather than forcing a trip to the Employees page mid-sale.
  const [createEmployeeName, setCreateEmployeeName] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setClient(null);
    setCurrency("USD");
    setAmount("0");
    setSaleDate(todayDateInputValue());
    setRefId("");
    setDescription("");
    setBankAccount(null);
    setEmployee(null);
    setCommission("0");
    setCommissionCurrency("PKR");
    setCreateEmployeeName(null);
    setError("");
    setRefIdError("");
    setClientError("");
    setBankError("");
    setCommissionError("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      // Let a nested create-client modal handle Escape first.
      if (
        event.key === "Escape" &&
        createClientName === null &&
        createEmployeeName === null
      ) {
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose, createClientName, createEmployeeName]);

  if (!isOpen) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setRefIdError("");
    setClientError("");
    setBankError("");
    setCommissionError("");

    if (!client) {
      setClientError("Select a client.");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setError("Enter a sale amount of zero or more.");
      return;
    }
    if (!saleDate) {
      setError("Select a sale date.");
      return;
    }
    if (!bankAccount) {
      setBankError("Select the bank account this sale posts to.");
      return;
    }
    if (!refId.trim()) {
      setRefIdError("Reference ID is required.");
      return;
    }
    const numericCommission = Number(commission);
    if (employee && (!Number.isFinite(numericCommission) || numericCommission < 0)) {
      setCommissionError("Enter a commission of zero or more.");
      return;
    }

    setSaving(true);
    try {
      await createTransaction({
        clientId: client.id,
        bankAccountId: bankAccount.id,
        refId: refId.trim(),
        saleAmount: numericAmount,
        // The user's choice, not the account's own currency: an INTERNATIONAL
        // account takes any currency now. Only LOCAL is still pinned to PKR,
        // which the picker enforces below.
        currency,
        saleDate: fromDateInputValue(saleDate),
        description: description.trim() || undefined,
        // Both or neither — sending just one is a 422.
        ...(employee
          ? {
              employeeId: employee.id,
              commissionAmount: numericCommission,
              commissionCurrency,
            }
          : {}),
      });
      toast.success("Sale recorded");
      onClose();
    } catch (err) {
      const { message, code } = parseApiError(err);
      // 409 is always a duplicate refId; 404 means the client or bank account
      // vanished mid-flow.
      if (code === "CONFLICT") {
        setRefIdError("This reference ID is already used.");
      } else if (code === "NOT_FOUND") {
        if (message.toLowerCase().includes("bank")) {
          setBankError("This bank account no longer exists. Pick another.");
          setBankAccount(null);
        } else {
          setClientError("This client no longer exists. Pick another.");
          setClient(null);
        }
      } else {
        setError(message || "Couldn't record the sale.");
      }
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-sale-title"
      >
        <button
          type="button"
          aria-label="Close add sale"
          onClick={onClose}
          className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
        />
        {/* Capped at the viewport with the field area as the only scrolling
            region, so the header and Save button stay reachable however many
            fields the form grows to. */}
        <form
          onSubmit={submit}
          className="relative z-10 flex max-h-[calc(100vh-4rem)] w-full max-w-[448px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 p-6 pb-4 dark:border-gray-800">
            <h2
              id="add-sale-title"
              className="text-base font-semibold text-gray-900 dark:text-gray-100"
            >
              Add Sale
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Sale Information
          </p>

          <div className="mt-3">
            <ClientPicker
              autoFocus
              value={client}
              onChange={(next) => {
                setClient(next);
                setClientError("");
              }}
              onCreateRequest={setCreateClientName}
              error={clientError}
            />
          </div>

          <div className="mt-3">
            <BankAccountPicker
              value={bankAccount}
              onChange={(next) => {
                setBankAccount(next);
                // A LOCAL account only accepts PKR, so pin it. An
                // INTERNATIONAL one takes any currency — keep whatever the
                // user already picked rather than overwriting their choice.
                if (next?.accountType === "LOCAL") setCurrency(LOCAL_CURRENCY);
                setBankError("");
              }}
              error={bankError}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Currency
              <AccountingSelect
                label="Currency"
                value={currency}
                // A LOCAL account is PKR-only (a hard 400 otherwise), so offer
                // just that. INTERNATIONAL accounts are currency-agnostic —
                // Whop can take an HKD or AED sale — so offer everything.
                options={currencyOptions.map((code) => ({
                  value: code,
                  label: code,
                }))}
                onChange={(next) => setCurrency(next as Currency)}
                disabled={isLocalAccount}
              />
              {isLocalAccount && (
                <span className="mt-1 block text-[11px] font-normal text-gray-400">
                  {bankAccount?.bankName} is a local account (PKR only)
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Sale Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                // A default of "0" would otherwise force the user to delete it
                // before typing — or leave them with "0500". Clearing on focus
                // makes the field behave like the empty placeholder it looks
                // like; leaving it blank restores the zero on the way out.
                onFocus={() => {
                  if (Number(amount) === 0) setAmount("");
                }}
                onBlur={() => {
                  if (amount.trim() === "") setAmount("0");
                }}
                placeholder="0"
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal text-gray-700 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Sale Date
              <SingleDateField
                value={saleDate}
                max={todayDateInputValue()}
                onChange={setSaleDate}
              />
            </div>
          </div>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Commission <span className="normal-case text-gray-400">(optional)</span>
          </p>
          <div className="mt-3">
            <EmployeePicker
              onCreateRequest={setCreateEmployeeName}
              value={employee}
              onChange={(next) => {
                setEmployee(next);
                // The pair is enforced server-side; dropping the employee has
                // to drop the amount with it.
                if (!next) {
                  setCommission("0");
                  setCommissionError("");
                }
              }}
            />
          </div>
          {employee && (
            <>
            <div className="mt-3 grid grid-cols-[1fr_7rem] items-end gap-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
              Commission
              <input
                type="number"
                min="0"
                step="0.01"
                value={commission}
                onChange={(event) => {
                  setCommission(event.target.value);
                  setCommissionError("");
                }}
                // Same as the sale amount above: a literal "0" sitting in the
                // field would have to be deleted first, or become "0500".
                onFocus={() => {
                  if (Number(commission) === 0) setCommission("");
                }}
                onBlur={() => {
                  if (commission.trim() === "") setCommission("0");
                }}
                placeholder="0"
                className={`mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:bg-gray-800 dark:text-gray-100 ${
                  commissionError ? "border-red-400" : "border-gray-200 dark:border-gray-700"
                }`}
              />
              {commissionError && (
                <span role="alert" className="mt-1 block text-xs font-normal text-red-500">
                  {commissionError}
                </span>
              )}
            </label>
            {/* Converted to PKR on save — the stored figure is always PKR, so
                this only says what the number above is denominated in. */}
            <AccountingSelect
              label="Currency"
              value={commissionCurrency}
              options={COMMISSION_CURRENCIES.map((code) => ({ value: code, label: code }))}
              onChange={(next) => setCommissionCurrency(next as CommissionCurrency)}
            />
            </div>
            <p className="mt-1 text-[11px] font-normal text-gray-400">
              Added to this employee&apos;s pending commission. Editing the sale
              later adjusts it by the difference.
            </p>
            </>
          )}

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Reference Information
          </p>
          <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Reference ID
            <input
              value={refId}
              onChange={(event) => {
                setRefId(event.target.value);
                setRefIdError("");
              }}
              placeholder="e.g. REF-VP-0119"
              className={`mt-1.5 h-10 w-full rounded-lg border bg-white px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:bg-gray-800 dark:text-gray-100 ${
                refIdError ? "border-red-400" : "border-gray-200 dark:border-gray-700"
              }`}
            />
            {refIdError && (
              <span role="alert" className="mt-1 block text-xs font-normal text-red-500">
                {refIdError}
              </span>
            )}
          </label>
          <label className="mt-3 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="add description...."
              className="mt-1.5 h-20 w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          </div>

          <div className="shrink-0 border-t border-gray-100 p-6 pt-4 dark:border-gray-800">
            {error && (
              <p role="alert" className="mb-3 text-sm text-red-500">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
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
                {saving ? "Saving..." : "Save Sale"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <CreateClientModal
        isOpen={createClientName !== null}
        initialName={createClientName ?? ""}
        onClose={() => setCreateClientName(null)}
        onCreated={(created) => {
          // Auto-select so the accountant can carry straight on with the sale.
          setClient({ id: created.id, clientName: created.clientName });
          setClientError("");
          setCreateClientName(null);
        }}
      />
      <EmployeeFormModal
        isOpen={createEmployeeName !== null}
        initialName={createEmployeeName ?? ""}
        onClose={() => setCreateEmployeeName(null)}
        onSaved={(created) => {
          // Auto-select so the sale can carry straight on.
          setEmployee({ id: created.id, name: created.name });
          setCreateEmployeeName(null);
        }}
      />
    </>,
    document.body
  );
}
