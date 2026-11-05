"use client";

import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { api, parseApiError } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  // Guard: token is required from reset link
  if (!token) {
    router.replace("/forgot-password");
    return null;
  }

  const handleSubmit = async (newPassword: string) => {
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      toast.success("Password reset! Please sign in with your new password.");
      // reset-password logs out all sessions server-side, so hard-navigate to signin
      window.location.replace("/signin");
    } catch (err) {
      const { message } = parseApiError(err);
      // 401 = invalid / expired / already-used reset token
      const isTokenError =
        (err as { response?: { status?: number } })?.response?.status === 401;

      if (isTokenError) {
        toast.error("This reset link is invalid or expired. Request a new one.");
        router.replace("/forgot-password");
        return;
      }

      toast.error(message);
      throw err; // keeps react-hook-form isSubmitting=false for other errors
    }
  };

  return <ResetPasswordForm onSubmit={handleSubmit} />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
