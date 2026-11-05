"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Upload,
  Download,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  MoreHorizontal,
  X,
  User,
  Briefcase,
} from "lucide-react";

/* ============================================================================
 * DUMMY DATA  (kept in the same file as requested)
 * ==========================================================================*/

const STATUS_TABS = [
  { key: "all", label: "All", count: 248 },
  { key: "active", label: "Active", count: 212 },
  { key: "probation", label: "Probation", count: 23 },
  { key: "notice", label: "Notice", count: 6 },
  { key: "pre-join", label: "Pre-join", count: 7 },
];

const DEPARTMENTS = [
  "Engineering",
  "HR",
  "Finance",
  "Marketing",
  "Sales",
  "Operations",
  "Design",
  "Product",
  "QA",
];
const LOCATIONS = ["Lahore HQ", "Karachi", "Islamabad", "Remote"];
const GRADES = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"];
const EMPLOYMENT_TYPES = ["Permanent", "Contract", "Part-time", "Intern"];
const MANAGERS = [
  "Usman Tariq",
  "Ayesha Khan",
  "Adeel Ilyas",
  "Bilal Ahmed",
  "Sara Malik",
  "Faisal Iqbal",
];
const GENDERS = ["Male", "Female", "Other"];
const EMPLOYEE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "probation", label: "Probation" },
  { value: "notice", label: "Notice" },
  { value: "pre-join", label: "Pre-join" },
];

// avatarColor per-employee (matches screenshot tints)
const EMPLOYEES = [
  {
    id: "EMP-0187",
    name: "John Doe",
    avatar: "AL",
    avatarTint: "emerald",
    department: "Engineering",
    position: "Senior Backend Engineer",
    manager: "Usman Tariq",
    location: "Lahore HQ",
    type: "Permanent",
    grade: "G7",
    status: "active",
  },
  {
    id: "EMP-0192",
    name: "Sami Khan",
    avatar: "SK",
    avatarTint: "emerald",
    department: "Design",
    position: "UI Designer",
    manager: "Ayesha Khan",
    location: "Lahore HQ",
    type: "Permanent",
    grade: "G5",
    status: "active",
  },
  {
    id: "EMP-0211",
    name: "Vicky Djoulako",
    avatar: "VD",
    avatarTint: "emerald",
    department: "Product",
    position: "Project Manager",
    manager: "Adeel Ilyas",
    location: "Karachi",
    type: "Permanent",
    grade: "G6",
    status: "probation",
  },
  {
    id: "EMP-0215",
    name: "Isaac Fomo",
    avatar: "IF",
    avatarTint: "blue",
    department: "Engineering",
    position: "Developer",
    manager: "Usman Tariq",
    location: "Remote",
    type: "Contract",
    grade: "G4",
    status: "probation",
  },
  {
    id: "EMP-0102",
    name: "Nde Michael",
    avatar: "NM",
    avatarTint: "violet",
    department: "Sales",
    position: "Account Executive",
    manager: "Bilal Ahmed",
    location: "Islamabad",
    type: "Permanent",
    grade: "G5",
    status: "notice",
  },
  {
    id: "EMP-0143",
    name: "Yvan Ndeme",
    avatar: "YN",
    avatarTint: "emerald",
    department: "QA",
    position: "Automation Tester",
    manager: "Sara Malik",
    location: "Lahore HQ",
    type: "Permanent",
    grade: "G5",
    status: "active",
  },
  {
    id: "EMP-0230",
    name: "Nida Shah",
    avatar: "NS",
    avatarTint: "violet",
    department: "Operations",
    position: "Ops Coordinator",
    manager: "Faisal Iqbal",
    location: "Karachi",
    type: "Permanent",
    grade: "G4",
    status: "active",
  },
  {
    id: "EMP-0249",
    name: "Hamza Raza",
    avatar: "HR",
    avatarTint: "violet",
    department: "Engineering",
    position: "QA Engineer",
    manager: "Usman Tariq",
    location: "Lahore HQ",
    type: "Permanent",
    grade: "G5",
    status: "pre-join",
  },
  {
    id: "EMP-0078",
    name: "Zara Ahmed",
    avatar: "ZA",
    avatarTint: "emerald",
    department: "Finance",
    position: "Finance Manager",
    manager: "Adeel Ilyas",
    location: "Lahore HQ",
    type: "Permanent",
    grade: "G8",
    status: "active",
  },
  {
    id: "EMP-0061",
    name: "Omar Siddiqui",
    avatar: "OS",
    avatarTint: "gray",
    department: "HR",
    position: "HR Business Partner",
    manager: "Adeel Ilyas",
    location: "Islamabad",
    type: "Permanent",
    grade: "G7",
    status: "separated",
  },
];

