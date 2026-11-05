"use client";

import Image from "next/image";
import { useRef, useState, KeyboardEvent, ClipboardEvent } from "react";

interface OtpVerifyFormProps {
  email?: string;
  /** External error message — shown below the OTP inputs (e.g. "Invalid OTP") */
  error?: string | null;
  onVerify?: (otp: string) => Promise<void>;
  onResend?: () => Promise<void>;
  onBack?: () => void;
  showResend?: boolean;
}

export default function OtpVerifyForm({
  email = "uiscreensweb@gmail.com",
  error,
  onVerify,
  onResend,
  onBack,
  showResend = true,
}: OtpVerifyFormProps) {
  const OTP_LENGTH = 6;
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(OTP_LENGTH).fill(null));

  const focusNext = (index: number) => {
    if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const focusPrev = (index: number) => {
    if (index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit) focusNext(index);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else {
        focusPrev(index);
      }
    } else if (e.key === "ArrowLeft") {
      focusPrev(index);
    } else if (e.key === "ArrowRight") {
      focusNext(index);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const lastFilled = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[lastFilled]?.focus();
  };

  const handleSubmit = async () => {
    const otp = digits.join("");
    if (otp.length < OTP_LENGTH) return;
    setIsSubmitting(true);
    try {
      await onVerify?.(otp);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!onResend) return;
    setIsResending(true);
    // Clear digits so user starts fresh with the new code
    setDigits(Array(OTP_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
    try {
      await onResend();
    } finally {
      setIsResending(false);
    }
  };

  const isComplete = digits.every((d) => d !== "");
  const hasError = !!error;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-2xl bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08),0_4px_20px_rgba(0,0,0,0.08)] p-8 sm:p-10">
        <h1 className="text-center text-2xl font-normal text-gray-900 mb-6">
          Check your email
        </h1>

        {/* Composite email icon */}
        <div className="flex justify-center mb-6">
          <div className="relative w-[108px] h-[122px]">
            <Image
              src="/images/auth/email.svg"
              alt="Email"
              width={108}
              height={122}
              priority
            />
            <div className="absolute inset-0 flex items-center justify-center pb-4">
              <Image
                src="/images/auth/slogo.svg"
                alt="Dashboard"
                width={40}
                height={40}
                priority
              />
            </div>
          </div>
        </div>

        {/* Copy */}
        <p className="text-center text-[15px] font-normal text-gray-900 mb-1">
          We just emailed you.
        </p>
        <p className="text-center text-sm text-gray-400 mb-1">
          Please enter the code we emailed you:
        </p>
        <p className="text-center text-sm text-gray-700 font-normal mb-1">
          {email}
        </p>
        <p className="text-center text-xs text-gray-400 mb-6">
          Confirmation code
        </p>

        {/* OTP inputs */}
        <div className="flex justify-center gap-3 mb-2">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={[
                "w-11 h-11 rounded-lg border text-center text-lg font-normal text-gray-900 outline-none transition-colors caret-transparent",
                hasError
                  ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                  : "border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
              ].join(" ")}
            />
          ))}
        </div>

        {/* Inline error */}
        {hasError && (
          <p className="text-center text-xs text-red-500 mb-4">{error}</p>
        )}
        {!hasError && <div className="mb-4" />}

        {/* Verify button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isComplete || isSubmitting}
          className="flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-normal text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Verifying..." : "Verify"}
        </button>

        {/* Resend / Back */}
        {(showResend || onBack) && (
          <p className="mt-4 text-center text-sm text-gray-400">
            {showResend && (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="text-brand-500 hover:text-brand-600 font-normal disabled:opacity-60"
              >
                {isResending ? "Sending..." : "Resend code"}
              </button>
            )}
            {showResend && onBack && " or "}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="text-brand-500 hover:text-brand-600 font-normal"
              >
                Go back
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
