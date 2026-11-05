"use client";

import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { parseApiError } from "@/lib/api";
import {
  WorkspaceInvitePreview,
  workspaceService,
} from "@/services/workspace.service";
import { useAuthStore } from "@/stores/auth.store";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const claimInviteSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must be less than 100 characters"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type ClaimInviteValues = z.infer<typeof claimInviteSchema>;

interface ClaimInviteCardProps {
  preview: WorkspaceInvitePreview;
  token: string;
  isSubmitting: boolean;
  onSubmit: (values: ClaimInviteValues) => Promise<void>;
}

function ClaimInviteCard({
  preview,
  token,
  isSubmitting,
  onSubmit,
}: ClaimInviteCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const signInHref = useMemo(
    () => `/signin?from=${encodeURIComponent(`/invite?token=${token}`)}`,
    [token]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClaimInviteValues>({
    resolver: zodResolver(claimInviteSchema),
    defaultValues: {
      fullName: "",
      password: "",
      confirmPassword: "",
    },
  });

  return (
    <div>
      <p className="text-xs font-normal uppercase tracking-wide text-brand-600 dark:text-brand-400">
        New invitee
      </p>
      <h1 className="mt-2 text-2xl font-normal text-gray-900 dark:text-white">
        Set up your account to join {preview.workspaceName}
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        This invitation is for <span className="font-normal">{preview.invitedEmail}</span>.
      </p>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/40">
        <p className="text-gray-700 dark:text-gray-200">
          <span className="font-normal">Invited by:</span> {preview.inviterName}
        </p>
        <p className="mt-1 text-gray-700 dark:text-gray-200">
          <span className="font-normal">Workspace role:</span> {preview.role}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3" noValidate>
        <div>
          <input
            type="text"
            placeholder="Full name"
            {...register("fullName")}
            className={[
              "w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors dark:bg-gray-950 dark:text-gray-100",
              "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
              errors.fullName ? "border-red-500" : "border-gray-300 dark:border-gray-700",
            ].join(" ")}
          />
          {errors.fullName && (
            <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Create password"
              {...register("password")}
              className={[
                "w-full rounded-lg border px-3 py-2.5 pr-14 text-sm text-gray-900 outline-none transition-colors dark:bg-gray-950 dark:text-gray-100",
                "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                errors.password ? "border-red-500" : "border-gray-300 dark:border-gray-700",
              ].join(" ")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-normal text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        <div>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm password"
              {...register("confirmPassword")}
              className={[
                "w-full rounded-lg border px-3 py-2.5 pr-14 text-sm text-gray-900 outline-none transition-colors dark:bg-gray-950 dark:text-gray-100",
                "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                errors.confirmPassword
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-700",
              ].join(" ")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-normal text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-normal text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Accepting invitation..." : "Accept invitation"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{" "}
        <Link
          href={signInHref}
          className="font-normal text-brand-500 hover:text-brand-600"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

interface ExistingInviteCardProps {
  preview: WorkspaceInvitePreview;
  isAuthenticated: boolean;
  authLoading: boolean;
  accepting: boolean;
  currentUserEmail?: string;
  onAccept: () => Promise<void>;
}

function ExistingInviteCard({
  preview,
  isAuthenticated,
  authLoading,
  accepting,
  currentUserEmail,
  onAccept,
}: ExistingInviteCardProps) {
  const isEmailMismatch =
    !!currentUserEmail &&
    currentUserEmail.toLowerCase() !== preview.invitedEmail.toLowerCase();

  return (
    <div>
      <p className="text-xs font-normal uppercase tracking-wide text-brand-600 dark:text-brand-400">
        Existing account
      </p>
      <h1 className="mt-2 text-2xl font-normal text-gray-900 dark:text-white">
        You are invited to join {preview.workspaceName}
      </h1>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800/40">
        <p className="text-gray-700 dark:text-gray-200">
          <span className="font-normal">Invited by:</span> {preview.inviterName}
        </p>
        <p className="mt-1 text-gray-700 dark:text-gray-200">
          <span className="font-normal">Invited email:</span> {preview.invitedEmail}
        </p>
        <p className="mt-1 text-gray-700 dark:text-gray-200">
          <span className="font-normal">Role:</span> {preview.role}
        </p>
      </div>

      {isAuthenticated && currentUserEmail && (
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
          Signed in as <span className="font-normal">{currentUserEmail}</span>
        </p>
      )}

      {isEmailMismatch && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          This invite is for a different email. Please sign in with the invited
          email to accept.
        </p>
      )}

      {!isAuthenticated && !authLoading && (
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
          Please sign in with <span className="font-normal">{preview.invitedEmail}</span>{" "}
          to accept this invitation.
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          void onAccept();
        }}
        disabled={accepting || authLoading}
        className="mt-6 inline-flex rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-normal text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {accepting
          ? "Accepting..."
          : isAuthenticated
            ? "Accept invitation"
            : "Sign in to accept"}
      </button>
    </div>
  );
}

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { refetch, switchWorkspace } = useWorkspace();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [preview, setPreview] = useState<WorkspaceInvitePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const signInHref = useMemo(
    () => `/signin?from=${encodeURIComponent(`/invite?token=${token}`)}`,
    [token]
  );

  useEffect(() => {
    if (!token) {
      setPreviewError("Invalid invite link.");
      setLoadingPreview(false);
      return;
    }

    setLoadingPreview(true);
    setPreviewError(null);

    workspaceService
      .previewInvite(token)
      .then((data) => setPreview(data))
      .catch((error) => {
        const { message } = parseApiError(error);
        setPreviewError(message || "This invite link is invalid or expired.");
      })
      .finally(() => setLoadingPreview(false));
  }, [token]);

  useEffect(() => {
    if (!preview || preview.nextStep !== "login") return;
    if (authLoading || isAuthenticated) return;
    router.replace(signInHref);
  }, [authLoading, isAuthenticated, preview, router, signInHref]);

  const handleClaimInvite = async (values: ClaimInviteValues) => {
    if (!token) return;

    setClaiming(true);
    try {
      const claimed = await workspaceService.claimInvite({
        token,
        fullName: values.fullName,
        password: values.password,
      });

      setAuth(claimed.accessToken, claimed.user);
      await refetch();
      switchWorkspace(claimed.workspaceId);

      toast.success("Invitation accepted successfully.");
      router.replace("/");
    } catch (error) {
      const { message, code } = parseApiError(error);

      if (code === "CONFLICT") {
        toast.error("This email already has an account. Please sign in to continue.");
        router.replace(signInHref);
        return;
      }

      toast.error(message);
    } finally {
      setClaiming(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!token) return;

    if (!isAuthenticated) {
      router.replace(signInHref);
      return;
    }

    setAccepting(true);
    try {
      const { workspaceId } = await workspaceService.acceptInvite(token);
      await refetch();
      switchWorkspace(workspaceId);
      toast.success("Invite accepted successfully.");
      router.replace("/");
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, #c4b5fd 0%, #e9d5ff 30%, #f5f0ff 55%, #ffffff 80%)",
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-7 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        {loadingPreview ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Loading invite details...
            </p>
          </div>
        ) : previewError ? (
          <div>
            <h1 className="text-2xl font-normal text-gray-900 dark:text-white">
              Invitation unavailable
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {previewError}
            </p>
            <div className="mt-6">
              <Link
                href="/signin"
                className="inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-normal text-white hover:bg-brand-600"
              >
                Go to sign in
              </Link>
            </div>
          </div>
        ) : preview?.nextStep === "claim_account" ? (
          <ClaimInviteCard
            preview={preview}
            token={token}
            isSubmitting={claiming}
            onSubmit={handleClaimInvite}
          />
        ) : !isAuthenticated && !authLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Redirecting to sign in...
            </p>
          </div>
        ) : (
          <ExistingInviteCard
            preview={preview!}
            isAuthenticated={isAuthenticated}
            authLoading={authLoading}
            accepting={accepting}
            currentUserEmail={user?.email}
            onAccept={handleAcceptInvite}
          />
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteContent />
    </Suspense>
  );
}
