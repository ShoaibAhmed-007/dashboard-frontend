"use client";

import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { toast } from "sonner";

const DEPARTMENTS = ["Product", "Engineering", "Design", "Marketing", "Sales", "HR", "Finance", "Operations"];

export default function ProfileInfo() {
  const { user } = useAuth();
  const nameParts = user?.fullName?.split(" ") ?? ["Aisha", "Rahman"];
  const [form, setForm] = useState({
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" ") ?? "",
    email: user?.email ?? "aisha.rahman@company.com",
    phone: "+44 7890 123456",
    jobTitle: "Product Manager",
    department: "Product",
    bio: "Product Manager with 6 years of experience in B2B SaaS. Passionate about user research, roadmapping, and building cross-functional teams.",
  });

  const initials = [form.firstName[0], form.lastName[0]].filter(Boolean).join("").toUpperCase();

  const save = () => {
    toast.success("Profile updated successfully.");
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="4" stroke="#7C3AED" strokeWidth="1.8"/>
            <path d="M3 17a7 7 0 0 1 14 0" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Profile Information</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Update your personal details and public profile</p>
        </div>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7C3AED] text-xl font-bold text-white flex-shrink-0">
          {initials || "AR"}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Profile Photo</p>
          <div className="flex gap-2">
            <button className="rounded-lg bg-[#7C3AED] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#6d28d9] transition-colors">
              Upload Photo
            </button>
            <button className="rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Remove
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">First Name</label>
          <input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Last Name</label>
          <input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Work Email</label>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            type="email"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Job Title</label>
          <input
            value={form.jobTitle}
            onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Department</label>
          <select
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          >
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Bio</label>
        <textarea
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] resize-none"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button className="rounded-lg border border-gray-200 dark:border-gray-600 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Cancel
        </button>
        <button
          onClick={save}
          className="rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
