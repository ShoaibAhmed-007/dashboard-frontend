"use client";

import { useState } from "react";
import { toast } from "sonner";

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

export default function Notifications() {
  const [email, setEmail] = useState({
    courseAssignment: true,
    dueDateReminders: true,
    certificateIssued: true,
    weeklyDigest: false,
    newCourseAnnouncements: false,
  });
  const [inApp, setInApp] = useState({
    inAppAlerts: true,
    browserPush: false,
    learningStreak: true,
  });

  const save = () => toast.success("Notification preferences saved.");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2a6 6 0 0 0-6 6v3l-2 3h16l-2-3V8a6 6 0 0 0-6-6z" stroke="#7C3AED" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M8 16a2 2 0 0 0 4 0" stroke="#7C3AED" strokeWidth="1.8"/>
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Choose when and how you hear from LearnSpace</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Email Notifications</h3>
        <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700">
          {[
            {
              key: "courseAssignment" as const,
              label: "Course assignment notifications",
              sub: "When a manager assigns you a new course",
            },
            {
              key: "dueDateReminders" as const,
              label: "Assignment due date reminders",
              sub: "7 days and 1 day before a course deadline",
            },
            {
              key: "certificateIssued" as const,
              label: "Certificate issued",
              sub: "When you earn a new certificate",
            },
            {
              key: "weeklyDigest" as const,
              label: "Weekly learning digest",
              sub: "A Monday summary of your progress and new courses",
            },
            {
              key: "newCourseAnnouncements" as const,
              label: "New course announcements",
              sub: "When relevant new courses are added to the library",
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3.5">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.sub}</p>
              </div>
              <Toggle
                enabled={email[item.key]}
                onChange={() => setEmail({ ...email, [item.key]: !email[item.key] })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">In-App & Push Notifications</h3>
        <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700">
          {[
            {
              key: "inAppAlerts" as const,
              label: "In-app alerts",
              sub: "Show notifications inside the platform",
            },
            {
              key: "browserPush" as const,
              label: "Browser push notifications",
              sub: "Get notified even when LearnSpace isn't open",
            },
            {
              key: "learningStreak" as const,
              label: "Learning streak reminders",
              sub: "Daily nudge to keep your learning streak alive",
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3.5">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.sub}</p>
              </div>
              <Toggle
                enabled={inApp[item.key]}
                onChange={() => setInApp({ ...inApp, [item.key]: !inApp[item.key] })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          className="rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}
