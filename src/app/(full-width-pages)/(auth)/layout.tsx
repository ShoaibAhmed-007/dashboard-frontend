"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSignIn = pathname === "/signin";

  return (
    <div className="relative min-h-screen bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 sm:px-10 sm:py-6 shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo/logo.svg"
            alt="Dashboard"
            width={160}
            height={36}
          />
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:inline">
            {isSignIn ? "Don't have an account?" : "Already playing with ClickUp?"}
          </span>
          <Link
            href={isSignIn ? "/signup" : "/signin"}
            className="group relative inline-flex min-h-10 min-w-[78px] items-center justify-center px-5 py-2 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-2.5 -bottom-2 h-4 rounded-full bg-brand-500/40 blur-md transition-opacity duration-200 group-hover:opacity-100"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-[11px] bg-linear-to-b from-brand-400 via-brand-500 to-brand-600 shadow-[0_7px_16px_rgba(70,95,255,0.2)]"
            />
            <span className="relative">
              {isSignIn ? "Sign up" : "Login"}
            </span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4">
        {children}
      </main>

      {/* Bottom gradient background */}
      <div className="absolute bottom-0 left-0 right-0 z-0">
        <Image
          src="/images/auth/bg_22.svg"
          alt=""
          width={1440}
          height={530}
          className="w-full h-auto"
          priority
        />
      </div>

      {/* Bottom "Don't have an account" text for signin */}
      {isSignIn && (
        <div className="absolute bottom-8 left-0 right-0 z-10 text-center">
          <p className="text-sm text-white/80">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-normal text-white underline hover:text-white/90"
            >
              Sign up
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
