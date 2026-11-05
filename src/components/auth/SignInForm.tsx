"use client";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useAuth } from "@/context/AuthContext";
import { parseApiError } from "@/lib/api";
import { useVerificationStore } from "@/stores/verification.store";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type SignInValues = z.infer<typeof signInSchema>;

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3020/api/v1";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const setPendingVerification = useVerificationStore((s) => s.setPending);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (values: SignInValues) => {
    try {
      await login(values.email, values.password);
      toast.success("Welcome back!");

      const redirectTo = searchParams.get("from");
      const safeRedirect =
        redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : "/university";
      window.location.replace(safeRedirect);
    } catch (err) {
      const { message, code, details } = parseApiError(err);

      if (details?.length) {
        details.forEach(({ field, message: msg }) => {
          if (field === "email" || field === "password") {
            setError(field as "email" | "password", { message: msg });
          }
        });
      }

      if (code === "FORBIDDEN") {
        const fallbackFullName = values.email.split("@")[0]?.replace(/[._-]+/g, " ") || "User";
        setPendingVerification({
          fullName: fallbackFullName,
          email: values.email,
          password: values.password,
        });
        toast.error("Please verify your email with OTP before logging in.");
        router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
        return;
      }

      toast.error(message);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-2xl bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08),0_4px_20px_rgba(0,0,0,0.08)] p-8 sm:p-10">
        <h1 className="text-center text-2xl font-normal text-gray-900 mb-6">
          Welcome back!
        </h1>

        {/* Google Sign In */}
        <button
          type="button"
          onClick={() => { window.location.href = `${API_URL}/auth/google`; }}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-normal text-gray-700 transition-colors hover:bg-gray-50"
        >
          <Image src="/images/brand/google.svg" alt="Google" width={20} height={20} />
          Sign in with Google
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
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="password" className="mb-0">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-normal text-brand-500 hover:text-brand-600"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  error={!!errors.password}
                  hint={errors.password?.message}
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

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-normal text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Signing in..." : "Log In"}
            </button>
          </div>
        </form>

        {/* SSO Link */}
        <div className="mt-4 text-center">
          <Link href="#" className="text-sm font-normal text-brand-500 hover:text-brand-600">
            or login with SSO
          </Link>
        </div>
      </div>
    </div>
  );
}
