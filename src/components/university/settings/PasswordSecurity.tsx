"use client";

import { useState } from "react";
import { toast } from "sonner";

interface PasswordStrength {
  label: string;
  check: (p: string) => boolean;
}

const checks: PasswordStrength[] = [
  { label: "Minimum 8 characters", check: (p) => p.length >= 8 },
  { label: "Mix of uppercase and lowercase", check: (p) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
  { label: "Include at least one number", check: (p) => /\d/.test(p) },
  { label: "Include at least one special character (!@#$)", check: (p) => /[!@#$%^&*]/.test(p) },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-[#7C3AED]" : "bg-gray-200 dark:bg-gray-600"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function PasswordSecurity() {
  const [form, setForm] = useState({ current: "", newPass: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [twoFaApp, setTwoFaApp] = useState(false);
  const [smsSms, setSmsSms] = useState(true);

  const update = () => {
    if (!form.current) return toast.error("Enter your current password.");
    if (form.newPass.length < 8) return toast.error("New password must be at least 8 characters.");
    if (form.newPass !== form.confirm) return toast.error("Passwords do not match.");
    toast.success("Password updated successfully.");
    setForm({ current: "", newPass: "", confirm: "" });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="8" width="12" height="10" rx="2" stroke="#7C3AED" strokeWidth="1.8"/>
            <path d="M7 8V6a3 3 0 0 1 6 0v2" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Password & Security</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Keep your account secure with a strong password and 2FA</p>
        </div>
      </div>

      {/* Current password */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current Password</label>
        <div className="relative">
          <input
            type={showCurrent ? "text" : "password"}
            value={form.current}
            onChange={(e) => setForm({ ...form, current: e.target.value })}
            placeholder="Enter current password"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 pr-16 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {showCurrent ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={form.newPass}
              onChange={(e) => setForm({ ...form, newPass: e.target.value })}
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 pr-16 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              {showNew ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm New Password</label>
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            placeholder="Repeat new password"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          />
        </div>
      </div>

      {/* Strength tips */}
      <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4 mb-6">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">Password strength tips</p>
        <div className="space-y-2">
          {checks.map((c) => {
            const passed = c.check(form.newPass);
            return (
              <div key={c.label} className="flex items-center gap-2.5">
                <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded ${passed ? "bg-green-500" : "bg-red-500"}`}>
                  {passed ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">{c.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2FA */}
      <div className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Two-Factor Authentication</h3>
        <div className="space-y-4">
          {[
            {
              label: "Enable 2FA via Authenticator App",
              sub: "Use Google Authenticator or Authy for extra login security",
              value: twoFaApp,
              set: () => setTwoFaApp(!twoFaApp),
            },
            {
              label: "SMS Backup Code",
              sub: "Receive a one-time code via SMS as a fallback",
              value: smsSms,
              set: () => setSmsSms(!smsSms),
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.sub}</p>
              </div>
              <Toggle enabled={item.value} onChange={item.set} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button className="rounded-lg border border-gray-200 dark:border-gray-600 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Cancel
        </button>
        <button
          onClick={update}
          className="rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors"
        >
          Update Password
        </button>
      </div>
    </div>
  );
}
