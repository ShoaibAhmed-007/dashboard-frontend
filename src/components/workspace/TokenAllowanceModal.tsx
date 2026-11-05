"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { LuCoins, LuLoader, LuRotateCcw, LuEye, LuEyeOff } from "react-icons/lu";
import {
  workspaceService,
  type TokenQuotaStatus,
  type WorkspaceMember,
} from "@/services/workspace.service";
import { parseApiError } from "@/lib/api";

interface TokenAllowanceModalProps {
  isOpen: boolean;
  member: WorkspaceMember | null;
  mode: "edit" | "reset";
  workspaceId: string;
  currentQuota?: TokenQuotaStatus;
  onClose: () => void;
  onSaved: (quota: TokenQuotaStatus) => void;
}

/** Weekly allowance presets. Floor mirrors the backend's TOKEN_LIMIT_MIN. */
const TOKEN_LIMIT_MIN = 150_000;
const TOKEN_PRESETS = [500_000, 1_000_000, 5_000_000];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function messageForCode(code: string | null, fallback: string): string {
  switch (code) {
    case "TIER_SECRET_INVALID":
      return "That secret key is not correct.";
    case "TIER_TOO_MANY_ATTEMPTS":
      return "Too many failed attempts. Try again in 15 minutes.";
    case "TIER_SECRET_NOT_CONFIGURED":
      return "No secret key is configured on the server. Contact your administrator.";
    case "TOKEN_LIMIT_INVALID":
      return `Enter at least ${TOKEN_LIMIT_MIN.toLocaleString()} tokens.`;
    default:
      return fallback;
  }
}

function extractCode(error: unknown): string | null {
  const err = error as { response?: { data?: unknown } } | null;
  const payload = (err?.response?.data ?? error) as
    | { message?: { code?: string }; code?: string }
    | null;
  return payload?.message?.code ?? payload?.code ?? null;
}

export default function TokenAllowanceModal({
  isOpen,
  member,
  mode,
  workspaceId,
  currentQuota,
  onClose,
  onSaved,
}: TokenAllowanceModalProps) {
  const [tokenLimit, setTokenLimit] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ minCostUsd: number; maxCostUsd: number } | null>(null);

  const isEdit = mode === "edit";
  const parsedLimit = Number.parseInt(tokenLimit.replace(/[,\s]/g, ""), 10);
  const limitValid = Number.isInteger(parsedLimit) && parsedLimit >= TOKEN_LIMIT_MIN;

  // Seed the field with the member's existing limit when the modal opens.
  useEffect(() => {
    if (isOpen && isEdit) setTokenLimit(String(currentQuota?.tokenLimit ?? 1_000_000));
  }, [isOpen, isEdit, currentQuota?.tokenLimit]);

  useEffect(() => {
    if (!isEdit || !limitValid) {
      setQuote(null);
      return;
    }
    const timer = setTimeout(() => {
      workspaceService
        .getTokenCostQuote(parsedLimit)
        .then((q) => setQuote({ minCostUsd: q.minCostUsd, maxCostUsd: q.maxCostUsd }))
        .catch(() => setQuote(null));
    }, 350);
    return () => clearTimeout(timer);
  }, [isEdit, parsedLimit, limitValid]);

  const handleClose = () => {
    if (loading) return;
    setSecret("");
    setShowSecret(false);
    setError(null);
    setQuote(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!member || !secret.trim() || loading) return;
    if (isEdit && !limitValid) return;
    setLoading(true);
    setError(null);

    try {
      const quota = isEdit
        ? await workspaceService.setTokenAllowance(workspaceId, member.id, parsedLimit, secret)
        : await workspaceService.resetTokenAllowance(workspaceId, member.id, secret);
      onSaved(quota);
      handleClose();
    } catch (err) {
      setError(messageForCode(extractCode(err), parseApiError(err).message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-md p-6 border border-gray-200 dark:border-gray-700"
      backdropClassName="fixed inset-0 h-full w-full bg-white/30 backdrop-blur-[2px] dark:bg-black/65"
      closeButtonClassName="absolute right-2 top-2 z-999 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          {isEdit ? <LuCoins className="h-5 w-5" /> : <LuRotateCcw className="h-5 w-5" />}
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {isEdit ? "Edit token limit" : "Reset tokens now"}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isEdit ? (
              <>
                Set the weekly allowance for{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {member?.fullName}
                </span>
                . Usage so far is kept.
              </>
            ) : (
              <>
                Clear this week&apos;s usage for{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {member?.fullName}
                </span>
                , restoring premium access immediately.
              </>
            )}
          </p>
        </div>
      </div>

      {isEdit && (
        <div className="mt-5">
          <div className="mb-2 flex gap-1.5">
            {TOKEN_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTokenLimit(String(preset))}
                disabled={loading}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                  parsedLimit === preset
                    ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                {formatTokens(preset)}
              </button>
            ))}
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={tokenLimit}
            onChange={(e) => setTokenLimit(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          {quote && limitValid && (
            <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/60">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                up to ${quote.maxCostUsd.toFixed(2)} per week
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                ≈ ${quote.minCostUsd.toFixed(2)}–${quote.maxCostUsd.toFixed(2)} depending on the
                input/output mix
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
          Secret key
        </label>
        <div className="relative">
          <input
            type={showSecret ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="Enter the secret key"
            disabled={loading}
            autoComplete="off"
            className={`w-full rounded-xl border px-4 py-2.5 pr-11 text-sm outline-none transition-colors
              bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400
              focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
              ${error ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}
              disabled:opacity-60`}
          />
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showSecret ? <LuEyeOff className="h-4 w-4" /> : <LuEye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleClose}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !secret.trim() || (isEdit && !limitValid)}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading && <LuLoader className="h-4 w-4 animate-spin" />}
          {isEdit ? "Save limit" : "Reset now"}
        </button>
      </div>
    </Modal>
  );
}
