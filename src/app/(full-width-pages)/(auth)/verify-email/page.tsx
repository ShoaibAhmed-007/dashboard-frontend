"use client";

import OtpVerifyForm from "@/components/auth/OtpVerifyForm";
import { useAuth } from "@/context/AuthContext";
import { api, parseApiError } from "@/lib/api";
import { useVerificationStore } from "@/stores/verification.store";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [otpError, setOtpError] = useState<string | null>(null);
  const { verifyEmail } = useAuth();
  const pendingVerification = useVerificationStore((s) => s.pending);
  const clearPendingVerification = useVerificationStore((s) => s.clearPending);
  const hasAutoSentRef = useRef(false);
  const canResend =
    !!pendingVerification &&
    pendingVerification.email.toLowerCase() === email.toLowerCase();

  useEffect(() => {
    if (!email) router.replace("/signin");
  }, [email, router]);

  useEffect(() => {
    if (hasAutoSentRef.current || !canResend || !pendingVerification) return;
    hasAutoSentRef.current = true;

    api
      .post<{ message: string }>("/auth/register", pendingVerification)
      .then((res) => {
        toast.success(
          res.data.message || "A fresh OTP has been sent to your email."
        );
      })
      .catch((err) => {
        const { message } = parseApiError(err);
        toast.error(message);
      });
  }, [canResend, pendingVerification]);

  if (!email) return null;

  const handleVerify = async (otp: string) => {
    setOtpError(null);
    try {
      await verifyEmail(email, otp);
      clearPendingVerification();
      toast.success("Email verified successfully.");
    } catch (err) {
      const { message, code } = parseApiError(err);
      if (code === "UNAUTHORIZED") {
        setOtpError("Invalid or expired OTP. Please try again.");
        return;
      }
      setOtpError(message);
    }
  };

  const handleResend = async () => {
    if (!canResend || !pendingVerification) {
      toast.error("Please sign in again to request a new OTP.");
      return;
    }
    const { data } = await api.post<{ message: string }>(
      "/auth/register",
      pendingVerification
    );
    setOtpError(null);
    toast.success(data.message || "A new OTP has been sent to your email.");
  };

  return (
    <OtpVerifyForm
      email={email}
      error={otpError}
      onVerify={handleVerify}
      onResend={canResend ? handleResend : undefined}
      onBack={() => {
        clearPendingVerification();
        router.replace("/signin");
      }}
      showResend={canResend}
    />
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
