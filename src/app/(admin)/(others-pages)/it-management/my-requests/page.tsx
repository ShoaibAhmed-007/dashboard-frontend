"use client"; // Next.js App Router — uses hooks

import { useDepartmentOptions } from "@/hooks/useDepartmentOptions";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { itRequestsService } from "@/services/it-management.service";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import {
  departmentLabel,
  IT_REQUEST_HARDWARE_CATEGORIES,
  IT_REQUEST_LOCATION_LABELS,
  IT_REQUEST_LOCATIONS,
  IT_REQUEST_REASON_LABELS,
  IT_REQUEST_REASONS,
  IT_REQUEST_SOFTWARE_CATEGORIES,
  type CreateItRequestPayload,
  type Department,
  type ItRequest,
  type ItRequestAttachment,
  type ItRequestLocation,
  type ItRequestPriority,
  type ItRequestReason,
  type ItRequestStatus,
  type ItRequestType,
  type UpdateItRequestPayload,
} from "@/types/it-management";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Code2,
  FileText,
  Loader2,
  Minus,
  Monitor,
  Pencil,
  Plus,
  Upload,
  X,
} from "lucide-react";

/* ------------------------------ config ------------------------------ */

const OPEN_STATUSES: ItRequestStatus[] = ["REQUESTED", "APPROVED"];
const isOpenStatus = (s: ItRequestStatus) => OPEN_STATUSES.includes(s);

/** Only REQUESTED can still be edited or withdrawn — once an IT manager has
 *  acted on it (anything else), the backend rejects both (403). */
const isEditable = (s: ItRequestStatus) => s === "REQUESTED";

const STATUS_META: Record<ItRequestStatus, { label: string; pill: string }> = {
  REQUESTED: { label: "Requested", pill: "bg-[#FEF3C7] text-[#B45309]" },
  APPROVED: { label: "Approved", pill: "bg-[#DCFCE7] text-[#15803D]" },
  PURCHASED: { label: "Purchased", pill: "bg-[#E5E7EB] text-[#4B5563] dark:bg-gray-700 dark:text-gray-300" },
  DELIVERED: { label: "Delivered", pill: "bg-[#DBEAFE] text-[#1D4ED8]" },
  REJECTED: { label: "Rejected", pill: "bg-[#FEE2E2] text-[#DC2626]" },
  WITHDRAWN: { label: "Withdrawn", pill: "bg-[#F3F4F6] text-[#6B7280] dark:bg-gray-800 dark:text-gray-400" },
};

const PRIORITY_META: Record<ItRequestPriority, { label: string; pill: string }> = {
  HIGH: { label: "High", pill: "bg-[#FEE2E2] text-[#DC2626]" },
  MEDIUM: { label: "Medium", pill: "bg-[#FEF3C7] text-[#B45309]" },
  LOW: { label: "Low", pill: "bg-[#E6F4EA] text-[#137333]" },
};

/** The 4 stages on the card's progress track. REJECTED/WITHDRAWN don't fit
 *  the line so they render as their own banner instead. */
const STAGES: ItRequestStatus[] = ["REQUESTED", "APPROVED", "PURCHASED", "DELIVERED"];
const STAGE_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  PURCHASED: "Purchased",
  DELIVERED: "Delivered",
};

function stageIndexOf(status: ItRequestStatus) {
  if (status === "REQUESTED") return 0;
  const i = STAGES.indexOf(status);
  return i === -1 ? 0 : i;
}

/* --------------------------- wizard config --------------------------- */

const WIZARD_STEPS = [
  { n: 1, label: "Type" },
  { n: 2, label: "Details" },
  { n: 3, label: "Review" },
];

const MAX_JUSTIFICATION = 600;
const MAX_ATTACHMENTS = 5;

const CATEGORIES: Record<ItRequestType, readonly string[]> = {
  HARDWARE: IT_REQUEST_HARDWARE_CATEGORIES,
  SOFTWARE: IT_REQUEST_SOFTWARE_CATEGORIES,
};

const REASON_OPTIONS: Array<{ value: ItRequestReason; label: string }> = IT_REQUEST_REASONS.map((value) => ({
  value,
  label: IT_REQUEST_REASON_LABELS[value],
}));

