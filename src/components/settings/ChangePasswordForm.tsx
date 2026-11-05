"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { api, parseApiError } from "@/lib/api";

const PASSWORD_RULES = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a number")
  .regex(/[^A-Za-z0-9]/, "Must contain a special character");

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: PASSWORD_RULES,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordForm() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await api.patch("/user/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      toast.success("Password changed. Please log in again.");
      reset();
      setTimeout(() => { window.location.replace("/signin"); }, 1500);
    } catch (err) {
      toast.error(parseApiError(err).message);
    }
  };

  return (
    <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      {/* Left label */}
      <div className="w-full lg:w-56 shrink-0">
        <h3 className="text-sm font-normal text-gray-800 dark:text-white/90">Password</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Change your account password. You will be signed out after changing.
        </p>
      </div>

      {/* Right form */}
      <div className="flex-1 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-6">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-5">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  placeholder="Enter current password"
                  error={!!errors.currentPassword}
                  hint={errors.currentPassword?.message}
                  {...register("currentPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-3 text-sm font-normal text-gray-500 hover:text-gray-700"
                >
                  {showCurrent ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  placeholder="Enter new password"
                  error={!!errors.newPassword}
                  hint={errors.newPassword?.message ?? "Min 8 chars, uppercase, lowercase, number, special char"}
                  {...register("newPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-3 text-sm font-normal text-gray-500 hover:text-gray-700"
                >
                  {showNew ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                error={!!errors.confirmPassword}
                hint={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-normal text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
