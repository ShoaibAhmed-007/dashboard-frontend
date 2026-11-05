"use client";

import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { api, parseApiError } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (email: string) => {
    try {
      // Response has no body. Backend sends reset link to the email if eligible.
      await api.post("/auth/forgot-password", { email });
      setIsSuccess(true);
    } catch (err) {
      const { message } = parseApiError(err);
      toast.error(message);
      throw err; // keeps react-hook-form isSubmitting=false
    }
  };

  return <ForgotPasswordForm onSubmit={handleSubmit} isSuccess={isSuccess} />;
}
