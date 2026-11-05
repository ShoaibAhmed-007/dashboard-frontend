"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import BankAvatar from "@/components/accounts/BankAvatar";
import NameAvatar from "@/components/accounts/NameAvatar";
import { formatIsoDate, formatMoney } from "@/components/accounts/platformMeta";
import {
  LOCAL_CURRENCY,
  type AccountingEmployee,
} from "@/services/accounting.service";

/**
 * Read-only list of the sales one employee earned commission on.
 *
 * Mirrors `ClientTransactionsModal`: the rows come straight off the employee
 * row, since `GET /employees` embeds each employee's sales on every response,
 * so opening this needs no extra request.
 *
 * Unlike the client version, the figure that matters per row is the PKR
 * commission, not the sale amount — the sale is shown alongside it for
 * context. That list is unpaginated server-side, so the body scrolls
 * internally rather than growing the dialog past the viewport.
 */
export default function EmployeeTransactionsModal({
  employee,
  onClose,
}: {
  employee: AccountingEmployee | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!employee) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [employee, onClose]);

  if (!employee) return null;

  const transactions = employee.transactions ?? [];
  const saleCount = employee._count?.transactions ?? transactions.length;

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-transactions-title"
    >
      <button
        type="button"
        aria-label="Close sales"
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <div className="relative z-10 flex max-h-[calc(100vh-4rem)] w-full max-w-[760px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl dark:border dark:border-gray-800 dark:bg-gray-950">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 p-6 pb-4 dark:border-gray-800">
          <div className="flex min-w-0 items-center gap-3">
            <NameAvatar name={employee.name} size={36} />
            <div className="min-w-0">
              <h2
                id="employee-transactions-title"
                className="truncate text-base font-semibold text-gray-900 dark:text-gray-100"
              >
                {employee.name}
              </h2>
              <p className="mt-0.5 text-xs text-gray-400">
                {saleCount} {saleCount === 1 ? "sale" : "sales"}
                {" · "}
                {formatMoney(LOCAL_CURRENCY, employee.totalCommission)} total
                {" · "}
                {formatMoney(LOCAL_CURRENCY, employee.pendingCommission)} pending
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <LuX className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
          {transactions.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              No sales credited to this employee yet.
            </p>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-white dark:bg-gray-950">
                <tr className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-3 text-left font-normal">Reference</th>
                  <th className="px-3 py-2 text-left font-normal">Client</th>
                  <th className="px-3 py-2 text-left font-normal">Bank Account</th>
                  <th className="px-3 py-2 text-left font-normal">Date</th>
                  <th className="px-3 py-2 text-right font-normal">Sale</th>
                  <th className="py-2 pl-3 text-right font-normal">Commission</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-t border-gray-100 dark:border-gray-800/60"
                  >
                    <td className="py-3 pr-3">
                      <p className="truncate text-sm text-gray-800 dark:text-gray-100">
                        {transaction.refId}
                      </p>
                      {transaction.description && (
                        <p
                          className="truncate text-xs text-gray-400"
                          title={transaction.description}
                        >
                          {transaction.description}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="truncate text-xs text-gray-600 dark:text-gray-300">
                        {transaction.clientName}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <BankAvatar
                          bankName={transaction.bankAccount.bankName}
                          logoUrl={transaction.bankAccount.logoUrl}
                          size={22}
                        />
                        <span className="truncate text-xs text-gray-600 dark:text-gray-300">
                          {transaction.bankAccount.bankName}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatIsoDate(transaction.saleDate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-xs text-gray-500 dark:text-gray-400">
                      {formatMoney(transaction.currency, transaction.saleAmount)}
                    </td>
                    {/* Commission is PKR regardless of what the sale settled in. */}
                    <td className="whitespace-nowrap py-3 pl-3 text-right text-sm font-medium text-gray-800 dark:text-gray-100">
                      {formatMoney(LOCAL_CURRENCY, transaction.commissionAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 p-4 text-right dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
