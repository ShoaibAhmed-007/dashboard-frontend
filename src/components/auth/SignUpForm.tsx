"use client";

import OtpVerifyForm from "@/components/auth/OtpVerifyForm";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useAuth } from "@/context/AuthContext";
import { parseApiError } from "@/lib/api";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const signUpSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be less than 100 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
  terms: z.literal<boolean>(true, {
    error: "You must accept the Terms of Service",
  }),
});

type SignUpValues = z.infer<typeof signUpSchema>;
type PendingSignUp = Pick<SignUpValues, "fullName" | "email" | "password">;

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3020/api/v1";

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [pendingSignUp, setPendingSignUp] = useState<PendingSignUp | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const { register: registerUser, verifyEmail } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { terms: false as unknown as true },
  });

  const termsValue = useWatch({ control, name: "terms" });

  const onSubmit = async (values: SignUpValues) => {
    try {
      const message = await registerUser(values.fullName, values.email, values.password);
      setPendingSignUp({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });
      setOtpError(null);
      toast.success(message || "OTP sent to your email. Please verify to continue.");
    } catch (err) {
      const { message, code, details } = parseApiError(err);

      if (details?.length) {
        details.forEach(({ field, message: msg }) => {
          if (field === "fullName" || field === "email" || field === "password") {
            setError(field as "fullName" | "email" | "password", { message: msg });
          }
        });
      }

      if (code === "CONFLICT") {
        toast.error("Email already registered. Try signing in instead.");
        setError("email", { message: "This email is already in use" });
      } else {
        toast.error(message);
      }
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    if (!pendingSignUp) return;
    setOtpError(null);
    try {
      await verifyEmail(pendingSignUp.email, otp);
    } catch (err) {
      const { message, code } = parseApiError(err);
      if (code === "UNAUTHORIZED") {
        setOtpError("Invalid or expired OTP. Please try again.");
        return;
      }
      setOtpError(message);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingSignUp) return;
    try {
      const message = await registerUser(
        pendingSignUp.fullName,
        pendingSignUp.email,
        pendingSignUp.password
      );
      setOtpError(null);
      toast.success(message || "A new OTP has been sent to your email.");
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
    }
  };

  if (pendingSignUp) {
    return (
      <OtpVerifyForm
        email={pendingSignUp.email}
        error={otpError}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        onBack={() => {
          setOtpError(null);
          setPendingSignUp(null);
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-2xl bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08),0_4px_20px_rgba(0,0,0,0.08)] p-8 sm:p-10">
        <h1 className="text-center text-2xl font-normal text-gray-900 mb-6">
          Seconds to sign up!
        </h1>

        {/* Google Sign Up */}
        <button
          type="button"
          onClick={() => { window.location.href = `${API_URL}/auth/google`; }}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-normal text-gray-700 transition-colors hover:bg-gray-50"
        >
          <Image src="/images/brand/google.svg" alt="Google" width={20} height={20} />
          Sign up with Google
        </button>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-4 text-gray-400">OR</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-5">
            {/* Full Name */}
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                error={!!errors.fullName}
                hint={errors.fullName?.message}
                {...register("fullName")}
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                error={!!errors.email}
                hint={errors.email?.message}
                {...register("email")}
              />
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="password">Choose Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  error={!!errors.password}
                  hint={errors.password?.message}
                  className="pr-16"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-sm font-normal text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              {/* Terms checkbox — required */}
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={!!termsValue}
                  onChange={(checked) =>
                    setValue("terms", checked as true, { shouldValidate: true })
                  }
                />
                <div>
                  <p className="text-sm text-gray-500">
                    By checking this box, you agree to our{" "}
                    <Link href="#" className="font-normal text-gray-800 underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="#" className="font-normal text-gray-800 underline">
                      Privacy Policy
                    </Link>
                    , and consent to data transfer, hosting, and processing outside
                    of the EU.
                  </p>
                  {errors.terms && (
                    <p className="mt-1 text-xs text-error-500">
                      {errors.terms.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-normal text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating account..." : "Play with Dashboard"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
