"use client";

import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

interface ForgotPasswordFormProps {
  onSubmit?: (email: string) => Promise<void>;
  isSuccess?: boolean;
}

export default function ForgotPasswordForm({
  onSubmit,
  isSuccess = false,
}: ForgotPasswordFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const submit = async (values: FormValues) => {
    // Let the error propagate so react-hook-form keeps isSubmitting=false on failure
    await onSubmit?.(values.email);
  };

  return (
    /* Full-screen radial gradient: purple top-center → white bottom */
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, #c4b5fd 0%, #e9d5ff 30%, #f5f0ff 55%, #ffffff 80%)",
      }}
    >
      {/* Card — no card border, content sits directly on gradient */}
      <div className="flex flex-col items-center w-full max-w-sm px-6">

        {/* Logo */}
        <div className="mb-7">
          <Image
            src="/images/auth/slogo.svg"
            alt="Dashboard"
            width={64}
            height={64}
            priority
          />
        </div>

        {isSuccess ? (
          <>
            <h1 className="text-[30px] font-normal text-gray-900 text-center mb-2 leading-none">
              Recovery link sent!
            </h1>
            <p className="text-sm text-gray-400 text-center">
              Remember password?{" "}
              <Link
                href="/signin"
                className="text-brand-500 font-normal hover:text-brand-600"
              >
                Sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            {/* Heading */}
            <h1 className="text-[22px] font-normal text-gray-900 text-center mb-2">
              Forgot your password?
            </h1>

            {/* Sub-heading */}
            <p className="text-sm text-gray-400 text-center mb-6">
              Remember password?{" "}
              <Link
                href="/signin"
                className="text-brand-500 font-normal hover:text-brand-600"
              >
                Sign in
              </Link>
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit(submit)} noValidate className="w-full space-y-3">
              {/* Email input */}
              <div>
                <input
                  type="email"
                  placeholder="Sufian@example.com"
                  {...register("email")}
                  className={[
                    "w-full rounded-lg border px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 outline-none transition-colors",
                    "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
                    errors.email
                      ? "border-red-400"
                      : "border-gray-300",
                  ].join(" ")}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-normal text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Sending…" : "Send me the link"}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Need help? — pinned to bottom */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-sm text-gray-400">
          Need help?
        </p>
      </div>
    </div>
  );
}
