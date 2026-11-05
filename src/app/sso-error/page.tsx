"use client";

import GridShape from "@/components/common/GridShape";
import Alert from "@/components/ui/alert/Alert";
import Button from "@/components/ui/button/Button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LuBriefcase } from "react-icons/lu";

const REASON_MESSAGES: Record<string, { title: string; message: string }> = {
  missing_token: {
    title: "Missing Login Token",
    message:
      "We didn't receive a login token from Client Hub. Please try opening Client Hub again.",
  },
  token_expired: {
    title: "Login Link Expired",
    message:
      "This login link has expired. Please go back to the dashboard and open Client Hub again.",
  },
  invalid_issuer: {
    title: "Invalid Login Source",
    message: "This login request didn't come from a trusted source.",
  },
  invalid_audience: {
    title: "Invalid Login Request",
    message: "This login request wasn't intended for this application.",
  },
  missing_claims: {
    title: "Incomplete Login Token",
    message: "The login token we received is missing required information.",
  },
  invalid_signature: {
    title: "Invalid Login Signature",
    message: "We couldn't verify the authenticity of this login request.",
  },
  malformed_token: {
    title: "Invalid Login Token",
    message: "The login token we received was malformed.",
  },
  not_configured: {
    title: "Single Sign-On Not Configured",
    message:
      "Single sign-on isn't configured correctly. Please contact your administrator.",
  },
  user_not_found: {
    title: "Account Not Found",
    message:
      "We couldn't find a matching Client Hub account for this login. Please contact your administrator.",
  },
  replay_detected: {
    title: "Login Link Already Used",
    message:
      "This login link has already been used. Please go back to the dashboard and open Client Hub again.",
  },
  identity_mismatch: {
    title: "Identity Mismatch",
    message:
      "Something doesn't match up with this login request. Please try again or contact support.",
  },
};

const DEFAULT_REASON = {
  title: "Sign-In Error",
  message: "Something went wrong while signing you in to Client Hub.",
};

function SsoErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const { title, message } = (reason && REASON_MESSAGES[reason]) || DEFAULT_REASON;

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden z-1">
      <GridShape />
      <div className="mx-auto w-full max-w-[400px] text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-error-50 dark:bg-error-500/15">
          <LuBriefcase className="h-6 w-6 text-error-500" />
        </div>

        <h1 className="mb-6 font-normal text-gray-800 text-title-md dark:text-white/90">
          Sign-In Error
        </h1>

        <div className="mb-6 text-left">
          <Alert variant="error" title={title} message={message} />
        </div>

        <Link href="/">
          <Button className="w-full">Return to Dashboard</Button>
        </Link>
      </div>

      <p className="absolute text-sm text-center text-gray-500 -translate-x-1/2 bottom-6 left-1/2 dark:text-gray-400">
        &copy; {new Date().getFullYear()} Dashboard
      </p>
    </div>
  );
}

function SsoErrorFallback() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden z-1">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
    </div>
  );
}

export default function SsoErrorPage() {
  return (
    <Suspense fallback={<SsoErrorFallback />}>
      <SsoErrorContent />
    </Suspense>
  );
}
