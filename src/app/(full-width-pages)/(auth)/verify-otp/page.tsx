"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

function VerifyOtpContent() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/forgot-password");
  }, [router]);

  return null;
}

export default function VerifyOtpPage() {
  return <VerifyOtpContent />;
}
