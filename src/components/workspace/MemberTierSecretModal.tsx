"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { LuSparkles, LuLoader, LuEye, LuEyeOff, LuKeyRound, LuCoins } from "react-icons/lu";
import { workspaceService, type AiModelTier, type WorkspaceMember } from "@/services/workspace.service";
import { parseApiError } from "@/lib/api";

interface MemberTierSecretModalProps {
  isOpen: boolean;
  member: WorkspaceMember | null;
  targetTier: AiModelTier;
  workspaceId: string;
  onClose: () => void;
  onConfirmed: (tier: AiModelTier) => void;
}

const DEFAULT_TOKEN_LIMIT = 1_000_000;
/** Weekly allowance presets. Floor mirrors the backend's TOKEN_LIMIT_MIN. */
const TOKEN_LIMIT_MIN = 150_000;
const TOKEN_PRESETS = [500_000, 1_000_000, 5_000_000];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/** Maps the backend's typed error codes onto messages shown next to the input. */
function messageForCode(code: string | null, fallback: string): string {
  switch (code) {
    case "TIER_SECRET_INVALID":
      return "That secret key is not correct.";
    case "TIER_TOO_MANY_ATTEMPTS":
      return "Too many failed attempts. Try again in 15 minutes.";
    case "TIER_SECRET_NOT_CONFIGURED":
      return "No secret key is configured on the server. Contact your administrator.";
    case "TIER_MEMBER_NOT_FOUND":
      return "This member is no longer part of the workspace.";
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

export default function MemberTierSecretModal({
  isOpen,
  member,
  targetTier,
  workspaceId,
  onClose,
  onConfirmed,
}: MemberTierSecretModalProps) {
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedOut, setLockedOut] = useState(false);
  /** "secret" for both directions; upgrades then advance to "tokens". */
  const [step, setStep] = useState<"secret" | "tokens">("secret");
  const [tokenLimit, setTokenLimit] = useState(String(DEFAULT_TOKEN_LIMIT));
  const [quote, setQuote] = useState<{ minCostUsd: number; maxCostUsd: number } | null>(null);

  const isUpgrade = targetTier === "PREMIUM";
  const parsedLimit = Number.parseInt(tokenLimit.replace(/[,\s]/g, ""), 10);
  const limitValid = Number.isInteger(parsedLimit) && parsedLimit >= TOKEN_LIMIT_MIN;

  const handleClose = () => {
    if (loading) return;
    setSecret("");
    setError(null);
    setShowSecret(false);
    setLockedOut(false);
    setStep("secret");
    setTokenLimit(String(DEFAULT_TOKEN_LIMIT));
    setQuote(null);
    onClose();
  };

  // Live cost bounds for the amount being typed. Debounced so a fast typist
  // does not fire a request per keystroke.
  useEffect(() => {
    if (step !== "tokens" || !limitValid) {
      setQuote(null);
      return;
    }
    const timer = setTimeout(() => {
      workspaceService
        .getTokenCostQuote(parsedLimit)
        .then((q) => setQuote({ minCostUsd: q.minCostUsd, maxCostUsd: q.maxCostUsd }))
        // Advisory only — a failed quote must not block the assignment.
        .catch(() => setQuote(null));
    }, 350);
    return () => clearTimeout(timer);
  }, [step, parsedLimit, limitValid]);

  /** Step 1: verify the secret by performing the tier change. */
  const handleSecretSubmit = async () => {
    if (!member || !secret.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      await workspaceService.changeMemberTier(workspaceId, member.id, targetTier, secret);

      // Downgrades are done; upgrades continue to the allowance step. The secret
      // is kept in state so step 2 can reuse it without re-prompting.
      if (!isUpgrade) {
        onConfirmed(targetTier);
        handleClose();
        return;
      }
      setStep("tokens");
    } catch (err) {
      const code = extractCode(err);
      setError(messageForCode(code, parseApiError(err).message));
      // A lockout is time-based, so keep the form disabled rather than
      // inviting more attempts that are guaranteed to fail.
      if (code === "TIER_TOO_MANY_ATTEMPTS") setLockedOut(true);
    } finally {
      setLoading(false);
    }
  };

  /** Step 2: assign the weekly token allowance. */
  const handleTokenSubmit = async () => {
    if (!member || !limitValid || loading) return;
    setLoading(true);
    setError(null);

    try {
      await workspaceService.setTokenAllowance(workspaceId, member.id, parsedLimit, secret);
      onConfirmed(targetTier);
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
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isUpgrade
              ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          <LuSparkles className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {isUpgrade ? "Upgrade to Dashboard Premium" : "Downgrade to Standard"}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isUpgrade ? (
              <>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {member?.fullName}
                </span>{" "}
                will use the premium AI model in this workspace.
              </>
            ) : (
              <>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {member?.fullName}
                </span>{" "}
                will go back to the standard AI model in this workspace.
              </>
            )}
          </p>
        </div>
      </div>

      {step === "secret" ? (
      <div className="mt-5">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
          <LuKeyRound className="h-3.5 w-3.5 text-gray-400" />
          Secret key
        </label>
        <div className="relative">
          <input
            type={showSecret ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSecretSubmit();
            }}
            placeholder="Enter the secret key"
            disabled={loading || lockedOut}
            autoFocus
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
        {error ? (
          <p className="mt-1.5 text-xs text-red-500">{error}</p>
        ) : (
          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            Changing a member&apos;s AI tier requires the workspace secret key.
          </p>
        )}
      </div>
      ) : (
      <div className="mt-5">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
          <LuCoins className="h-3.5 w-3.5 text-gray-400" />
          Weekly token allowance
        </label>

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
          onKeyDown={(e) => {
            if (e.key === "Enter") handleTokenSubmit();
          }}
          disabled={loading}
          autoFocus
          className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors
            bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400
            focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
            ${error ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}
            disabled:opacity-60`}
        />

        {error ? (
          <p className="mt-1.5 text-xs text-red-500">{error}</p>
        ) : (
          <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/60">
            {/* Worst case is the headline: the admin's real question is "what is
                the most this can cost me?". The range explains why one number
                cannot be honest — input and output bill at different rates. */}
            {quote && limitValid ? (
              <>
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                  up to ${quote.maxCostUsd.toFixed(2)} per week
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  ≈ ${quote.minCostUsd.toFixed(2)}–${quote.maxCostUsd.toFixed(2)} depending on the
                  input/output mix
                </p>
              </>
            ) : (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {limitValid
                  ? "Calculating cost…"
                  : `Minimum ${(TOKEN_LIMIT_MIN / 1000).toFixed(0)}k tokens — one reply can use up to 128k`}
              </p>
            )}
          </div>
        )}
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          Resets every Monday. Replies are never cut off mid-answer, so a week can
          run up to ~128k over the limit.
        </p>
      </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {isUpgrade ? `Step ${step === "secret" ? 1 : 2} of 2` : ""}
        </span>
        <div className="flex gap-2">
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
            onClick={step === "secret" ? handleSecretSubmit : handleTokenSubmit}
            disabled={
              loading ||
              (step === "secret" ? lockedOut || !secret.trim() : !limitValid)
            }
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading && <LuLoader className="h-4 w-4 animate-spin" />}
            {step === "tokens" ? "Assign tokens" : isUpgrade ? "Continue" : "Downgrade"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