const TOTAL_EMPLOYEES = 248;
const TOTAL_PAGES = 25;
const PAGE_SIZE = 10;

/* ============================================================================
 * STYLE MAPS
 * ==========================================================================*/

const STATUS_STYLES = {
  active: {
    wrap: "bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
  },
  probation: {
    wrap: "bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  notice: {
    wrap: "bg-rose-50 text-rose-800",
    dot: "bg-rose-500",
  },
  "pre-join": {
    wrap: "bg-blue-50 text-blue-800",
    dot: "bg-blue-500",
  },
  separated: {
    wrap: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
  },
};

const STATUS_LABELS = {
  active: "Active",
  probation: "Probation",
  notice: "Notice",
  "pre-join": "Pre-join",
  separated: "Separated",
};

const DEPARTMENT_DOT = {
  Engineering: "bg-violet-500",
  HR: "bg-rose-500",
  Finance: "bg-emerald-500",
  Marketing: "bg-amber-500",
  Sales: "bg-blue-500",
  Operations: "bg-teal-500",
  Design: "bg-pink-500",
  Product: "bg-violet-500",
  QA: "bg-orange-500",
};

const AVATAR_TINTS = {
  emerald: "bg-emerald-100 text-emerald-800",
  blue: "bg-blue-100 text-blue-800",
  violet: "bg-violet-100 text-violet-800",
  gray: "bg-gray-100 text-gray-600",
};

const AVATAR_TINT_SWATCHES = [
  { key: "emerald", cls: "bg-emerald-500", ring: "ring-emerald-500" },
  { key: "blue", cls: "bg-blue-500", ring: "ring-blue-500" },
  { key: "violet", cls: "bg-violet-500", ring: "ring-violet-500" },
  { key: "gray", cls: "bg-gray-400", ring: "ring-gray-400" },
];

/* ============================================================================
 * SMALL PRESENTATIONAL COMPONENTS
 * ==========================================================================*/

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.separated;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${s.wrap}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function Avatar({ initials, tint }) {
  const cls = AVATAR_TINTS[tint] || AVATAR_TINTS.gray;
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${cls}`}
    >
      {initials}
    </span>
  );
}

/* ============================================================================
 * INTERACTIVE COMPONENTS
 * ==========================================================================*/

function FilterDropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition hover:bg-gray-50"
      >
        <span className="text-gray-500">{label}:</span>
        <span className=" text-gray-800">{value === "all" ? "All" : value}</span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              All
              {value === "all" && <span className="text-emerald-600">✓</span>}
            </button>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                {opt}
                {value === opt && <span className="text-emerald-600">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatusTab({ tab, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border p-1.5 text-sm transition-colors ${
        active
          ? "border-[#0D1936] bg-[#0D1936] text-white"
          : "border-[#E2E6EF] bg-white text-[#8995B5] hover:bg-gray-50"
      }`}
    >
      <span className="">
        {tab.label} · {tab.count}
      </span>
    </button>
  );
}