const PRIORITIES: Array<{ value: ItRequestPriority; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const LOCATION_OPTIONS: Array<{ value: ItRequestLocation; label: string }> = IT_REQUEST_LOCATIONS.map((value) => ({
  value,
  label: IT_REQUEST_LOCATION_LABELS[value],
}));

const SPEC_FIELDS: Record<ItRequestType, Array<{ key: string; label: string; options: string[] }>> = {
  HARDWARE: [
    { key: "operatingSystem", label: "Operating system", options: ["macOS", "Windows 11", "Linux", "No preference"] },
    { key: "memory", label: "Memory", options: ["8 GB", "16 GB", "32 GB", "64 GB", "No preference"] },
    { key: "storage", label: "Storage", options: ["256 GB SSD", "512 GB SSD", "1 TB SSD", "2 TB SSD", "No preference"] },
    { key: "screenSize", label: "Screen size", options: ["13 inch", "14 inch", "16 inch", "No preference"] },
  ],
  SOFTWARE: [
    { key: "licenseType", label: "License type", options: ["Annual subscription", "Monthly subscription", "Perpetual license", "Free tier"] },
    { key: "planTier", label: "Plan / tier", options: ["Basic", "Pro", "Team", "Enterprise"] },
    { key: "platform", label: "Platform", options: ["macOS", "Windows", "Web", "Mobile", "Cross-platform"] },
    { key: "duration", label: "Duration", options: ["3 months", "6 months", "12 months", "24 months"] },
  ],
};

const FORM_COPY: Record<ItRequestType, { title: string; subtitle: string }> = {
  HARDWARE: {
    title: "IT Hardware Request Form",
    subtitle: "Request standard or customized hardware for your daily workplace operations.",
  },
  SOFTWARE: {
    title: "IT Software Request Form",
    subtitle: "Request licenses, subscriptions and software seats for your team.",
  },
};

/* ------------------------------ helpers ------------------------------ */

const todayStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const parseDate = (d: string | number | Date) =>
  typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T00:00:00") : new Date(d);

const fmtDate = (d: string | number | Date) =>
  parseDate(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const money = (n: number) => "$" + Number(n || 0).toLocaleString("en-US");

/** Backend has no human-readable reference code — this is a cosmetic,
 *  client-derived stand-in, not stored anywhere. */
const shortRef = (id: string) => `REQ-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

function relativeTime(iso: string | number, now: number) {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return fmtDate(iso);
}

/* ------------------------------ styles ------------------------------ */

const inputCls =
  "w-full rounded-lg border border-[#E6E8F0] bg-white px-3.5 py-2.5 text-sm text-[#081735] outline-none transition placeholder:text-[#A6ACC6] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-gray-500 dark:[color-scheme:dark]";
const labelCls = "mb-1.5 block text-xs font-medium text-[#535A79] dark:text-gray-400";
const cardCls =
  "rounded-2xl bg-white shadow-[0_1px_2px_rgba(8,23,53,0.04),0_8px_24px_rgba(8,23,53,0.06)] dark:bg-gray-900";
const primaryBtn =
  "rounded-[10px] bg-[#081735] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#132449] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200";
const ghostBtn =
  "rounded-[10px] border border-[#081735] px-5 py-3 text-sm font-medium text-[#081735] transition hover:bg-gray-50 dark:border-white/40 dark:text-white dark:hover:bg-white/10";

/* -------------------------- reusable pieces -------------------------- */

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className={labelCls}>
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

function SelectField<T extends string>({
  label,
  required,
  value,
  onChange,
  options,
  placeholder = "Select…",
}: {
  label: string;
  required?: boolean;
  value: T | "";
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className={`${inputCls} appearance-none pr-9 ${value ? "" : "text-[#A6ACC6] dark:text-gray-500"}`}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-4 py-2 text-[13px] font-medium transition ${selected
          ? "border-[#081735] bg-[#081735] text-white dark:border-white dark:bg-white dark:text-slate-900"
          : "border-[#E6E8F0] bg-white text-[#535A79] hover:border-[#081735]/40 hover:text-[#081735] dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:border-white/30 dark:hover:text-white"
        }`}
    >
      {label}
    </button>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-[#E6E8F0] dark:border-white/10">
      {options.map((opt, i) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition ${i > 0 ? "border-l border-[#E6E8F0] dark:border-white/10" : ""} ${active
                ? "bg-[#081735] text-white dark:bg-white dark:text-slate-900"
                : "bg-white text-[#535A79] hover:bg-gray-50 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/10"
              }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-[#E6E8F0] bg-white dark:border-white/10 dark:bg-white/[0.06]">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Decrease quantity"
        className="px-3 py-2.5 text-slate-500 transition hover:bg-gray-50 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-white/10"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="w-14 border-x border-[#E6E8F0] bg-transparent py-2.5 text-center text-sm text-[#081735] outline-none [appearance:textfield] dark:border-white/10 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
        className="px-3 py-2.5 text-slate-500 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/10"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function WizardStepper({
  step,
  furthest,
  onJump,
}: {
  step: number;
  furthest: number;
  onJump: (step: number) => void;
}) {
  return (
    <div className="relative flex w-[336px] items-start justify-between">
      <div className="absolute left-5 right-5 top-5 h-[1.5px] bg-[#081735]/20 dark:bg-white/15" />
      {WIZARD_STEPS.map((s) => {
        const reachable = s.n <= furthest;
        const active = s.n === step;
        const completed = s.n < step;
        return (
          <button
            key={s.n}
            type="button"
            disabled={!reachable}
            onClick={() => onJump(s.n)}
            className="relative z-10 flex w-10 flex-col items-center gap-2 disabled:cursor-default"
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full border text-base font-semibold transition ${active || completed
                  ? "border-[#081735] bg-[#081735] text-white dark:border-white dark:bg-white dark:text-slate-900"
                  : "border-[#081735]/60 text-[#081735] dark:border-white/30 dark:text-white"
                }`}
            >
              {completed ? <Check className="h-4 w-4" strokeWidth={3} /> : s.n}
            </span>
            <span className={`text-sm ${active ? "font-medium text-[#081735] dark:text-white" : "text-[#535A79] dark:text-gray-400"}`}>
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TypeCard({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-[300px] flex-col items-start gap-4 rounded-2xl p-6 text-left transition sm:w-[332px] ${selected
          ? "bg-white ring-1 ring-[#081735] dark:bg-gray-800 dark:ring-white"
          : "bg-white/50 hover:bg-white dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
        }`}
    >
      <div className="flex w-full items-start justify-between">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#081735] text-[#081735] dark:border-gray-400 dark:text-gray-300">
          <Icon className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${selected ? "bg-[#081735] dark:bg-white" : "bg-black/10 dark:bg-white/10"
            }`}
        >
          {selected && <Check className="h-4 w-4 text-white dark:text-slate-900" strokeWidth={3} />}
        </span>
      </div>
      <div>
        <p className="text-xl font-medium capitalize text-[#081735] dark:text-white">{title}</p>
        <p className="mt-2 text-xs text-[#535A79] dark:text-gray-400">{description}</p>
      </div>
    </button>
  );
}

function ReviewSection({
  label,
  onEdit,
  children,
}: {
  label: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E6E8F0] bg-white px-6 py-5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8F95B2] dark:text-gray-500">{label}</p>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-xs font-semibold text-[#081735] hover:underline dark:text-indigo-300"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/* ========================= FULL-SCREEN WIZARD ========================= */

/** What the wizard collects — matches `CreateItRequestDto`/`UpdateItRequestDto`
 *  field-for-field. `attachments` holds only already-uploaded files (each
 *  went through `itRequestsService.uploadAttachment` before landing here). */
type RequestFormPayload = {
  itemName: string;
  priority: ItRequestPriority;
  quantity: number;
  requestedDate: string;
  cost: number;
  requestType: ItRequestType;
  department?: Department;
  category: string;
  specifications?: Record<string, string>;
  reason?: ItRequestReason;
  businessJustification: string;
  location?: ItRequestLocation;
  attachments?: ItRequestAttachment[];
};

type AttachmentRow = {
  id: string;
  name: string;
  status: "uploading" | "done" | "error";
  url?: string;
  error?: string;
};

/** Rendered in place of the list page — a real screen, not a modal. */
function NewRequestScreen({
  editing,
  existingRequests,
  onClose,
  onSubmit,
  isSaving,
}: {
  /** Non-null when editing an existing (still-REQUESTED) request. */
  editing: ItRequest | null;
  existingRequests: ItRequest[];
  onClose: () => void;
  onSubmit: (payload: RequestFormPayload) => void;
  isSaving: boolean;
}) {
  const [step, setStep] = useState(editing ? 2 : 1);
  const [furthest, setFurthest] = useState(editing ? 3 : 1);

  // "Requested for" is always the request's owner — fetched, never typed.
  const currentUser = useAuthStore((s) => s.user);
  const requestedForName = editing?.requestedBy?.name ?? currentUser?.fullName ?? "";

  const [requestType, setRequestType] = useState<ItRequestType | null>(editing?.requestType ?? null);

  const [department, setDepartment] = useState<Department | "">(editing?.department ?? "");
  // Keeps the request's own (possibly custom) department selectable.
  const departmentOptions = useDepartmentOptions([department, editing?.department]);
  const [category, setCategory] = useState(editing?.category ?? "");
  const [itemName, setItemName] = useState(editing?.itemName ?? "");
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1);
  const [specs, setSpecs] = useState<Record<string, string>>(editing?.specifications ?? {});
  const [reason, setReason] = useState<ItRequestReason | "">(editing?.reason ?? "");
  const [priority, setPriority] = useState<ItRequestPriority>(editing?.priority ?? "MEDIUM");
  const [neededBy, setNeededBy] = useState((editing?.requestedDate ?? "").slice(0, 10) || todayStr());
  const [cost, setCost] = useState<number>(editing?.cost ?? 0);
  const [justification, setJustification] = useState(editing?.businessJustification ?? "");
  const [location, setLocation] = useState<ItRequestLocation>(editing?.location ?? "OFFICE");
  const [attachments, setAttachments] = useState<AttachmentRow[]>(
    (editing?.attachments ?? []).map((a) => ({ id: a.url, name: a.name, status: "done", url: a.url }))
  );
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* Switching type resets the type-specific fields. */
  const pickType = (type: ItRequestType) => {
    setRequestType(type);
    setCategory("");
    setSpecs({});
  };

  const canStep1 = requestType !== null;
  const canStep2 =
    category !== "" &&
    itemName.trim().length > 0 &&
    justification.trim().length > 0 &&
    Boolean(neededBy);
  const attachmentsUploading = attachments.some((a) => a.status === "uploading");

  const goTo = (target: number) => {
    if (target <= furthest) setStep(target);
  };
  const next = () => {
    if (step === 1 && canStep1) {
      setStep(2);
      setFurthest((f) => Math.max(f, 2));
    } else if (step === 2 && canStep2) {
      setStep(3);
      setFurthest((f) => Math.max(f, 3));
    }
  };
  const back = () => setStep((s) => (s === 3 ? 2 : 1));

  const buildPayload = (): RequestFormPayload => ({
    itemName: itemName.trim(),
    priority,
    quantity,
    requestedDate: new Date(neededBy + "T00:00:00").toISOString(),
    cost,
    requestType: requestType!,
    department: department || undefined,
    category,
    specifications: SPEC_FIELDS[requestType!].reduce<Record<string, string>>((acc, f) => {
      if (specs[f.key]) acc[f.key] = specs[f.key];
      return acc;
    }, {}),
    reason: reason || undefined,
    businessJustification: justification.trim(),
    location,
    attachments: attachments
      .filter((a): a is AttachmentRow & { url: string } => a.status === "done" && Boolean(a.url))
      .map((a) => ({ url: a.url, name: a.name })),
  });

  const submit = () => {
    if (!requestType || !canStep2 || isSaving || attachmentsUploading) return;
    onSubmit(buildPayload());
  };

  const addFiles = (fileList: FileList | null | undefined) => {
    const incoming = Array.from(fileList || []).slice(0, Math.max(0, MAX_ATTACHMENTS - attachments.length));
    const rows: AttachmentRow[] = incoming.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      name: file.name,
      status: "uploading",
    }));
    setAttachments((prev) => [...prev, ...rows]);

    rows.forEach((row, i) => {
      const file = incoming[i];
      itRequestsService
        .uploadAttachment(file)
        .then(({ url }) => {
          setAttachments((prev) => prev.map((a) => (a.id === row.id ? { ...a, status: "done", url } : a)));
        })
        .catch((err) => {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === row.id ? { ...a, status: "error", error: parseApiError(err).message || "Upload failed" } : a
            )
          );
        });
    });
  };
  const removeFile = (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  const priorityLabel = (PRIORITIES.find((p) => p.value === priority) || {}).label || priority;
  const specSummary = requestType
    ? SPEC_FIELDS[requestType]
      .map((f) => specs[f.key])
      .filter(Boolean)
      .join(" · ")
    : "";
  const duplicate = (existingRequests || []).find(
    (r) =>
      r.id !== editing?.id &&
      isOpenStatus(r.requestStatus) &&
      r.itemName.toLowerCase() === itemName.trim().toLowerCase()
  );

  const header =
    step === 1
      ? { title: "New Request", subtitle: "Tell us what you need and we'll get it to the right team." }
      : step === 2
        ? {
          title: requestType === "HARDWARE" ? "Hardware request" : "Software request",
          subtitle: editing
            ? "Update the details — you can only do this while your request is still Requested."
            : "Add the details your IT team needs to review this request.",
        }
        : { title: "Review The Request", subtitle: "Double-check everything before it goes to the IT team." };

  // `h-full`, not `h-screen` — see the matching comment on the Employees
  // page's own root div; `h-screen` here spills past AdminLayoutClient's
  // shorter, `overflow-hidden` `<main>` and gets silently clipped.
  return (
    <div className="h-full w-full overflow-y-auto bg-[#EDEFF2] px-4 py-10 dark:bg-gray-950 sm:px-6">
      {/* close — back to the list */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed right-5 top-5 z-20 rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8">
        {/* header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-[29px] font-medium leading-tight text-[#081735] dark:text-white">{header.title}</h1>
          <p className="text-sm font-medium text-[#8F95B2] dark:text-gray-400">{header.subtitle}</p>
        </div>

        <WizardStepper step={step} furthest={furthest} onJump={goTo} />

        {/* step 1 — type */}
        {step === 1 && (
          <div className="flex flex-wrap justify-center gap-[27px]">
            <TypeCard
              icon={Monitor}
              title="Hardware"
              description="Laptops, monitors, peripherals and accessories"
              selected={requestType === "HARDWARE"}
              onSelect={() => pickType("HARDWARE")}
            />
            <TypeCard
              icon={Code2}
              title="Software"
              description="Licenses, subscriptions and software seats"
              selected={requestType === "SOFTWARE"}
              onSelect={() => pickType("SOFTWARE")}
            />
          </div>
        )}

        {/* step 2 — details */}
        {step === 2 && requestType && (
          <div className={`${cardCls} w-full max-w-2xl px-6 py-6 sm:px-8`}>
            <div className="border-b border-[#E6E8F0] pb-4 dark:border-white/10">
              <h3 className="text-lg font-semibold text-[#081735] dark:text-white">{FORM_COPY[requestType].title}</h3>
              <p className="mt-1 text-xs text-[#8F95B2] dark:text-gray-400">{FORM_COPY[requestType].subtitle}</p>
            </div>

            <div className="mt-6 space-y-6">
              {/* requested for + department */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel required>Requested for</FieldLabel>
                  {/* Always the request's owner — fetched, not typed. Never
                      sent in the payload: the server resolves ownership
                      itself. */}
                  <input
                    value={requestedForName}
                    disabled
                    readOnly
                    className={`${inputCls} cursor-not-allowed bg-gray-50 text-[#535A79] dark:bg-white/[0.03] dark:text-gray-400`}
                  />
                </div>
                <SelectField
                  label="Department"
                  value={department}
                  onChange={setDepartment}
                  options={departmentOptions.map((d) => ({ value: d, label: departmentLabel(d) }))}
                  placeholder="Defaults to your own department"
                />
              </div>

              {/* category chips */}
              <div>
                <FieldLabel required>Category</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES[requestType].map((c) => (
                    <Chip key={c} label={c} selected={category === c} onClick={() => setCategory(c)} />
                  ))}
                </div>
              </div>

              {/* item name + quantity */}
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <FieldLabel required>Item name / model preference</FieldLabel>
                  <input
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder={requestType === "HARDWARE" ? "e.g. MacBook Pro 16″" : "e.g. Figma Professional seats"}
                    className={inputCls}
                  />
                </div>
                <div>
                  <FieldLabel>Quantity</FieldLabel>
                  <QuantityStepper value={quantity} onChange={setQuantity} />
                </div>
              </div>

              {/* specifications */}
              <div className="rounded-xl border border-[#E6E8F0] bg-[#FAFBFC] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="mb-3 text-sm font-semibold text-[#081735] dark:text-white">Specifications</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {SPEC_FIELDS[requestType].map((f) => (
                    <SelectField
                      key={f.key}
                      label={f.label}
                      value={specs[f.key] || ""}
                      onChange={(v) => setSpecs((prev) => ({ ...prev, [f.key]: v }))}
                      options={f.options.map((o) => ({ value: o, label: o }))}
                    />
                  ))}
                </div>
              </div>

              {/* reason chips */}
              <div>
                <FieldLabel>Reason</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {REASON_OPTIONS.map((r) => (
                    <Chip key={r.value} label={r.label} selected={reason === r.value} onClick={() => setReason(r.value)} />
                  ))}
                </div>
              </div>

              {/* priority + needed by */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Priority</FieldLabel>
                  <Segmented options={PRIORITIES} value={priority} onChange={setPriority} />
                </div>
                <div>
                  <FieldLabel required>Needed by</FieldLabel>
                  <input type="date" value={neededBy} min={todayStr()} onChange={(e) => setNeededBy(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* estimated cost */}
              {/* <div>
                <FieldLabel>Estimated cost</FieldLabel>
                <input
                  type="number"
                  min={0}
                  value={cost}
                  onChange={(e) => setCost(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  className={inputCls}
                />
              </div> */}

              {/* business justification */}
              <div>
                <FieldLabel required>Business justification</FieldLabel>
                <textarea
                  rows={4}
                  maxLength={MAX_JUSTIFICATION}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explain how this will help you or your work…"
                  className={`${inputCls} resize-none`}
                />
                <p className="mt-1 text-right text-[11px] text-[#8F95B2] dark:text-gray-500">
                  {justification.length}/{MAX_JUSTIFICATION} characters
                </p>
              </div>

              {/* location */}
              <div>
                <FieldLabel>Location</FieldLabel>
                <Segmented options={LOCATION_OPTIONS} value={location} onChange={setLocation} />
              </div>

              {/* attachments */}
              <div>
                <FieldLabel>Attachments</FieldLabel>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <div
                  onClick={() => attachments.length < MAX_ATTACHMENTS && fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    addFiles(e.dataTransfer.files);
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-6 py-8 text-center transition ${dragging
                      ? "border-indigo-400 bg-indigo-50/60 dark:bg-indigo-500/10"
                      : "border-[#D9DCE7] bg-[#FAFBFC] hover:border-[#081735]/40 dark:border-white/15 dark:bg-white/[0.03]"
                    } ${attachments.length >= MAX_ATTACHMENTS ? "pointer-events-none opacity-50" : ""}`}
                >
                  <Upload className="h-5 w-5 text-[#8F95B2]" />
                  <p className="text-sm font-medium text-[#081735] dark:text-white">
                    Drop files here or <span className="text-indigo-500 underline">browse</span>
                  </p>
                  <p className="text-[11px] text-[#8F95B2] dark:text-gray-500">
                    Up to {MAX_ATTACHMENTS} files · PDF, JPEG, PNG or WEBP, 10MB each
                  </p>
                </div>
                {attachments.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {attachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between rounded-lg bg-[#F6F7F9] px-3 py-2 text-xs text-slate-600 dark:bg-white/[0.04] dark:text-gray-300"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {a.status === "uploading" ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="truncate">{a.name}</span>
                          {a.status === "error" && (
                            <span className="shrink-0 text-red-500">{a.error || "Upload failed"}</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(a.id)}
                          className="ml-2 shrink-0 rounded p-0.5 text-slate-400 hover:text-red-500"
                          aria-label={`Remove ${a.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* card footer */}
            <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-[#E6E8F0] pt-5 dark:border-white/10">
              <button type="button" onClick={next} disabled={!canStep2} className={primaryBtn}>
                <span className="inline-flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Continue
                </span>
              </button>
            </div>
          </div>
        )}

        {/* step 3 — review */}
        {step === 3 && requestType && (
          <div className="w-full max-w-2xl space-y-4">
            {duplicate && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-500/10">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Possible duplicate: You already have an open request for a{" "}
                  <span className="font-semibold">{duplicate.itemName}</span> ({shortRef(duplicate.id)}).
                </p>
              </div>
            )}

            <ReviewSection label="Request" onEdit={() => goTo(2)}>
              <p className="text-lg font-semibold text-[#081735] dark:text-white">{itemName || "Untitled request"}</p>
              <p className="mt-1 text-xs text-[#535A79] dark:text-gray-400">
                {requestType === "HARDWARE" ? "Hardware" : "Software"}
                {category ? ` · ${category}` : ""} · Qty {quantity}
                {cost ? ` · ${money(cost)} estimated` : ""}
              </p>
              {department && (
                <p className="mt-1 text-xs text-[#535A79] dark:text-gray-400">
                  Department: {departmentLabel(department)}
                </p>
              )}
            </ReviewSection>

            <ReviewSection label="Specifications" onEdit={() => goTo(2)}>
              <p className="text-sm font-medium text-[#081735] dark:text-white">
                {specSummary || "No specifications selected"}
              </p>
            </ReviewSection>

            <ReviewSection label="Need & Delivery" onEdit={() => goTo(2)}>
              <p className="text-sm font-medium text-[#081735] dark:text-white">
                {reason ? IT_REQUEST_REASON_LABELS[reason] : "No reason selected"} · {priorityLabel} priority
              </p>
              <p className="mt-1 text-xs text-[#535A79] dark:text-gray-400">
                Needed by {fmtDate(neededBy)} · {IT_REQUEST_LOCATION_LABELS[location]}
              </p>
            </ReviewSection>

            {attachments.length > 0 && (
              <ReviewSection label="Attachments" onEdit={() => goTo(2)}>
                <p className="text-sm font-medium text-[#081735] dark:text-white">
                  {attachments.length} file{attachments.length === 1 ? "" : "s"}
                  {attachmentsUploading ? " · uploading…" : ""}
                </p>
              </ReviewSection>
            )}
          </div>
        )}

        {/* wizard footer */}
        <div className="flex w-full max-w-2xl flex-col gap-3">
          <div className="flex items-center justify-between">
            {step === 1 ? (
              <button type="button" onClick={onClose} className={ghostBtn}>
                Cancel
              </button>
            ) : (
              <button type="button" onClick={back} className={ghostBtn}>
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                disabled={step === 1 ? !canStep1 : !canStep2}
                className={primaryBtn}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={isSaving || attachmentsUploading}
                className={`${primaryBtn} inline-flex items-center gap-2`}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
                {isSaving
                  ? "Submitting…"
                  : attachmentsUploading
                    ? "Uploading attachments…"
                    : editing
                      ? "Save Changes"
                      : "Submit Request"}
              </button>
            )}
          </div>
          {step === 2 && !canStep2 && (
            <p className="text-center text-xs text-[#8F95B2] dark:text-gray-500">
              Please fill in the required fields marked with * to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================== LIST CARD ============================== */

function RequestCard({
  req,
  now,
  expanded,
  onToggleExpand,
  onEdit,
  onWithdraw,
}: {
  req: ItRequest;
  now: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onWithdraw: () => void;
}) {
  const Icon = req.requestType === "HARDWARE" ? Monitor : Code2;
  const overdue =
    isOpenStatus(req.requestStatus) && parseDate(req.requestedDate).getTime() < now;
  const stageIdx = stageIndexOf(req.requestStatus);

  // Edit/withdraw are the requester's own actions — an IT manager/OWNER
  // viewing this same list (it isn't self-scoped for them server-side) sees
  // everyone's requests, but only the person who actually created one may
  // touch it. No shared user id to compare client-side, so email is the
  // next-best signal: it's always the account's own email for a
  // self-service request (ItRequestsService.resolveOrCreateSelfEmployee).
  const currentUser = useAuthStore((s) => s.user);
  const isOwnRequest = Boolean(
    currentUser?.email && req.requestedBy?.email?.toLowerCase() === currentUser.email.toLowerCase()
  );
  const canEditOrWithdraw = isEditable(req.requestStatus) && isOwnRequest;

  return (
    <div className={`${cardCls} flex flex-col gap-4 p-6`}>
      {/* head */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#081735]/30 text-[#081735] dark:border-gray-500 dark:text-gray-300">
            <Icon className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-[#8F95B2] dark:text-gray-500">{shortRef(req.id)}</p>
            <p className="truncate text-lg font-semibold text-[#081735] dark:text-white">{req.itemName}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${(PRIORITY_META[req.priority] || {}).pill || ""
            }`}
        >
          {(PRIORITY_META[req.priority] || {}).label || req.priority}
        </span>
      </div>

      {/* meta row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-[11px] text-[#8F95B2] dark:text-gray-500">Status</p>
          <span
            className={`mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${(STATUS_META[req.requestStatus] || {}).pill || ""
              }`}
          >
            {(STATUS_META[req.requestStatus] || {}).label || req.requestStatus}
          </span>
        </div>
        <div>
          <p className="text-[11px] text-[#8F95B2] dark:text-gray-500">Quantity</p>
          <p className="mt-1 text-sm font-semibold text-[#081735] dark:text-white">{req.quantity}</p>
        </div>
        <div>
          <p className="text-[11px] text-[#8F95B2] dark:text-gray-500">Estimated cost</p>
          <p className="mt-1 text-sm font-semibold text-[#081735] dark:text-white">
            {req.cost ? money(req.cost) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#8F95B2] dark:text-gray-500">Needed by</p>
          <p
            className={`mt-1 text-sm font-semibold ${overdue ? "text-[#DC2626]" : "text-[#081735] dark:text-white"
              }`}
          >
            {fmtDate(req.requestedDate)}
            {overdue ? " · Overdue" : ""}
          </p>
        </div>
      </div>

      {/* progress track — rejected/withdrawn get their own banner */}
      {req.requestStatus === "REJECTED" || req.requestStatus === "WITHDRAWN" ? (
        <div className="rounded-xl border border-[#E6E8F0] bg-[#FAFBFC] px-6 py-4 dark:border-white/10 dark:bg-white/[0.03]">
          <p
            className={`text-center text-xs font-semibold ${req.requestStatus === "REJECTED" ? "text-[#DC2626]" : "text-[#6B7280] dark:text-gray-400"
              }`}
          >
            {req.requestStatus === "REJECTED" ? "This request was rejected." : "This request was withdrawn."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E6E8F0] bg-[#FAFBFC] px-6 py-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="relative flex items-center">
            <div className="h-[2px] flex-1 bg-[#E6E8F0] dark:bg-white/10" />
            {STAGES.map((stage, i) => {
              const reached = i <= stageIdx;
              return (
                <div
                  key={stage}
                  className="absolute flex h-4 w-4 items-center justify-center rounded-full"
                  style={{
                    left: `${(i / (STAGES.length - 1)) * 100}%`,
                    transform: "translateX(-50%)",
                    background: reached ? "#081735" : "white",
                    border: reached ? "2px solid #081735" : "2px solid #E6E8F0",
                  }}
                >
                  {reached && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex justify-between">
            {STAGES.map((stage, i) => (
              <span
                key={stage}
                className={`w-16 text-center text-[11px] ${i <= stageIdx
                    ? "font-semibold text-[#081735] dark:text-white"
                    : "text-[#8F95B2] dark:text-gray-500"
                  }`}
              >
                {STAGE_LABELS[stage]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* expanded details */}
      {expanded && (
        <div className="rounded-xl bg-[#F6F7F9] px-4 py-3 text-xs text-[#535A79] dark:bg-white/[0.04] dark:text-gray-400">
          <p>Created {fmtDate(req.createdAt)}</p>
          {req.department && <p className="mt-1">Department: {departmentLabel(req.department)}</p>}
          {req.category && <p className="mt-1">Category: {req.category}</p>}
          {req.reason && <p className="mt-1">Reason: {IT_REQUEST_REASON_LABELS[req.reason]}</p>}
          {req.location && <p className="mt-1">Location: {IT_REQUEST_LOCATION_LABELS[req.location]}</p>}
          {req.specifications && Object.values(req.specifications).length > 0 && (
            <p className="mt-1">Specs: {Object.values(req.specifications).join(" · ")}</p>
          )}
          {req.businessJustification && <p className="mt-1">Justification: {req.businessJustification}</p>}
          {req.attachments.length > 0 && (
            <p className="mt-1">
              Attachments:{" "}
              {req.attachments.map((a, i) => (
                <span key={a.url}>
                  {i > 0 && ", "}
                  <a href={a.url} target="_blank" rel="noreferrer" className="underline hover:text-[#081735] dark:hover:text-white">
                    {a.name}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      {/* footer */}
      <div className="flex items-center justify-between pt-1">
        <p className="flex items-center gap-1.5 text-xs text-[#8F95B2] dark:text-gray-500">
          <Clock className="h-3 w-3" />
          Updated {relativeTime(req.updatedAt, now)}
        </p>
        <div className="flex items-center gap-2">
          {canEditOrWithdraw && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#F3F4F6] px-4 py-2.5 text-[13px] font-semibold text-[#081735] transition hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={onWithdraw}
                className="rounded-xl bg-[#081735] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#132449] dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200"
              >
                Withdraw
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onToggleExpand}
            className="rounded-xl bg-[#F3F4F6] px-4 py-2.5 text-[13px] font-semibold text-[#081735] transition hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            {expanded ? "Hide details" : "View details"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================== FILTER TABS ============================= */

const TYPE_TABS: Array<{ key: "ALL" | ItRequestType; label: string; icon: LucideIcon | null }> = [
  { key: "ALL", label: "All", icon: null },
  { key: "HARDWARE", label: "Hardware", icon: Monitor },
  { key: "SOFTWARE", label: "Software", icon: Code2 },
];

/* ================================ PAGE ================================ */

export default function MyRequestsPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // While true, the whole screen renders the 3-step wizard instead of the list.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ItRequest | null>(null);
  const [typeFilter, setTypeFilter] = useState<"ALL" | ItRequestType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"" | ItRequestStatus>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<ItRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  // Snapshot once — avoids calling Date.now() during render.
  const [now] = useState(() => Date.now());

  /* One unfiltered fetch, filtered client-side — the server already scopes
     this to the caller's own requests for anyone who isn't an IT manager/
     OWNER, same as the pre-wiring mock did with its local array. */
  const listParams = useMemo(
    () => ({ sortBy: "createdAt" as const, sortOrder: "desc" as const, limit: 100 }),
    []
  );
  const listQuery = useQuery({
    queryKey: queryKeys.itRequests(workspaceId, listParams),
    queryFn: () => itRequestsService.list(listParams),
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
  });
  const requests = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  const openCount = requests.filter((r) => isOpenStatus(r.requestStatus)).length;

  const visible = requests.filter(
    (r) =>
      (typeFilter === "ALL" || r.requestType === typeFilter) &&
      (statusFilter === "" || r.requestStatus === statusFilter)
  );

  /* Root-only key — the detail/summary queries nest a different second
     segment, so a key with workspaceId at index 1 would silently miss them. */
  const invalidateRequests = () => queryClient.invalidateQueries({ queryKey: ["it-requests"] });

  const openCreate = () => {
    setEditingRequest(null);
    setWizardOpen(true);
  };
  const openEdit = (req: ItRequest) => {
    setEditingRequest(req);
    setWizardOpen(true);
  };
  const closeWizard = () => {
    setWizardOpen(false);
    setEditingRequest(null);
  };

  const handleSubmit = async (payload: RequestFormPayload) => {
    setIsSaving(true);
    try {
      if (editingRequest) {
        await itRequestsService.update(editingRequest.id, payload as UpdateItRequestPayload);
        toast.success(`"${payload.itemName}" updated.`);
      } else {
        await itRequestsService.create(payload as CreateItRequestPayload);
        toast.success(`"${payload.itemName}" submitted.`);
      }
      invalidateRequests();
      closeWizard();
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't save that request.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmWithdraw = async () => {
    if (!withdrawing) return;
    setIsWithdrawing(true);
    try {
      await itRequestsService.withdraw(withdrawing.id);
      invalidateRequests();
      toast.success(`"${withdrawing.itemName}" withdrawn.`);
      setWithdrawing(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't withdraw that request.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  /* -------- full-screen wizard replaces the list entirely -------- */
  if (wizardOpen) {
    return (
      <NewRequestScreen
        editing={editingRequest}
        existingRequests={requests}
        onClose={closeWizard}
        onSubmit={(payload) => void handleSubmit(payload)}
        isSaving={isSaving}
      />
    );
  }

  // `h-full`, not `h-screen` — see the matching comment on the Employees
  // page's own root div; `h-screen` here spills past AdminLayoutClient's
  // shorter, `overflow-hidden` `<main>` and gets silently clipped.
  return (
    <div className="h-full w-full overflow-y-auto bg-[#EDEFF2] px-4 py-8 dark:bg-gray-950 sm:px-6 lg:px-8">
      <div className="">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[29px] font-medium leading-tight text-[#081735] dark:text-white">My Requests</h1>
            <p className="mt-1.5 text-sm text-[#8F95B2] dark:text-gray-400">
              {openCount} {openCount === 1 ? "request" : "requests"} open
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#081735] px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#132449] active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200"
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
        </div>

        {/* filters */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6E8F0] bg-white px-3 py-3 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex flex-wrap gap-1 rounded-xl bg-[#F3F4F6] p-1 dark:bg-white/5">
            {TYPE_TABS.map((tab) => {
              const active = tab.key === typeFilter;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTypeFilter(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-medium transition ${active
                      ? "bg-white text-[#081735] shadow-sm dark:bg-gray-800 dark:text-white"
                      : "text-[#535A79] hover:text-[#081735] dark:text-gray-400 dark:hover:text-white"
                    }`}
                >
                  {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | ItRequestStatus)}
              className={inputCls}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* list */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 lg:col-span-2">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-900 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : listQuery.isError ? (
            <div className="rounded-2xl border border-dashed border-red-200 bg-white/50 p-10 text-center lg:col-span-2 dark:border-red-900 dark:bg-white/[0.03]">
              <p className="text-sm font-medium text-red-500">{parseApiError(listQuery.error).message}</p>
              <button
                type="button"
                onClick={() => listQuery.refetch()}
                className="mt-3 rounded-lg bg-[#081735] px-4 py-2 text-xs font-medium text-white dark:bg-white dark:text-slate-900"
              >
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D9DCE7] bg-white/50 p-10 text-center lg:col-span-2 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No requests found</p>
              <p className="mt-1 text-xs text-[#8F95B2] dark:text-gray-500">
                {requests.length === 0
                  ? "Need something? Send your first request."
                  : "Try changing the type or status filters."}
              </p>
            </div>
          ) : (
            visible.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                now={now}
                expanded={expandedId === req.id}
                onToggleExpand={() => setExpandedId((id) => (id === req.id ? null : req.id))}
                onEdit={() => openEdit(req)}
                onWithdraw={() => setWithdrawing(req)}
              />
            ))
          )}
        </div>
      </div>

      {/* withdraw confirm */}
      <ConfirmActionModal
        isOpen={withdrawing !== null}
        title={withdrawing ? `Withdraw "${withdrawing.itemName}"?` : ""}
        description="This can't be undone — you'll need to submit a new request if you change your mind."
        confirmLabel="Withdraw request"
        isLoading={isWithdrawing}
        onConfirm={() => void confirmWithdraw()}
        onClose={() => setWithdrawing(null)}
      />
    </div>
  );
}
