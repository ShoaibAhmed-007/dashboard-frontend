"use client";

import { useAuth } from "@/context/AuthContext";
import { hasSessionExists } from "@/stores/auth.store";
import Link from "next/link";
import { useEffect } from "react";

export default function PortalSelectPage() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasSessionExists()) {
      window.location.replace("/signin");
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || (!isAuthenticated && hasSessionExists())) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-[#7C3AED] flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2L3 7v8l8 5 8-5V7L11 2z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M11 2v13M3 7l8 5 8-5" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 text-center">
        Where would you like to go?
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-10 text-center">
        Choose a module to continue
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* University Card */}
        <Link href="/university" className="group">
          <div className="relative rounded-2xl overflow-hidden border-2 border-transparent group-hover:border-[#7C3AED] transition-all duration-200 shadow-md hover:shadow-xl bg-white dark:bg-gray-800 cursor-pointer">
            <div className="h-36 bg-gradient-to-br from-[#3D1A6E] to-[#7C3AED] flex items-center justify-center">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <rect width="56" height="56" rx="16" fill="rgba(255,255,255,0.15)"/>
                <path d="M28 14L12 22v12l16 8 16-8V22L28 14z" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/>
                <path d="M28 14v26M12 22l16 8 16-8" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/>
                <path d="M12 34v4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Dashboard University
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Access courses, track your learning progress, and earn certificates.
              </p>
            </div>
            <div className="px-6 pb-5">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7C3AED] group-hover:gap-2.5 transition-all">
                Go to University
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </div>
          </div>
        </Link>

        {/* Dashboard Card */}
        <Link href="/" className="group">
          <div className="relative rounded-2xl overflow-hidden border-2 border-transparent group-hover:border-brand-500 transition-all duration-200 shadow-md hover:shadow-xl bg-white dark:bg-gray-800 cursor-pointer">
            <div className="h-36 bg-gradient-to-br from-[#1e2d5a] to-brand-500 flex items-center justify-center">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <rect width="56" height="56" rx="16" fill="rgba(255,255,255,0.15)"/>
                <rect x="14" y="14" width="12" height="12" rx="3" fill="white"/>
                <rect x="30" y="14" width="12" height="12" rx="3" fill="white" fillOpacity="0.7"/>
                <rect x="14" y="30" width="12" height="12" rx="3" fill="white" fillOpacity="0.7"/>
                <rect x="30" y="30" width="12" height="12" rx="3" fill="white"/>
              </svg>
            </div>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Dashboard
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage tasks, projects, team collaboration, and workspace tools.
              </p>
            </div>
            <div className="px-6 pb-5">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 group-hover:gap-2.5 transition-all">
                Go to Dashboard
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