function ActionButton({ children, variant = "outline", onClick, icon: Icon }) {
  const base = "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm transition";
  const variants = {
    primary: "bg-gray-900 text-white hover:bg-gray-800",
    outline:
      "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    ghost: "text-gray-600 hover:bg-gray-100",
  };
  return (
    <button onClick={onClick} className={`${base} ${variants[variant]}`}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* ============================================================================
 * TABLE + PAGINATION
 * ==========================================================================*/

function EmployeesTable({ rows }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto ">
      <table className="w-full bg-gray-100 border-separate p-2 text-sm">
        <thead>
          <tr className="bg-white p-1 text-gray-900">
            {[
              "Employee",
              "Department / Role",
              "Manager",
              "Location",
              "Type",
              "Grade",
              "Status",
              "",
            ].map((heading, index) => (
              <th
                key={heading || `actions-${index}`}
                className={`border-y border-gray-200 py-3 text-xs font-semibold uppercase ${
                  index === 0
                    ? "rounded-l-[22px] border-l"
                    : index === 7
                    ? "rounded-r-[22px] border-r"
                    : ""
                }`}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="py-12 text-center text-gray-400">
                No employees match the current filters.
              </td>
            </tr>
          )}

          {rows.map((emp) => (
            <tr
              key={emp.id}
              className="group transition-colors hover:bg-white/60"
              onClick={() => {
                router.push(`/hr-management/employees/${emp.id}`);
              }}
              style={{ cursor: "pointer" }}
            >
              <td className="border-b border-gray-200 px-2 py-2">
                <div className="flex items-center gap-3">
                  <Avatar initials={emp.avatar} tint={emp.avatarTint} />
                  <div className="flex flex-col gap-1">
                    <span className="whitespace-nowrap text-base text-[#10203F]">
                      {emp.name}
                    </span>
                    <span className="text-sm text-[#8B98B8]">{emp.id}</span>
                  </div>
                </div>
              </td>

              <td className="border-b border-gray-200 px-2 py-2">
                <div className="flex flex-col gap-1">
                  <span className="text-base  text-[#10203F]">
                    {emp.department}
                  </span>
                  <span className="text-sm text-[#8B98B8]">
                    {emp.position}
                  </span>
                </div>
              </td>

              <td className="whitespace-nowrap border-b border-gray-200 px-2 py-2 text-base text-[#10203F]">
                {emp.manager}
              </td>

              <td className="whitespace-nowrap border-b border-gray-200 px-2 py-2 text-base text-[#10203F]">
                {emp.location}
              </td>

              <td className="whitespace-nowrap border-b border-gray-200 px-2 py-2 text-base text-[#10203F]">
                {emp.type}
              </td>

              <td className="whitespace-nowrap border-b border-gray-200 px-2 py-2 text-base text-[#10203F]">
                {emp.grade}
              </td>

              <td className="border-b border-gray-200 px-2 py-2">
                <StatusBadge status={emp.status} />
              </td>

              <td className="border-b border-gray-200 px-4 py-4 text-right">
                <button
                  type="button"
                  aria-label={`Actions for ${emp.name}`}
                  className="rounded-md p-1 text-lg font-bold tracking-widest text-[#596582] transition hover:bg-gray-200"
                >
                  ···
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ currentPage, totalPages, total, pageSize }) {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  // Build page list: < 1 2 3 ... 25 >
  const pages = [1, 2, 3];
  if (totalPages > 6) pages.push("...");
  pages.push(totalPages);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-6 py-3 text-sm text-gray-500 sm:flex-row">
      <p>
        Showing <span className=" text-gray-800">{start}–{end}</span> of{" "}
        <span className=" text-gray-800">{total}</span> employees
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={currentPage === 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-1 text-gray-400">…</span>
          ) : (
            <button
              key={p}
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition ${
                p === currentPage
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          disabled={currentPage === totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
 * ADD-EMPLOYEE DRAWER + FORM
 * ==========================================================================*/

const inputClass =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

const selectClass = inputClass + " appearance-none bg-white";

function FormField({ label, required, children, hint, full }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 pb-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function AddEmployeeDrawer({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    employeeId: "",
    joinDate: "",
    department: "",
    position: "",
    manager: "",
    location: "",
    type: "",
    grade: "",
    status: "active",
    avatarTint: "emerald",
  });
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  // Auto-compute initials for preview
  const previewInitials =
    (form.firstName?.[0] || "") + (form.lastName?.[0] || "");

  const update = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    // simulate async save
    setTimeout(() => {
      setSubmitting(false);
      onSubmit?.(form);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Add new employee
            </h2>
            <p className="text-xs text-gray-500">
              Fill in the details below to create a new employee record. Fields
              marked <span className="text-rose-500">*</span> are required.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Body — scrollable */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-8 overflow-y-auto px-6 py-5">
            {/* Live preview chip */}
            <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <Avatar
                initials={previewInitials || "?"}
                tint={form.avatarTint}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {form.firstName || form.lastName
                    ? `${form.firstName} ${form.lastName}`.trim()
                    : "New employee"}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {form.position || "Position"} ·{" "}
                  {form.department || "Department"}
                </p>
              </div>
            </div>

            {/* Section 1 — Personal */}
            <section className="space-y-4">
              <SectionHeader
                icon={User}
                title="Personal information"
                subtitle="Basic identity and contact details"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="First name" required>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={update("firstName")}
                    placeholder="e.g. John"
                    className={inputClass}
                    required
                  />
                </FormField>
                <FormField label="Last name" required>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={update("lastName")}
                    placeholder="e.g. Doe"
                    className={inputClass}
                    required
                  />
                </FormField>
                <FormField label="Work email" required>
                  <input
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    placeholder="name@example.com"
                    className={inputClass}
                    required
                  />
                </FormField>
                <FormField label="Mobile number">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={update("phone")}
                    placeholder="+92 300 1234567"
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Date of birth">
                  <input
                    type="date"
                    value={form.dob}
                    onChange={update("dob")}
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Gender">
                  <div className="relative">
                    <select
                      value={form.gender}
                      onChange={update("gender")}
                      className={selectClass}
                    >
                      <option value="">Select gender</option>
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </FormField>
              </div>
            </section>

            {/* Section 2 — Employment */}
            <section className="space-y-4">
              <SectionHeader
                icon={Briefcase}
                title="Employment details"
                subtitle="Organization, role and reporting line"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Employee ID" required hint="e.g. EMP-0250">
                  <input
                    type="text"
                    value={form.employeeId}
                    onChange={update("employeeId")}
                    placeholder="EMP-0250"
                    className={inputClass}
                    required
                  />
                </FormField>
                <FormField label="Joining date" required>
                  <input
                    type="date"
                    value={form.joinDate}
                    onChange={update("joinDate")}
                    className={inputClass}
                    required
                  />
                </FormField>
                <FormField label="Department" required>
                  <div className="relative">
                    <select
                      value={form.department}
                      onChange={update("department")}
                      className={selectClass}
                      required
                    >
                      <option value="">Select department</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </FormField>
                <FormField label="Position / title" required>
                  <input
                    type="text"
                    value={form.position}
                    onChange={update("position")}
                    placeholder="e.g. Senior Backend Engineer"
                    className={inputClass}
                    required
                  />
                </FormField>
                <FormField label="Reports to">
                  <div className="relative">
                    <select
                      value={form.manager}
                      onChange={update("manager")}
                      className={selectClass}
                    >
                      <option value="">Select manager</option>
                      {MANAGERS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </FormField>
                <FormField label="Office location">
                  <div className="relative">
                    <select
                      value={form.location}
                      onChange={update("location")}
                      className={selectClass}
                    >
                      <option value="">Select location</option>
                      {LOCATIONS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </FormField>
                <FormField label="Employment type">
                  <div className="relative">
                    <select
                      value={form.type}
                      onChange={update("type")}
                      className={selectClass}
                    >
                      <option value="">Select type</option>
                      {EMPLOYMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </FormField>
                <FormField label="Grade">
                  <div className="relative">
                    <select
                      value={form.grade}
                      onChange={update("grade")}
                      className={selectClass}
                    >
                      <option value="">Select grade</option>
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </FormField>
                <FormField label="Status" full>
                  <div className="flex flex-wrap gap-2">
                    {EMPLOYEE_STATUSES.map((s) => (
                      <button
                        type="button"
                        key={s.value}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, status: s.value }))
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          form.status === s.value
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            (STATUS_STYLES[s.value] || STATUS_STYLES.separated)
                              .dot
                          }`}
                        />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </FormField>
              </div>
            </section>

            {/* Section 3 — Avatar color */}
            <section className="space-y-4">
              <SectionHeader
                icon={User}
                title="Avatar color"
                subtitle="Pick a tint for the employee's avatar bubble"
              />
              <div className="flex flex-wrap items-center gap-3">
                {AVATAR_TINT_SWATCHES.map((sw) => (
                  <button
                    type="button"
                    key={sw.key}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, avatarTint: sw.key }))
                    }
                    className={`relative h-9 w-9 rounded-full ${sw.cls} transition ${
                      form.avatarTint === sw.key
                        ? `ring-2 ring-offset-2 ${sw.ring}`
                        : "hover:scale-105"
                    }`}
                    aria-label={`Select ${sw.key} color`}
                  >
                    {form.avatarTint === sw.key && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-white">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-4">
            <p className="text-xs text-gray-400">
              A welcome email will be sent on creation.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create employee
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ==========================================================================*/

export default function HREmployeesPage() {
  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [location, setLocation] = useState("all");
  const [grade, setGrade] = useState("all");
  const [empType, setEmpType] = useState("all");
  const [manager, setManager] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    return EMPLOYEES.filter((emp) => {
      if (activeStatus !== "all" && emp.status !== activeStatus) return false;
      if (department !== "all" && emp.department !== department) return false;
      if (location !== "all" && emp.location !== location) return false;
      if (grade !== "all" && emp.grade !== grade) return false;
      if (empType !== "all" && emp.type !== empType) return false;
      if (manager !== "all" && emp.manager !== manager) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          emp.name.toLowerCase().includes(q) ||
          emp.id.toLowerCase().includes(q) ||
          emp.position.toLowerCase().includes(q) ||
          emp.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeStatus, department, location, grade, empType, manager, search]);

  const handleCreate = (formData) => {
    // TODO: replace with API call. For now we just log + (optionally) prepend to a local list.
    console.log("New employee payload:", formData);
    // If you want to push to the EMPLOYEES list at runtime, manage it via useState
    // and prepend the new object here.
  };

  return (
    <div className=" bg-gray-100 px-6 py-6 text-gray-800">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Dashboards</span>
          <span>/</span>
          <span className=" text-gray-600">THIS IS THE HR Employees page</span>
        </div>
      </div>

      {/* Page header */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Employees
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            <span className=" text-gray-700">{TOTAL_EMPLOYEES}</span> employees
            · <span className=" text-gray-700">7</span> departments ·{" "}
            <span className=" text-gray-700">4</span> office locations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton variant="outline" icon={Upload}>
            Import
          </ActionButton>
          <ActionButton variant="outline" icon={Download}>
            Export
          </ActionButton>
          <ActionButton
            variant="primary"
            icon={Plus}
            onClick={() => setDrawerOpen(true)}
          >
            Add employee
          </ActionButton>
        </div>
      </div>

      <div className="mb-3 flex justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1 overflow-x-auto  px-4">
          {STATUS_TABS.map((tab) => (
            <StatusTab
              key={tab.key}
              tab={tab}
              active={activeStatus === tab.key}
              onClick={() => {
                setActiveStatus(tab.key);
                setCurrentPage(1);
              }}
            />
          ))}
        </div>
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by name, ID,"
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 border-b border-gray-200 p-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            label="Department"
            options={DEPARTMENTS}
            value={department}
            onChange={(v) => {
              setDepartment(v);
              setCurrentPage(1);
            }}
          />
          <FilterDropdown
            label="Location"
            options={LOCATIONS}
            value={location}
            onChange={(v) => {
              setLocation(v);
              setCurrentPage(1);
            }}
          />
          <FilterDropdown
            label="Grade"
            options={GRADES}
            value={grade}
            onChange={(v) => {
              setGrade(v);
              setCurrentPage(1);
            }}
          />
          <FilterDropdown
            label="Employment"
            options={EMPLOYMENT_TYPES}
            value={empType}
            onChange={(v) => {
              setEmpType(v);
              setCurrentPage(1);
            }}
          />
          <FilterDropdown
            label="Manager"
            options={MANAGERS}
            value={manager}
            onChange={(v) => {
              setManager(v);
              setCurrentPage(1);
            }}
          />
          <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition hover:bg-gray-50">
            <SlidersHorizontal className="h-4 w-4" />
            More filters
          </button>
        </div>
      </div>

      {/* White card wrapper */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Table */}
        <EmployeesTable rows={filtered} />

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={TOTAL_PAGES}
          total={TOTAL_EMPLOYEES}
          pageSize={PAGE_SIZE}
        />
      </div>

      {/* Add-employee drawer */}
      <AddEmployeeDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
