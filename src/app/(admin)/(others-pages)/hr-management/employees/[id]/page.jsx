"use client";

import { useState } from "react";

/* ----------------------------------------------------------------------------
 * Inline icon set (stroke style, 1.5 width) — drop-in replacements for
 * Heroicons / Phosphor so the file has zero external icon deps.
 * ------------------------------------------------------------------------- */
const Icon = {
  ArrowLeft: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  User: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Mail: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  ),
  Phone: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  ),
  MapPin: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Calendar: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  FileText: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  Transfer: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H8" />
    </svg>
  ),
  Pencil: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  Lock: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Upload: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8 12 3 7 8M12 3v12" />
    </svg>
  ),
  Laptop: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h18v11H3z" />
      <path d="M2 20h20M8 16h8" />
    </svg>
  ),
  Monitor: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  Card: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </svg>
  ),
  More: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  ),
};

/* ----------------------------------------------------------------------------
 * Data — would normally come from your API / database
 * ------------------------------------------------------------------------- */
const employee = {
  name: "John Doe",
  preferredName: "John",
  avatar: "https://i.pravatar.cc/160?img=12",
  status: "Active",
  confirmation: "Confirmed",
  jobLine: "Senior Backend Engineer · Engineering · Grade G7 · Reports to Usman Tariq",
  employeeId: "EMP-0187",
  email: "john.doe@example.com",
  mobile: "+92 300 1234567",
  location: "Lahore HQ",
  joinedOn: "Joined 12 Mar 2023",
  personal: {
    fullName: "John Doe",
    preferredName: "John",
    dob: "14 May 1994",
    gender: "Male",
    personalEmail: "john.doe@example.com",
    mobile: "+92 300 1234567",
    address: "12-B, Gulberg III, Lahore",
    emergency: "Jane Doe · Spouse · +1 555 0100",
  },
  employment: {
    company: "Dashboard Inc.",
    businessUnit: "Product & Technology",
    team: "Engineering · Platform",
    designation: "Senior Backend Engineer",
    family: "Software Engineering · G7",
    type: "Permanent · Full-time",
    manager: "Usman Tariq",
    probation: "12 Mar – 12 Jun 2023 · Confirmed",
  },
  documents: [
    { name: "CNIC copy", category: "Identity", expiry: "22 Aug 2031", status: "Verified" },
    { name: "Employment contract", category: "Contract", expiry: "—", status: "Verified" },
    { name: "Degree certificate", category: "Education", expiry: "—", status: "Pending" },
    { name: "Passport", category: "Identity", expiry: "30 Nov 2026", status: "Expiring soon" },
  ],
  timeline: [
    { color: "emerald", title: "Applied", meta: "REQ-2023-031 · 02 Feb 2023 · via LinkedIn" },
    { color: "emerald", title: "Offer Accepted", meta: "30 Feb 2023" },
    { color: "emerald", title: "Joined & Onboarded", meta: "12 Mar 2023 · 14/14 tasks" },
    { color: "emerald", title: "Probation Confirmed", meta: "12 Jun 2023 · rating 4.1" },
    { color: "blue", title: "Promoted to Senior (G6 → G7)", meta: "01 Jan 2025" },
    { color: "amber", title: "Q3 2026 Review", meta: "In progress · due 20 Oct" },
  ],
  leave: [
    { label: "Annual", used: 8, total: 20, color: "#3B82F6" },
    { label: "Sick", used: 2, total: 8, color: "#F59E0B" },
    { label: "Casual", used: 2, total: 5, color: "#8B5CF6" },
  ],
  assets: [
    { name: 'MacBook Pro 14"', code: "IT-LAP-021", icon: "laptop" },
    { name: 'Dell UltraSharp 27"', code: "IT-MON-014", icon: "monitor" },
    { name: "Access card", code: "ADM-ACC-187", icon: "card" },
  ],
};

const TABS = [
  "Overview",
  "Employment",
  "Documents",
  "Compensation",
  "Attendance",
  "Leave",
  "Assets",
  "Performance",
  "History",
];

/* ----------------------------------------------------------------------------
 * Small UI primitives
 * ------------------------------------------------------------------------- */
function Badge({ tone, children }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    gray: "bg-slate-100 text-slate-600 ring-slate-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Field({ label, value }) {
  return (
    <div className="space-y-1">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function Card({ title, subtitle, action, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * Page
 * ------------------------------------------------------------------------- */
export default function HRSingleEmployeePage() {
  const [activeTab, setActiveTab] = useState("Overview");

  return (
    <div className=" h-screen overflow-y-auto text-slate-900">
      <div className="mx-auto max-w-[1280px] px-6 py-8">
        {/* Breadcrumb / back */}
        <button
          onClick={() => window.history.back()}
          type="button"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <Icon.ArrowLeft className="h-4 w-4" />
          Back to employees
        </button>

        {/* Hero header */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            {/* Left: avatar + identity */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <img
                src={employee.avatar}
                alt={employee.name}
                className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-white shadow"
              />
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">{employee.name}</h1>
                  <Badge tone="green">{employee.status}</Badge>
                  <Badge tone="blue">{employee.confirmation}</Badge>
                </div>
                <p className="text-sm text-slate-600">{employee.jobLine}</p>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon.User className="h-3.5 w-3.5 text-slate-400" />
                    {employee.employeeId}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon.Mail className="h-3.5 w-3.5 text-slate-400" />
                    {employee.email}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon.Phone className="h-3.5 w-3.5 text-slate-400" />
                    {employee.mobile}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon.MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {employee.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon.Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {employee.joinedOn}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                <Icon.FileText className="h-4 w-4" />
                Generate letter
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                <Icon.Transfer className="h-4 w-4" />
                Movement
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800">
                <Icon.Pencil className="h-4 w-4" />
                Edit profile
              </button>

            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-4">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              const isLocked = tab === "Compensation";
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {isLocked && <Icon.Lock className="h-3.5 w-3.5" />}
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main two-column layout */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left column (3/5) */}
          <div className="space-y-6 lg:col-span-3">
            {/* Personal & contact */}
            <Card
              title="Personal & contact"
              subtitle="Editable by employee via ESS · changes routed to HR for approval"
              action={
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                  <Icon.Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              }
            >
              <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
                <Field label="Full name" value={employee.personal.fullName} />
                <Field label="Preferred name" value={employee.personal.preferredName} />
                <Field label="Date of birth" value={employee.personal.dob} />
                <Field label="Gender" value={employee.personal.gender} />
                <Field label="Personal email" value={employee.personal.personalEmail} />
                <Field label="Mobile" value={employee.personal.mobile} />
                <Field label="Address" value={employee.personal.address} />
                <div className="space-y-1 sm:col-span-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Emergency contact</dt>
                  <dd className="text-sm font-medium text-slate-900">{employee.personal.emergency}</dd>
                </div>
              </dl>
            </Card>

            {/* Employment */}
            <Card title="Employment" subtitle="Organization & job data · effective-dated">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
                <Field label="Company" value={employee.employment.company} />
                <Field label="Business unit" value={employee.employment.businessUnit} />
                <Field label="Department / team" value={employee.employment.team} />
                <Field label="Designation" value={employee.employment.designation} />
                <Field label="Job family / grade" value={employee.employment.family} />
                <Field label="Employment type" value={employee.employment.type} />
                <Field label="Line manager" value={employee.employment.manager} />
                <div className="space-y-1 sm:col-span-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Probation</dt>
                  <dd className="text-sm font-medium text-slate-900">{employee.employment.probation}</dd>
                </div>
              </dl>
            </Card>

            {/* Documents */}
            <Card
              title="Documents"
              subtitle="Classified, with expiry dates and verification status"
              action={
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                  <Icon.Upload className="h-3.5 w-3.5" />
                  Upload
                </button>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="pb-3 pr-4 font-semibold">Document</th>
                      <th className="pb-3 pr-4 font-semibold">Category</th>
                      <th className="pb-3 pr-4 font-semibold">Expiry</th>
                      <th className="pb-3 text-right font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {employee.documents.map((doc) => (
                      <tr key={doc.name} className="group transition hover:bg-slate-50/60">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <Icon.FileText className="h-4 w-4 text-slate-400" />
                            <span className="font-medium text-slate-900">{doc.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-600">{doc.category}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">{doc.expiry}</td>
                        <td className="py-3 text-right">
                          {doc.status === "Verified" && (
                            <span className="text-xs font-semibold text-emerald-600">Verified</span>
                          )}
                          {doc.status === "Pending" && (
                            <span className="text-xs font-semibold text-indigo-500">Pending</span>
                          )}
                          {doc.status === "Expiring soon" && <Badge tone="amber">Expiring soon</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right column (2/5) */}
          <div className="space-y-6 lg:col-span-2">
            {/* Lifecycle timeline */}
            <Card title="Lifecycle timeline" subtitle="Single employee record">
              <ol className="relative">
                {employee.timeline.map((item, idx) => {
                  const isLast = idx === employee.timeline.length - 1;
                  const dotClasses = {
                    emerald: "bg-emerald-500 ring-4 ring-emerald-500/15",
                    blue: "bg-blue-500 ring-4 ring-blue-500/15",
                    amber: "bg-amber-500 ring-4 ring-amber-500/15",
                  };
                  return (
                    <li key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                      {/* connector */}
                      {!isLast && (
                        <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" aria-hidden />
                      )}
                      {/* dot */}
                      <span className={`relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full ${dotClasses[item.color]}`} />
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.meta}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {/* Leave balance */}
            <Card title="Leave balance" subtitle="FY 2026 · as of today">
              <div className="space-y-5">
                {employee.leave.map((l) => {
                  const pct = Math.round(((l.total - l.used) / l.total) * 100);
                  const remaining = l.total - l.used;
                  return (
                    <div key={l.label}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{l.label}</span>
                        <span className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-900">{remaining}</span> of {l.total} days left
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: l.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Assigned assets */}
            <Card title="Assigned assets" subtitle="Synced from IT Management">
              <ul className="space-y-3">
                {employee.assets.map((a) => {
                  const AssetIcon =
                    a.icon === "laptop" ? Icon.Laptop : a.icon === "monitor" ? Icon.Monitor : Icon.Card;
                  return (
                    <li
                      key={a.code}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 transition hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                          <AssetIcon className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-medium text-slate-900">{a.name}</span>
                      </div>
                      <span className="font-mono text-xs font-medium text-blue-600">{a.code}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
