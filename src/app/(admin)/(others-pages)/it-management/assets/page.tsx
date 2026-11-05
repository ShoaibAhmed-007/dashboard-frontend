"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDepartmentOptions } from "@/hooks/useDepartmentOptions";
import {
  Plus, Search, Sun, Moon, Bell, SlidersHorizontal,
  ChevronDown, ChevronUp, ArrowUpDown, ArrowLeft, Trash2, CheckCircle2,
  AlertCircle, Info, Laptop, Monitor, Server, Mouse, Keyboard, HardDrive,
  Smartphone, Tablet, Cable, X, Building2, MapPin, CalendarDays, RotateCcw,
  Pencil,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  assetsService,
  companyEmployeesService,
} from "@/services/it-management.service";
import ControlledDatePicker from "@/components/form/ControlledDatePicker";
import DateRangePicker from "@/components/form/DateRangePicker";
import Pagination from "@/components/common/Pagination";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace.store";
import {
  ASSET_CATEGORY_SUGGESTIONS,
  ASSET_CATEGORY_LABELS,
  ASSET_STATUSES,
  ASSET_STATUS_LABELS,
  ASSET_LOCATIONS,
  ASSET_LOCATION_LABELS,
  departmentLabel,
  SPEC_CATEGORIES,
} from "@/types/it-management";
import type {
  Asset,
  AssetStatus,
  AssetLocation,
  AssetSpecs,
  CreateAssetPayload,
  UpdateAssetPayload,
  Department,
} from "@/types/it-management";

/* ------------------------------ config ------------------------------ */

/** Free-text `cateogry` has no closed set server-side — this only picks an
 *  icon/colour for a known suggestion; anything else falls back below. */
const CATEGORY_ICONS: Record<string, typeof Laptop> = {
  LAPTOP: Laptop,
  DESKTOP: HardDrive,
  MONITOR: Monitor,
  KEYBOARD: Keyboard,
  MOUSE: Mouse,
  NETWORK: Server,
  PHONE: Smartphone,
  TABLET: Tablet,
  ACCESSORY: Cable,
};
const DEFAULT_CATEGORY_ICON = HardDrive;

const CATEGORY_COLORS = ["blue", "purple", "pink", "red", "orange", "emerald"] as const;
const colorForIndex = (i: number) => CATEGORY_COLORS[i % CATEGORY_COLORS.length];

/** Page size for the category drill-down table. The overview's own table
 *  (the "Recently Added Assets" widget) is a fixed top-5, not paginated. */
const PAGE_SIZE = 10;

const TABS: { key: AssetStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "AVAILABLE", label: "Available" },
  { key: "UNDER_REPAIR", label: "Under Repair" },
  { key: "DEAD", label: "Dead" },
];

const ICON_COLORS: Record<string, string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400",
  purple: "border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400",
  pink: "border-pink-200 bg-pink-50 text-pink-600 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-400",
  red: "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
  orange: "border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
};

const BAR_COLORS: Record<string, string> = {
  blue: "bg-blue-300",
  purple: "bg-purple-300",
  pink: "bg-pink-300",
  red: "bg-red-300",
  orange: "bg-orange-300",
  emerald: "bg-emerald-300",
};

/** Hex counterpart of `CATEGORY_COLORS`, for the overview cards' icon ring
 *  (an inline-styled border, same treatment as the dashboard's stat cards). */
const CATEGORY_ICON_HEX: Record<string, string> = {
  blue: "#2C65E7",
  purple: "#9236E5",
  pink: "#DB2777",
  red: "#D9232C",
  orange: "#E75620",
  emerald: "#16A34A",
};

const CATEGORY_CARD_SHADOW =
  "shadow-[0_-5px_12px_rgba(0,0,0,0.02),0_-22px_22px_rgba(0,0,0,0.02),0_-48px_29px_rgba(0,0,0,0.01)]";

const STATUS_STYLES: Record<AssetStatus, string> = {
  ASSIGNED: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  AVAILABLE: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  UNDER_REPAIR: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  DEAD: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#071936] dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-blue-500 dark:[color-scheme:dark]";

const LABEL_CLS = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-400";

/** Red asterisk appended inside a required field's label. */
function RequiredMark() {
  return <span className="text-red-500" aria-hidden="true"> *</span>;
}

/** The fields the API refuses to save without. `assignedToId` and `location`
 *  only count once the asset is assigned (see `validateAssetFields`). */
type RequiredAssetField = "name" | "cateogry" | "purchaseDate" | "assignedToId" | "location";
type AssetFieldErrors = Partial<Record<RequiredAssetField, string>>;

/** Mirrors CreateAssetSchema/UpdateAssetSchema on the server, so a missing
 *  field is flagged on the field itself rather than after a round trip. */
function validateAssetFields(values: {
  name: string;
  cateogry: string;
  purchaseDate: string;
  status: AssetStatus;
  assignedToId: string;
  location: string;
}): AssetFieldErrors {
  const errors: AssetFieldErrors = {};
  if (!values.name.trim()) errors.name = "Asset name is required";
  if (!values.cateogry.trim()) errors.cateogry = "Choose a category";
  if (!values.purchaseDate) errors.purchaseDate = "Choose a purchase date";
  if (values.status === "ASSIGNED" && !values.assignedToId) errors.assignedToId = "Choose who this asset is assigned to";
  if (values.assignedToId && !values.location) errors.location = "Choose a location";
  return errors;
}

/** Red message under a field that failed validation. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="mt-1 text-xs text-red-500">{message}</p>;
}

/** Red outline for a control that can't take a `className` itself. */
const invalidRing = (invalid: boolean) => (invalid ? "rounded-lg ring-1 ring-red-500" : "");

/** Scrolls the first invalid field into view inside the drawer. */
function scrollToFirstError(prefix: string, errors: AssetFieldErrors) {
  const order: RequiredAssetField[] = ["name", "cateogry", "purchaseDate", "assignedToId", "location"];
  const first = order.find((field) => errors[field]);
  if (first) document.getElementById(`${prefix}-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ------------------------------ helpers ------------------------------ */

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** `cateogry` is free text server-side — nothing stops "Laptop" and "LAPTOP"
 *  from being saved as two different categories unless every write path
 *  normalizes to the same casing first. Applied once here, at submit time,
 *  rather than on every keystroke, so the field still shows what the user
 *  typed while they're typing it. */
const normalizeCategory = (value: string) => value.trim().toUpperCase();

/** Friendly display text for a category value — "PC" for the stored
 *  "DESKTOP", etc. A custom (non-suggestion) category has no entry in
 *  `ASSET_CATEGORY_LABELS` and falls back to showing itself as typed. */
const categoryLabel = (value: string) =>
  ASSET_CATEGORY_LABELS[value as keyof typeof ASSET_CATEGORY_LABELS] ?? value;

/** Known synonyms for a predefined category, saved under a different raw
 *  string by an asset created before that category existed (or just typed
 *  differently). Used only to fold a real in-use category into its
 *  predefined equivalent when building the picker's option list below —
 *  never rewrites what's actually stored, so an asset already tagged
 *  "COMPUTER" keeps that exact value until someone edits and re-saves it. */
const CATEGORY_ALIASES: Record<string, string> = {
  COMPUTER: "DESKTOP",
  PC: "DESKTOP",
  MOBILE: "PHONE",
  CELLPHONE: "PHONE",
  NOTEBOOK: "LAPTOP",
};
const canonicalCategoryKey = (value: string) => {
  const upper = value.toUpperCase();
  return CATEGORY_ALIASES[upper] ?? upper;
};

/** Whether the specs fields (processor/RAM/storage/OS/screen size) apply to
 *  a given category — true for laptop/pc/mobile/tablet, regardless of the
 *  raw casing the category picker currently holds. */
const showsSpecs = (category: string) =>
  (SPEC_CATEGORIES as readonly string[]).includes(normalizeCategory(category));

const emptySpecsForm = (): AssetSpecs => ({ processor: "", ram: "", storage: "", os: "", screenSize: "" });

/** The five spec fields are flat on the payload, not nested under `specs` —
 *  see {@link AssetSpecs}. Spread the result into a create/update body: it's
 *  the trimmed fields for a spec category, and empty strings otherwise so
 *  switching a laptop to, say, MONITOR actually clears what was there. */
/** `parseApiError`'s `.message` is the envelope's own text — for a 422 from
 *  the Zod validation pipe that's always the generic "Validation failed",
 *  with the actual reason (e.g. "Cost cannot be negative", "An asset
 *  assigned to an employee must have a location") sitting in `.details`
 *  instead. Prefer those field messages whenever the server sent any;
 *  fall back to the envelope message, then to `fallback` for a network
 *  error or anything with no message at all. */
function assetErrorMessage(err: unknown, fallback: string): string {
  const { message, details } = parseApiError(err);
  if (details && details.length > 0) return details.map((d) => d.message).join(" ");
  return message || fallback;
}

const specsPayload = (category: string, specs: AssetSpecs | null | undefined) => {
  if (!showsSpecs(category)) return emptySpecsForm();
  return {
    processor: specs?.processor?.trim() ?? "",
    ram: specs?.ram?.trim() ?? "",
    storage: specs?.storage?.trim() ?? "",
    os: specs?.os?.trim() ?? "",
    screenSize: specs?.screenSize?.trim() ?? "",
  };
};

const drawerStyles = `
  @keyframes it-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes it-fade-in { from { opacity: 0; } to { opacity: 1; } }
  .it-drawer-panel { animation: it-drawer-in .32s cubic-bezier(.32,.72,0,1) both; }
  .it-drawer-overlay { animation: it-fade-in .2s ease-out both; }
`;

type ToastState = { message: string; type: "success" | "error" | "info" } | null;

type AssetFormState = {
  name: string;
  cateogry: string;
  serianlNumber: string;
  cost: string;
  purchaseDate: string;
  status: AssetStatus;
  assignedToId: string;
  /** Only shown/sent while `status` is `ASSIGNED`. */
  location: AssetLocation | "";
  /** Only shown/sent while `cateogry` is a `SPEC_CATEGORIES` value. Grouped
   *  in the form state for convenience; flattened onto the payload at submit
   *  time by `specsPayload`, since that's the shape the API takes. */
  specs: AssetSpecs;
  /** "YYYY-MM-DD", or "" for no warranty tracked. */
  warrantyUntil: string;
  vendor: string;
  invoiceNumber: string;
};

const emptyForm = (category?: string): AssetFormState => ({
  name: "",
  cateogry: category ?? ASSET_CATEGORY_SUGGESTIONS[0],
  serianlNumber: "",
  cost: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  status: "AVAILABLE",
  assignedToId: "",
  location: "",
  specs: emptySpecsForm(),
  warrantyUntil: "",
  vendor: "",
  invoiceNumber: "",
});

/* -------------------------- reusable pieces -------------------------- */

/** Right-side slide-in panel — same shape as the Employees screen's
 *  EmployeeFormDrawer: pinned header, scrollable field area, pinned footer
 *  for actions, so a long form never pushes buttons off-screen. */
function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="it-drawer-overlay absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="it-drawer-panel absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-gray-900 dark:text-white"
      >
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            {description && <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex-1 space-y-4 overflow-y-auto px-6 pb-4">{children}</div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-white/10">
          {footer}
        </div>
      </aside>
    </div>
  );
}

/** How many category rows are visible before the list scrolls. The "New
 *  category" row sits outside this scroll area so it never moves. */
const CATEGORY_ROWS_VISIBLE = 4;
const CATEGORY_ROW_HEIGHT = 36; // px — matches the row's py-2 + text-sm line height

/** Custom category combobox used by both the Add and Edit drawers. Shows the
 *  known categories a page at a time (scroll for the rest) with a "New
 *  category" action pinned below the scroll area — clicking it swaps in an
 *  inline input to create and immediately select a new category. */
function CategoryPicker({
  value,
  onChange,
  options,
  onCreateCategory,
  placeholder = "Select category",
  labelFor = (opt) => opt,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  /** Rejects a name that already exists (case-insensitively, and via
   *  whatever aliasing the caller applies — e.g. typing "computer" is
   *  rejected the same as "PC" if "DESKTOP" already covers both) instead of
   *  silently creating a near-duplicate. */
  onCreateCategory: (name: string) => { ok: true; value: string } | { ok: false; message: string };
  placeholder?: string;
  /** Friendly display text for a raw option/value — e.g. "PC" for the
   *  stored "DESKTOP". Defaults to showing the raw value as-is. */
  labelFor?: (opt: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const closeAll = () => {
    setOpen(false);
    setCreating(false);
    setNewName("");
    setCreateError(null);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeAll();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const commitNewCategory = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      closeAll();
      return;
    }
    const result = onCreateCategory(trimmed);
    if (!result.ok) {
      setCreateError(result.message);
      return; // leave the input open so they can fix it
    }
    onChange(result.value);
    closeAll();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${INPUT_CLS} flex items-center justify-between text-left`}
      >
        <span className={value ? "" : "text-gray-400"}>{value ? labelFor(value) : placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {/* Scrolls 4 rows at a time; the "New category" row below is fixed. */}
          <div
            className="overflow-y-auto py-1"
            style={{ maxHeight: CATEGORY_ROWS_VISIBLE * CATEGORY_ROW_HEIGHT }}
          >
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">No categories yet</p>
            ) : (
              options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-white/5 ${
                    opt === value ? "font-medium text-[#071936] dark:text-white" : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {labelFor(opt)}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-white/10">
            {creating ? (
              <div className="p-2">
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setCreateError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitNewCategory();
                      }
                      if (e.key === "Escape") {
                        setCreating(false);
                        setNewName("");
                        setCreateError(null);
                      }
                    }}
                    placeholder="New category name"
                    className={`w-full rounded-md border px-2 py-1.5 text-xs text-gray-800 outline-none dark:bg-gray-900 dark:text-white ${
                      createError
                        ? "border-red-300 focus:border-red-400 dark:border-red-500/50"
                        : "border-gray-200 focus:border-[#071936] dark:border-gray-600"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={commitNewCategory}
                    className="shrink-0 rounded-md bg-[#071936] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#10284d]"
                  >
                    Add
                  </button>
                </div>
                {createError && <p className="mt-1 text-[10px] text-red-500">{createError}</p>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-[#2E5FD8] transition hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <Plus size={14} />
                New category
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Same segmented look as the dashboard's stat cards — one thin bar per unit
 *  with 1px gaps, rather than a single continuous fill. */
function CategoryProgressBar({ total, filled, colorCls }: { total: number; filled: number; colorCls: string }) {
  return (
    <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-white dark:bg-gray-900">
      {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
        <div
          key={i}
          className={`h-full flex-1 rounded-[1px] ${i < filled ? colorCls : "bg-[#E3E5E8] dark:bg-gray-700"}`}
        />
      ))}
    </div>
  );
}

/** One pill in the filter row. `disabled` renders it inert (dimmed, no
 *  chevron, no click) — used for filters whose field doesn't exist on
 *  `Asset` yet, so the row stays visually complete without pretending
 *  they work. */
function FilterPill({
  icon: Icon,
  label,
  active,
  disabled,
  disabledReason,
  badge,
  showChevron = true,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  badge?: number;
  showChevron?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
        disabled
          ? "cursor-not-allowed border-[#E2E8F0] bg-white/50 text-[#4A5568]/40 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-500"
          : active
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
            : "border-[#E2E8F0] bg-white/50 text-[#4A5568] hover:bg-white dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300 dark:hover:bg-gray-800"
      }`}
    >
      <Icon size={16} strokeWidth={1.5} />
      <span>{label}</span>
      {!!badge && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-xs font-semibold text-emerald-600 dark:bg-gray-800">
          {badge}
        </span>
      )}
      {showChevron && !disabled && <ChevronDown size={12} className="text-[#718096]" />}
    </button>
  );
}

/* -------------------------------- page -------------------------------- */

export default function ItAssetsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  /* ---------- state ---------- */
  const [view, setView] = useState<string | null>(null); // null = overview, else a `cateogry` value
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<AssetStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  // "YYYY-MM-DD", or "" for unset — matches ControlledDatePicker's contract
  // and the shape `purchaseDateFrom`/`purchaseDateTo` expect server-side.
  const [purchaseDateFrom, setPurchaseDateFrom] = useState("");
  const [purchaseDateTo, setPurchaseDateTo] = useState("");
  // `GET /assets?department=` filters to assets held by employees in that
  // department (via assignedTo) — a real server-side filter, unlike Brand
  // below (nothing on Asset to filter by). Location *is* a field on Asset
  // now, but isn't a documented `GET /assets` query param, so it's filtered
  // client-side against whatever page is already fetched, not sent to the
  // server like department/dates are.
  const [department, setDepartment] = useState<Department | "">("");
  const departmentOptions = useDepartmentOptions();
  const [locationFilter, setLocationFilter] = useState<AssetLocation | "">("");
  const [openMenu, setOpenMenu] = useState<"department" | "location" | "purchaseDate" | "bell" | null>(null);
  const [sort, setSort] = useState<{ key: "name" | "purchaseDate" | "cost"; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<AssetFormState>(emptyForm());
  const [editing, setEditing] = useState<Asset | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /* Required-field errors only appear after a failed save attempt, then track
     the form live so each one clears the moment it is fixed. */
  const [addAttempted, setAddAttempted] = useState(false);
  const [editAttempted, setEditAttempted] = useState(false);
  const addErrors: AssetFieldErrors = addAttempted
    ? validateAssetFields({
        name: form.name,
        cateogry: form.cateogry,
        purchaseDate: form.purchaseDate,
        status: form.status,
        assignedToId: form.assignedToId,
        location: form.location,
      })
    : {};
  const editErrors: AssetFieldErrors =
    editAttempted && editing
      ? validateAssetFields({
          name: editing.name,
          cateogry: editing.cateogry,
          purchaseDate: editing.purchaseDate ?? "",
          status: editing.status,
          assignedToId: editing.assignedToId ?? "",
          location: editing.location ?? "",
        })
      : {};
  // A different asset opened in the drawer starts clean.
  useEffect(() => {
    setEditAttempted(false);
  }, [editing?.id]);
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
  const [isDeletingAsset, setIsDeletingAsset] = useState(false);
  // Categories typed into the picker's "New category" field before any asset
  // has actually been saved under them — merged into `categoryOptions` below
  // so a just-created category is immediately pickable again in the same session.
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const [dark, setDark] = useState(false);
  const [notifRead, setNotifRead] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const filtersRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: ToastState extends infer T ? (T extends { type: infer U } ? U : never) : never = "success") =>
    setToast({ message, type });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      // flatpickr (behind the Purchase date popover's From/To fields) mounts
      // its calendar as a direct child of <body> — it's never inside
      // `filtersRef`, so without this check every day-click reads as an
      // "outside click" and closes the popover before the pick registers.
      if (e.target instanceof Element && e.target.closest(".flatpickr-calendar")) return;
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setOpenMenu((m) => (m && m !== "bell" ? null : m));
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpenMenu((m) => (m === "bell" ? null : m));
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setShowAddModal(false);
        setEditing(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A filter/category change can leave `page` pointing past the new result
  // set's last page — reset it whenever any of them change.
  useEffect(() => {
    setPage(1);
  }, [view, search, activeTab, department, locationFilter, purchaseDateFrom, purchaseDateTo]);

  /* The detail page owns the row click now, so it links back here with
     `?edit=<id>` to reach this screen's edit drawer rather than duplicating
     the whole form over there. Fetched by id because the asset being edited
     isn't necessarily on the page of rows currently loaded. */
  const editId = searchParams.get("edit");
  useEffect(() => {
    if (!editId || !workspaceId) return;
    let cancelled = false;
    void assetsService
      .get(editId)
      .then((asset) => {
        if (!cancelled) setEditing(asset);
      })
      .catch(() => {
        /* A stale/bad id just means no drawer — the list still renders. */
      })
      .finally(() => {
        // Drop the param either way so a later back/refresh doesn't reopen it.
        if (!cancelled) router.replace("/it-management/assets");
      });
    return () => {
      cancelled = true;
    };
  }, [editId, workspaceId, router]);

  /* ---------- data ---------- */
  const statsParams = useMemo(
    () => ({
      q: search.trim() || undefined,
      cateogry: view ?? undefined,
      status: activeTab !== "ALL" ? activeTab : undefined,
      department: department || undefined,
      purchaseDateFrom: purchaseDateFrom || undefined,
      purchaseDateTo: purchaseDateTo || undefined,
      limit: 100,
      sortBy: sort.key,
      sortOrder: sort.dir,
    }),
    [search, view, activeTab, department, purchaseDateFrom, purchaseDateTo, sort]
  );

  /* Drives the notification bell, the category banner's badge counts and
     the header's total value — deliberately NOT paginated: these need the
     full matching set (up to the backend's 100-row cap), not one page of
     it, same as before pagination existed. `meta.total` (unlike the capped
     `items` array) is always the true count regardless of that cap, so it's
     used for every "how many" headline below rather than `.length`. */
  const statsQuery = useQuery({
    queryKey: queryKeys.itAssets(workspaceId, statsParams),
    queryFn: () => assetsService.list(statsParams),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const tableParams = useMemo(
    () => ({ ...statsParams, page, limit: PAGE_SIZE }),
    [statsParams, page]
  );

  /* The category table's actual page of rows. Only meaningful once a
     category is drilled into — the overview screen's table reads from
     `summaryQuery.data.latestAssets` instead (see below), so this stays
     idle there rather than fetching a page nothing will show. */
  const tableQuery = useQuery({
    queryKey: queryKeys.itAssets(workspaceId, tableParams),
    queryFn: () => assetsService.list(tableParams),
    enabled: Boolean(workspaceId) && Boolean(view),
    staleTime: 30_000,
  });

  /* Per-category rollup (`stats`) for the overview cards, plus the 6 most
     recently created assets (`latestAssets`) for the overview's own table. */
  const summaryQuery = useQuery({
    queryKey: queryKeys.itAssetsSummary(workspaceId),
    queryFn: () => assetsService.summary(),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const employeesQuery = useQuery({
    queryKey: queryKeys.companyEmployees(workspaceId, { limit: 100 }),
    queryFn: () => companyEmployeesService.list({ limit: 100 }),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  /* Root-only keys, not `["it-assets", workspaceId]` — the list, detail and
     summary queries each nest a different second segment ("detail"/"summary"
     vs. the workspace id itself), so a key including workspaceId at index 1
     only ever matches the list query and silently leaves the summary (the
     category cards + recently-added table) stale. */
  const invalidateAssets = () => {
    queryClient.invalidateQueries({ queryKey: ["it-assets"] });
    queryClient.invalidateQueries({ queryKey: ["company-employees"] });
  };

  /* ---------- derived data ---------- */
  /* Up to 100 matching rows — feeds the bell/banner/value stats below, not
     the table. See `statsQuery`'s doc comment. */
  const rawAssets = useMemo(() => statsQuery.data?.items ?? [], [statsQuery.data]);

  /* The category table's current page. Only populated once a category is
     drilled into — see `tableQuery`'s doc comment. */
  const tableRows = useMemo(() => tableQuery.data?.items ?? [], [tableQuery.data]);

  /* The 5 most recently created assets, workspace-wide, for the overview's
     "Recently added assets" widget — not affected by `view`/search/status,
     since the summary endpoint doesn't take filters. The endpoint itself
     actually returns up to 6 (`latestAssets`); sliced to 5 here since the
     overview widget is meant to be a quick peek, not a full list — the
     drilled-in category table (paginated, below) is where you see the rest.
     Client-side-filtered below for the overview table, same as `tableRows`
     is server-filtered for the category table. */
  const latestAssets = useMemo(
    () => (summaryQuery.data?.latestAssets ?? []).slice(0, 5),
    [summaryQuery.data]
  );

  /* On the overview screen (no category picked), the table shows the
     recently-added widget (`latestAssets`) rather than the full workspace
     list — matching what the summary endpoint was extended to provide.
     Search/status narrow that same 6-row set client-side, same as the
     category table narrows `tableRows`. */
  const overviewTableSource = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return latestAssets.filter((a) => {
      if (activeTab !== "ALL" && a.status !== activeTab) return false;
      if (department && a.assignedTo?.department !== department) return false;
      // purchaseDate is an ISO datetime; slice to the date part so it
      // compares correctly against the plain "YYYY-MM-DD" from the pickers.
      const purchaseDay = a.purchaseDate.slice(0, 10);
      if (purchaseDateFrom && purchaseDay < purchaseDateFrom) return false;
      if (purchaseDateTo && purchaseDay > purchaseDateTo) return false;
      if (!needle) return true;
      return (
        a.name.toLowerCase().includes(needle) ||
        a.serianlNumber.toLowerCase().includes(needle) ||
        (a.assignedTo?.name.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [latestAssets, activeTab, department, search, purchaseDateFrom, purchaseDateTo]);

  const tableAssets = useMemo(() => {
    let out = view ? tableRows : overviewTableSource;
    if (locationFilter) out = out.filter((a) => a.location === locationFilter);
    return out;
  }, [tableRows, overviewTableSource, view, locationFilter]);

  /** Which query backs whatever's currently in the table area — drives the
   *  loading/error states below. */
  const activeTableQuery = view ? tableQuery : summaryQuery;

  /** True count for the current scope — `meta.total` isn't capped by the
   *  100-row fetch the way `rawAssets.length` is, so it stays accurate past
   *  that cap. `latestAssets.length` (the fixed top 5) on the overview. */
  const scopeTotal = view ? (statsQuery.data?.meta.total ?? rawAssets.length) : latestAssets.length;

  const scopedAssigned = rawAssets.filter((a) => a.status === "ASSIGNED").length;
  const scopedAvailable = rawAssets.filter((a) => a.status === "AVAILABLE").length;
  const scopedRepair = rawAssets.filter((a) => a.status === "UNDER_REPAIR").length;
  const scopedDead = rawAssets.filter((a) => a.status === "DEAD").length;
  const scopedValue = rawAssets.reduce((sum, a) => sum + a.cost, 0);

  const categoryCards = useMemo(() => {
    const stats = summaryQuery.data?.stats ?? [];
    return stats.map((s, i) => ({
      category: s.category,
      total: s.total,
      assigned: s.assigned,
      available: s.available,
      color: colorForIndex(i),
      Icon: CATEGORY_ICONS[s.category.toUpperCase()] ?? DEFAULT_CATEGORY_ICON,
    }));
  }, [summaryQuery.data]);

  /* Real categories already in use in this workspace, for the combobox —
     falls back to the generic suggestions only when the workspace has no
     assets yet to derive real ones from. Categories just typed into the
     picker's "New category" field (not yet backing any saved asset) are
     appended so they stay pickable for the rest of the session. */
  /* Predefined common-IT-item categories always come first, so the picker
     always offers them — previously this fell back to them only when the
     workspace had zero assets, which meant a single pre-existing asset
     tagged e.g. "COMPUTER" replaced the whole curated list with just
     whatever raw categories happened to be in use already. Real categories
     already in use (however they were originally typed) and anything just
     created via "New category" are appended after, deduped case-insensitively
     against the predefined list and each other, so nothing already in use
     goes missing from the picker either. */
  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const dedupe = (values: string[]) =>
      values.filter((v) => {
        const key = canonicalCategoryKey(v);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return [
      ...dedupe([...ASSET_CATEGORY_SUGGESTIONS]),
      ...dedupe(categoryCards.map((c) => c.category)),
      ...dedupe(customCategories),
    ];
  }, [categoryCards, customCategories]);

  /** Rejects a name that already matches an existing category — predefined,
   *  already in use, or created earlier this session — case-insensitively
   *  and through `CATEGORY_ALIASES` (so "computer" is rejected too, once
   *  "DESKTOP"/"PC" already exists), rather than silently creating a
   *  redundant near-duplicate or silently swapping in the existing one. */
  const handleCreateCategory = (name: string): { ok: true; value: string } | { ok: false; message: string } => {
    const normalized = normalizeCategory(name);
    if (!normalized) return { ok: false, message: "Enter a category name" };

    const canonicalKey = canonicalCategoryKey(normalized);
    const existing = categoryOptions.find((opt) => canonicalCategoryKey(opt) === canonicalKey);
    if (existing) {
      return { ok: false, message: `"${categoryLabel(existing)}" already exists — pick it from the list above` };
    }

    setCustomCategories((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    return { ok: true, value: normalized };
  };

  const trackedTotal = categoryCards.reduce((s, c) => s + c.total, 0);
  const trackedValue = rawAssets.reduce((s, a) => s + a.cost, 0);

  const attentionAssets = useMemo(
    () => rawAssets.filter((a) => a.status === "UNDER_REPAIR" || a.status === "DEAD"),
    [rawAssets]
  );

  const hasDateRange = Boolean(purchaseDateFrom || purchaseDateTo);
  const activeFilterCount =
    (hasDateRange ? 1 : 0) + (department ? 1 : 0) + (locationFilter ? 1 : 0);
  const isFiltered = activeTab !== "ALL" || !!search.trim() || activeFilterCount > 0;

  /* ---------- navigation ---------- */
  const resetTransient = () => {
    setSearch("");
    setActiveTab("ALL");
    setDepartment("");
    setLocationFilter("");
    setPurchaseDateFrom("");
    setPurchaseDateTo("");
    setSort({ key: "name", dir: "asc" });
  };

  const openCategory = (name: string) => {
    resetTransient();
    setView(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    resetTransient();
    setView(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReset = () => {
    resetTransient();
    showToast("Filters reset", "info");
  };

  const handleSort = (key: "name" | "purchaseDate" | "cost") =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  /* ---------- form / CRUD ---------- */
  const openAddModal = () => {
    setAddAttempted(false);
    setForm(emptyForm(view ?? undefined));
    setShowAddModal(true);
  };

  const handleAddAsset = async () => {
    setAddAttempted(true);
    const missing = validateAssetFields({
      name: form.name,
      cateogry: form.cateogry,
      purchaseDate: form.purchaseDate,
      status: form.status,
      assignedToId: form.assignedToId,
      location: form.location,
    });
    if (Object.keys(missing).length > 0) {
      scrollToFirstError("add-asset", missing);
      return showToast("Fill in the highlighted fields", "error");
    }
    if (Number(form.cost) < 0)
      return showToast("Cost cannot be negative", "error");

    const payload: CreateAssetPayload = {
      name: form.name.trim(),
      cateogry: normalizeCategory(form.cateogry),
      serianlNumber: form.serianlNumber.trim() || undefined,
      purchaseDate: new Date(form.purchaseDate).toISOString(),
      cost: Number(form.cost) || 0,
      status: form.status,
      assignedToId: form.assignedToId || undefined,
      location: form.status === "ASSIGNED" ? form.location || undefined : undefined,
      warrantyUntil: form.warrantyUntil ? new Date(form.warrantyUntil).toISOString() : undefined,
      vendor: form.vendor.trim() || undefined,
      invoiceNumber: form.invoiceNumber.trim() || undefined,
      ...specsPayload(form.cateogry, form.specs),
    };

    setIsSaving(true);
    try {
      await assetsService.create(payload);
      invalidateAssets();
      setShowAddModal(false);
      showToast(`${payload.name} added${view ? ` to ${view}` : ""}`);
    } catch (err) {
      showToast(assetErrorMessage(err, "Couldn't add that asset."), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsset = async () => {
    if (!editing) return;
    setEditAttempted(true);
    const missing = validateAssetFields({
      name: editing.name,
      cateogry: editing.cateogry,
      purchaseDate: editing.purchaseDate ?? "",
      status: editing.status,
      assignedToId: editing.assignedToId ?? "",
      location: editing.location ?? "",
    });
    if (Object.keys(missing).length > 0) {
      scrollToFirstError("edit-asset", missing);
      return showToast("Fill in the highlighted fields", "error");
    }
    if (editing.cost < 0)
      return showToast("Cost cannot be negative", "error");

    const payload: UpdateAssetPayload = {
      name: editing.name,
      cateogry: normalizeCategory(editing.cateogry),
      serianlNumber: editing.serianlNumber,
      purchaseDate: editing.purchaseDate,
      cost: editing.cost,
      status: editing.status,
      assignedToId: editing.assignedToId || null,
      location: editing.status === "ASSIGNED" ? editing.location : null,
      warrantyUntil: editing.warrantyUntil !== null ? editing.warrantyUntil : null,
      vendor: editing.vendor?.trim() || "",
      invoiceNumber: editing.invoiceNumber !== null ? editing.invoiceNumber.trim() : "",

      // invoiceNumber: editing.invoiceNumber?.trim() || "",
      ...specsPayload(editing.cateogry, {
        processor: editing.processor ?? "",
        ram: editing.ram ?? "",
        storage: editing.storage ?? "",
        os: editing.os ?? "",
        screenSize: editing.screenSize ?? "",
      }),
    };

    setIsSaving(true);
    try {
      await assetsService.update(editing.id, payload);
      invalidateAssets();
      setEditing(null);
      showToast(`${payload.name} updated`);
    } catch (err) {
      showToast(assetErrorMessage(err, "Couldn't update that asset."), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAsset = async () => {
    if (!deletingAsset) return;
    const { id, name } = deletingAsset;
    setIsDeletingAsset(true);
    try {
      await assetsService.delete(id);
      invalidateAssets();
      // Deleting out from under an open edit drawer would otherwise leave it
      // showing a now-nonexistent record.
      if (editing?.id === id) setEditing(null);
      setDeletingAsset(null);
      showToast(`${name} removed from inventory`, "info");
    } catch (err) {
      showToast(assetErrorMessage(err, "Couldn't delete that asset."), "error");
    } finally {
      setIsDeletingAsset(false);
    }
  };

  // Sort only applies to `rawAssets` (the category table) — the overview's
  // `latestAssets` is a fixed newest-5 set the summary endpoint doesn't take
  // sort params for, so headers there render as plain, non-interactive text.
  const renderSortHeader = (label: string, col: "name" | "purchaseDate" | "cost", widthCls: string) => (
    <div className={`${widthCls} text-[11px] font-bold uppercase text-black dark:text-white`}>
      {view ? (
        <button
          type="button"
          onClick={() => handleSort(col)}
          className="flex items-center gap-1 uppercase transition hover:text-gray-600 dark:hover:text-gray-300"
        >
          {label}
          {sort.key === col ? (
            sort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
          ) : (
            <ArrowUpDown size={10} className="text-gray-300 dark:text-gray-600" />
          )}
        </button>
      ) : (
        label
      )}
    </div>
  );

  const viewCard = view ? categoryCards.find((c) => c.category === view) : null;
  const ViewIcon = viewCard?.Icon ?? DEFAULT_CATEGORY_ICON;
  const usagePct = rawAssets.length ? Math.min(Math.round((scopedAssigned / rawAssets.length) * 100), 100) : 0;

  const employeeOptions = employeesQuery.data?.items ?? [];

  /* ---------- render ---------- */
  // `h-full`, not `h-screen` — see the matching comment on the Employees
  // page's own root div; `h-screen` here spills past AdminLayoutClient's
  // shorter, `overflow-hidden` `<main>` and gets silently clipped.
  return (
    <div className="h-full overflow-y-auto bg-[#EDEFF2] px-6 pb-20 pt-6 text-gray-800 dark:bg-gray-950 dark:text-white">
      <style>{drawerStyles}</style>

      {/* Header */}
      <div className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view && (
            <button
              type="button"
              onClick={goBack}
              title="Back to overview"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <ArrowLeft size={16} />
            </button>
          )}

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
              <span>Dashboards</span>
              <span>/</span>
              <span className="font-medium text-gray-600 dark:text-gray-300">Default</span>
              <span>/</span>
              <span>IT Assets</span>
              {view && (
                <>
                  <span>/</span>
                  <span className="font-medium text-gray-600 dark:text-gray-300">{view}</span>
                </>
              )}
            </div>

            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{view ?? "IT Assets"}</h1>

            <p className="mt-1 text-sm text-gray-400">
              {view
                ? `${scopeTotal} devices · ${scopedAssigned} in use · PKR ${scopedValue.toLocaleString()} total value`
                : `${trackedTotal} items tracked · PKR ${trackedValue.toLocaleString()} total value`}
            </p>
          </div>
        </div>
{/* 
        <div className="flex items-center gap-3">
          <div className="hidden h-10 w-52 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 md:flex dark:border-gray-800 dark:bg-gray-900">
            <Search size={16} className="shrink-0 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={view ? `Search in ${view}` : "Search assets, serials, people"}
              className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            title="Toggle dark mode"
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="relative" ref={bellRef}>
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === "bell" ? null : "bell")}
              title="Notifications"
              className="relative rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <Bell size={18} />
              {!notifRead && attentionAssets.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>

            {openMenu === "bell" && (
              <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center justify-between px-2 py-1">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Notifications</p>
                  {attentionAssets.length > 0 && !notifRead && (
                    <button type="button" onClick={() => setNotifRead(true)} className="text-[10px] font-medium text-blue-500 hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>

                {!notifRead && attentionAssets.length > 0 ? (
                  attentionAssets.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 rounded-lg px-2 py-2 text-xs text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800">
                      <AlertCircle size={13} className={`mt-0.5 shrink-0 ${a.status === "UNDER_REPAIR" ? "text-amber-500" : "text-gray-400"}`} />
                      <span>
                        <span className="font-medium">{a.name}</span> is currently {ASSET_STATUS_LABELS[a.status].toLowerCase()}.
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="px-2 py-3 text-center text-xs text-gray-400">You&apos;re all caught up</p>
                )}
              </div>
            )}
          </div>
        </div> */}
      </div>

      {/* Add Assets row */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="hidden text-xs text-gray-400 sm:block">
          {view
            ? `${view} — ${scopeTotal} devices in this category`
            : isFiltered
              ? `Filtered view — showing ${tableAssets.length} of ${scopeTotal} assets`
              : "Click a category to view its devices"}
        </p>
        <button
          type="button"
          onClick={openAddModal}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-[#071936] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#10284d]"
        >
          <Plus size={17} />
          {view ? `Add to ${view}` : "Add Assets"}
        </button>
      </div>

      {/* Category banner OR overview cards */}
      {view && viewCard ? (
        <div className="rounded-xl border border-gray-100 bg-[#F6F7F9] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full border ${ICON_COLORS[viewCard.color]}`}>
                <ViewIcon size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{view}</h2>
                <p className="text-xs text-gray-400">
                  {scopeTotal} devices · PKR {scopedValue.toLocaleString()} total value
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px]">
              <button type="button" onClick={() => setActiveTab("ASSIGNED")} className="rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-600 transition hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400">
                {scopedAssigned} Assigned
              </button>
              <button type="button" onClick={() => setActiveTab("AVAILABLE")} className="rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-600 transition hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400">
                {scopedAvailable} Available
              </button>
              <button type="button" onClick={() => setActiveTab("UNDER_REPAIR")} className="rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-600 transition hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400">
                {scopedRepair} In repair
              </button>
              <button type="button" onClick={() => setActiveTab("DEAD")} className="rounded-full bg-gray-100 px-3 py-1.5 font-medium text-gray-500 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">
                {scopedDead} Dead
              </button>
            </div>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div className={`h-full rounded-full transition-all duration-300 ${BAR_COLORS[viewCard.color]}`} style={{ width: `${usagePct}%` }} />
          </div>
          <p className="mt-1.5 text-[10px] text-gray-400">
            {scopedAssigned} of {rawAssets.length} in use ({usagePct}%)
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categoryCards.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-[#F6F7F9] p-8 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No assets tracked yet</p>
              <p className="mt-1 text-xs text-gray-400">Add your first asset to see categories here.</p>
            </div>
          ) : (
            categoryCards.map((c) => (
              <button
                key={c.category}
                type="button"
                onClick={() => openCategory(c.category)}
                title={`View all ${c.category}`}
                className={`flex w-full flex-col gap-4 rounded-2xl bg-[#F6F7F9] px-6 py-4 text-left transition hover:-translate-y-0.5 dark:bg-gray-900 ${CATEGORY_CARD_SHADOW}`}
              >
                <div className="flex items-start gap-[11px]">
                  <div
                    className="shrink-0 rounded-full border p-2.5"
                    style={{ borderColor: CATEGORY_ICON_HEX[c.color], color: CATEGORY_ICON_HEX[c.color] }}
                  >
                    <c.Icon size={28} strokeWidth={1.5} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-[5px]">
                    <p className="truncate text-base font-light text-[#081735] dark:text-gray-300">{c.category}</p>
                    <p className="text-[32px] leading-none text-[#081735] dark:text-white">{c.total}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <CategoryProgressBar total={c.total} filled={c.assigned} colorCls={BAR_COLORS[c.color]} />
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-0.5">
                      <span className="text-sm font-medium leading-none text-[#D97706]">{c.assigned}</span>
                      <span className="text-xs leading-none text-[#D97706]">Assigned</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className="text-sm font-medium leading-none text-[#137255]">{c.available}</span>
                      <span className="text-right text-xs leading-none text-[#8F95B2]">Available</span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Tabs + Search */}
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${activeTab === tab.key
                ? "bg-[#071936] text-white shadow-sm"
                : "bg-white text-gray-500 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 md:w-52 dark:border-gray-800 dark:bg-gray-900">
          <Search size={15} className="shrink-0 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={view ? `Search in ${view}` : "Search assets, serials, people"}
            className="w-full bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Filters + Table */}
      <div
        className={`mt-4 flex flex-col gap-4 overflow-hidden rounded-2xl bg-white/50 px-4 py-6 dark:bg-gray-900/50 ${CATEGORY_CARD_SHADOW}`}
      >
        {/* Filters */}
        <div ref={filtersRef} className="flex flex-wrap items-center gap-2 px-2">
          {/* Not a button — just a passive summary of how many filters below
              are currently active. Nothing to open; each filter lives in
              its own pill. */}
          <div
            className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium ${
              activeFilterCount > 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                : "border-[#E2E8F0] bg-white/50 text-[#4A5568] dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300"
            }`}
          >
            <SlidersHorizontal size={16} strokeWidth={1.5} />
            <span>Filter</span>
            {!!activeFilterCount && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-xs font-semibold text-emerald-600 dark:bg-gray-800">
                {activeFilterCount}
              </span>
            )}
          </div>

          {/* Department is a documented `GET /assets` query param; Location
              is a real field on Asset but not a documented query param, so
              it's filtered client-side (see `locationFilter` above
              `tableAssets`). */}

          <div className="relative">
            <FilterPill
              icon={Building2}
              label={department ? departmentLabel(department) : "Department"}
              active={Boolean(department)}
              onClick={() => setOpenMenu(openMenu === "department" ? null : "department")}
            />

            {openMenu === "department" && (
              <div className="absolute left-0 top-full z-30 mt-2 w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => { setDepartment(""); setOpenMenu(null); }}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-xs transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    !department ? "font-semibold text-[#071936] dark:text-white" : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  All departments
                </button>
                {departmentOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setDepartment(d); setOpenMenu(null); }}
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-xs transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      department === d ? "font-semibold text-[#071936] dark:text-white" : "text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {departmentLabel(d)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <FilterPill
              icon={MapPin}
              label={locationFilter ? ASSET_LOCATION_LABELS[locationFilter] : "Location"}
              active={Boolean(locationFilter)}
              onClick={() => setOpenMenu(openMenu === "location" ? null : "location")}
            />

            {openMenu === "location" && (
              <div className="absolute left-0 top-full z-30 mt-2 w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => { setLocationFilter(""); setOpenMenu(null); }}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-xs transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    !locationFilter ? "font-semibold text-[#071936] dark:text-white" : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  All locations
                </button>
                {ASSET_LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => { setLocationFilter(loc); setOpenMenu(null); }}
                    className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-xs transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      locationFilter === loc ? "font-semibold text-[#071936] dark:text-white" : "text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {ASSET_LOCATION_LABELS[loc]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <FilterPill
              icon={CalendarDays}
              label={
                purchaseDateFrom || purchaseDateTo
                  ? `${purchaseDateFrom || "…"} → ${purchaseDateTo || "…"}`
                  : "Purchase date"
              }
              active={hasDateRange}
              onClick={() => setOpenMenu(openMenu === "purchaseDate" ? null : "purchaseDate")}
            />

            {openMenu === "purchaseDate" && (
              <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <p className="pb-2 text-[9px] font-semibold uppercase tracking-wide text-gray-400">Purchase date range</p>
                <DateRangePicker
                  id="asset-filter-purchase-date-range"
                  from={purchaseDateFrom}
                  to={purchaseDateTo}
                  onChange={(from, to) => { setPurchaseDateFrom(from); setPurchaseDateTo(to); }}
                  placeholder="Click to pick a start and end date"
                  className={`${INPUT_CLS} pr-9`}
                />
                {hasDateRange && (
                  <button
                    type="button"
                    onClick={() => { setPurchaseDateFrom(""); setPurchaseDateTo(""); }}
                    className="mt-3 text-xs font-medium text-red-500 hover:text-red-600"
                  >
                    Clear dates
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleReset}
            className={`flex items-center gap-2 px-2 py-2 text-sm font-medium transition ${
              isFiltered
                ? "text-red-500 hover:text-red-600"
                : "text-[#4A5568] hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <RotateCcw size={16} strokeWidth={1.5} />
            Reset
          </button>
        </div>

        {/* Table header */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h2 className="text-xl font-medium capitalize text-black dark:text-white">
              {view ?? "Recently added assets"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Showing {tableAssets.length} of {scopeTotal}
            </p>
          </div>

          {view && (
            <button
              type="button"
              onClick={() => setSort({ key: "purchaseDate", dir: "desc" })}
              className="rounded-full bg-white px-3 py-1 text-xs font-medium capitalize text-[#2E5FD8] transition hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              View latest
            </button>
          )}
        </div>

        {activeTableQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#071936] border-t-transparent dark:border-white dark:border-t-transparent" />
          </div>
        ) : activeTableQuery.isError ? (
          <div className="py-14 text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Couldn&apos;t load assets</p>
            <p className="mt-1 text-xs text-gray-400">{parseApiError(activeTableQuery.error).message}</p>
            <button
              type="button"
              onClick={() => activeTableQuery.refetch()}
              className="mt-4 rounded-full bg-[#071936] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-[#10284d]"
            >
              Try again
            </button>
          </div>
        ) : tableAssets.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <Search size={20} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No assets found</p>
            <p className="mt-1 text-xs text-gray-400">Try adjusting your search or filters</p>
            <button
              type="button"
              onClick={handleReset}
              className="mt-4 rounded-full bg-[#071936] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-[#10284d]"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1106px]">
              <div className="flex items-center gap-4 rounded-2xl border-b border-[#E6E8F0] bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
                {renderSortHeader("Asset Name", "name", "flex-1")}
                <div className="w-[140px] text-[11px] font-bold uppercase text-black dark:text-white">Serial</div>
                <div className="w-[200px] text-[11px] font-bold uppercase text-black dark:text-white">Assigned To</div>
                <div className="w-[130px] text-[11px] font-bold uppercase text-black dark:text-white">Location</div>
                {!view && <div className="w-[120px] text-[11px] font-bold uppercase text-black dark:text-white">Category</div>}
                {renderSortHeader("Cost", "cost", "w-[110px]")}
                {renderSortHeader("Purchased", "purchaseDate", "w-[120px]")}
                <div className="w-[110px] text-[11px] font-bold uppercase text-black dark:text-white">Status</div>
                <div className="w-[76px] text-[11px] font-bold uppercase text-black dark:text-white">Actions</div>
              </div>

              <div className="flex flex-col">
                {tableAssets.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => router.push(`/it-management/assets/${asset.id}`)}
                    title="Click to view details"
                    className="flex cursor-pointer items-center gap-4 border-b border-[#E6E8F0] px-6 py-4 last:border-0 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex-1 truncate text-sm font-bold leading-5 text-black dark:text-white">
                      {asset.name}
                    </div>

                    <div className="w-[140px] truncate text-[13px] font-medium leading-[18px] text-black dark:text-gray-300">
                      {asset.serianlNumber || "—"}
                    </div>

                    <div className="flex w-[200px] items-center gap-2">
                      {asset.assignedTo ? (
                        <>
                          {asset.assignedTo.imageUrl ? (
                            <img src={asset.assignedTo.imageUrl} alt={asset.assignedTo.name} className="h-8 w-8 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-[10px] font-semibold text-gray-500 dark:bg-gray-800">
                              {asset.assignedTo.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="truncate text-sm font-medium leading-5 text-black dark:text-gray-200">
                            {asset.assignedTo.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-medium leading-5 text-black dark:text-gray-500">—</span>
                      )}
                    </div>

                    <div className="w-[130px] truncate text-[13px] font-medium leading-[18px] text-black dark:text-gray-300">
                      {asset.location ? ASSET_LOCATION_LABELS[asset.location] : "—"}
                    </div>

                    {!view && (
                      <div className="w-[120px] truncate text-sm font-medium leading-5 text-black dark:text-gray-300">
                        {asset.cateogry}
                      </div>
                    )}

                    <div className="w-[110px] text-sm font-semibold leading-5 text-black dark:text-white">
                      PKR {asset.cost.toLocaleString()}
                    </div>

                    <div className="w-[120px] text-[13px] font-medium leading-[18px] text-black dark:text-gray-300">
                      {fmtDate(asset.purchaseDate)}
                    </div>

                    <div className="w-[110px] overflow-hidden">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold leading-4 ${STATUS_STYLES[asset.status]}`}>
                        {ASSET_STATUS_LABELS[asset.status]}
                      </span>
                    </div>

                    <div className="flex w-[76px] shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(asset);
                        }}
                        aria-label={`Edit ${asset.name}`}
                        title="Edit asset"
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingAsset(asset);
                        }}
                        aria-label={`Delete ${asset.name}`}
                        title="Delete asset"
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view && <Pagination meta={tableQuery.data?.meta} onPageChange={setPage} />}
      </div>

      {/* Add Asset drawer */}
      <Drawer
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add new asset"
        description={view ? `Adding to ${view}.` : "Track a new piece of company hardware or software."}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              disabled={isSaving}
              className="ml-auto rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleAddAsset()}
              disabled={isSaving}
              className="rounded-lg bg-[#071936] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#10284d] disabled:opacity-50"
            >
              {isSaving ? "Adding…" : "Add Asset"}
            </button>
          </>
        }
      >
        <p className="-mt-1 text-[11px] text-gray-400">
          <span className="text-red-500">*</span> Required
        </p>

        <div id="add-asset-name">
          <label className={LABEL_CLS}>Asset name<RequiredMark /></label>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Dell Latitude 5450"
            aria-invalid={Boolean(addErrors.name)}
            className={`${INPUT_CLS} ${addErrors.name ? "border-red-500 ring-1 ring-red-500" : ""}`}
          />
          <FieldError message={addErrors.name} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div id="add-asset-cateogry">
            <label className={LABEL_CLS}>Category<RequiredMark /></label>
            <div className={invalidRing(Boolean(addErrors.cateogry))}>
              <CategoryPicker
                value={form.cateogry}
                onChange={(value) =>
                  setForm({ ...form, cateogry: value, specs: showsSpecs(value) ? form.specs : emptySpecsForm() })
                }
                options={categoryOptions}
                onCreateCategory={handleCreateCategory}
                placeholder="e.g. Laptop"
                labelFor={categoryLabel}
              />
            </div>
            <FieldError message={addErrors.cateogry} />
          </div>

          <div>
            <label className={LABEL_CLS}>Serial number</label>
            <input
              value={form.serianlNumber}
              onChange={(e) => setForm({ ...form, serianlNumber: e.target.value })}
              placeholder="Optional"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Cost (PKR)</label>
            <input
              type="number"
              min="0"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              placeholder="0"
              className={INPUT_CLS}
            />
          </div>

          <div id="add-asset-purchaseDate">
            <label className={LABEL_CLS}>Purchase date<RequiredMark /></label>
            <ControlledDatePicker
              id="add-asset-purchase-date"
              value={form.purchaseDate}
              onChange={(value) => setForm({ ...form, purchaseDate: value })}
              className={`${INPUT_CLS} pr-9 ${addErrors.purchaseDate ? "border-red-500 ring-1 ring-red-500" : ""}`}
            />
            <FieldError message={addErrors.purchaseDate} />
          </div>

          <div>
            <label className={LABEL_CLS}>Warranty until</label>
            <ControlledDatePicker
              id="add-asset-warranty-until"
              value={form.warrantyUntil}
              onChange={(value) => setForm({ ...form, warrantyUntil: value })}
              placeholder="Optional"
              className={`${INPUT_CLS} pr-9`}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Vendor</label>
            <input
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              placeholder="Optional"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Invoice number</label>
            <input
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              placeholder="Optional"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Status<RequiredMark /></label>
            <AccountingSelect
              label="Status"
              className=""
              value={form.status}
              onChange={(value) => {
                const status = value as AssetStatus;
                // Switching away from Assigned while an employee (or a
                // location) is still picked would otherwise save those
                // against a non-Assigned status — clear them so the fields
                // can't drift.
                setForm({
                  ...form,
                  status,
                  assignedToId: status === "ASSIGNED" ? form.assignedToId : "",
                  location: status === "ASSIGNED" ? form.location : "",
                });
              }}
              options={ASSET_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS_LABELS[s] }))}
            />
          </div>

          <div id="add-asset-assignedToId">
            <label className={LABEL_CLS}>
              Assigned to{form.status === "ASSIGNED" && <RequiredMark />}
            </label>
            <div className={invalidRing(Boolean(addErrors.assignedToId))}>
            <AccountingSelect
              label="Assigned to"
              className=""
              value={form.assignedToId}
              onChange={(assignedToId) => {
                // Picking someone implies the asset is now Assigned; clearing
                // it while Status was Assigned implies it's back to Available
                // — same behavior the dedicated unlink endpoint already has.
                setForm({
                  ...form,
                  assignedToId,
                  status: assignedToId ? "ASSIGNED" : form.status === "ASSIGNED" ? "AVAILABLE" : form.status,
                  location: assignedToId ? form.location : "",
                });
              }}
              options={[
                { value: "", label: form.status === "ASSIGNED" ? "Required" : "Unassigned" },
                ...employeeOptions.map((emp) => ({ value: emp.id, label: emp.name })),
              ]}
            />
            </div>
            <FieldError message={addErrors.assignedToId} />
          </div>

          {/* Only meaningful once the asset is actually assigned to someone;
              required whenever it's shown — see the assignedToId+location
              check in handleAddAsset. */}
          {form.status === "ASSIGNED" && (
            <div id="add-asset-location">
              <label className={LABEL_CLS}>Location<RequiredMark /></label>
              <div className={invalidRing(Boolean(addErrors.location))}>
                <AccountingSelect
                  label="Location"
                  className=""
                  value={form.location}
                  onChange={(value) => setForm({ ...form, location: value as AssetLocation })}
                  options={[
                    { value: "", label: "Select location" },
                    ...ASSET_LOCATIONS.map((loc) => ({ value: loc, label: ASSET_LOCATION_LABELS[loc] })),
                  ]}
                />
              </div>
              <FieldError message={addErrors.location} />
            </div>
          )}
        </div>

        {/* Laptop/desktop/phone/tablet only — device specs don't mean anything on
            a monitor, keyboard, network gear, etc. */}
        {showsSpecs(form.cateogry) && (
          <div>
            <p className={LABEL_CLS}>Specifications</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.specs.processor}
                onChange={(e) => setForm({ ...form, specs: { ...form.specs, processor: e.target.value } })}
                placeholder="Processor, e.g. Apple M3"
                className={INPUT_CLS}
              />
              <input
                value={form.specs.ram}
                onChange={(e) => setForm({ ...form, specs: { ...form.specs, ram: e.target.value } })}
                placeholder="RAM, e.g. 16GB"
                className={INPUT_CLS}
              />
              <input
                value={form.specs.storage}
                onChange={(e) => setForm({ ...form, specs: { ...form.specs, storage: e.target.value } })}
                placeholder="Storage, e.g. 512GB SSD"
                className={INPUT_CLS}
              />
              <input
                value={form.specs.os}
                onChange={(e) => setForm({ ...form, specs: { ...form.specs, os: e.target.value } })}
                placeholder="OS, e.g. macOS Sonoma"
                className={INPUT_CLS}
              />
              <input
                value={form.specs.screenSize}
                onChange={(e) => setForm({ ...form, specs: { ...form.specs, screenSize: e.target.value } })}
                placeholder="Screen size, e.g. 14&quot;"
                className={`${INPUT_CLS} col-span-2`}
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* Edit Asset drawer */}
      {editing && (
        <Drawer
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Edit asset"
          description={`${editing.name} · added ${fmtDate(editing.createdAt)}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeletingAsset(editing)}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/40"
              >
                <Trash2 size={14} />
                Delete
              </button>

              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={isSaving}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveAsset()}
                  disabled={isSaving}
                  className="rounded-lg bg-[#071936] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#10284d] disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </>
          }
        >
          <p className="-mt-1 text-[11px] text-gray-400">
            <span className="text-red-500">*</span> Required
          </p>

          <div id="edit-asset-name">
            <label className={LABEL_CLS}>Asset name<RequiredMark /></label>
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              aria-invalid={Boolean(editErrors.name)}
              className={`${INPUT_CLS} ${editErrors.name ? "border-red-500 ring-1 ring-red-500" : ""}`}
            />
            <FieldError message={editErrors.name} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div id="edit-asset-cateogry">
              <label className={LABEL_CLS}>Category<RequiredMark /></label>
              <div className={invalidRing(Boolean(editErrors.cateogry))}>
              <CategoryPicker
                value={editing.cateogry}
                onChange={(value) =>
                  setEditing({
                    ...editing,
                    cateogry: value,
                    // Leaving a spec category drops whatever was typed, so it
                    // can't be saved against e.g. a monitor.
                    ...(showsSpecs(value)
                      ? null
                      : { processor: null, ram: null, storage: null, os: null, screenSize: null }),
                  })
                }
                options={categoryOptions}
                onCreateCategory={handleCreateCategory}
                labelFor={categoryLabel}
              />
              </div>
              <FieldError message={editErrors.cateogry} />
            </div>

            <div>
              <label className={LABEL_CLS}>Serial number</label>
              <input
                value={editing.serianlNumber}
                onChange={(e) => setEditing({ ...editing, serianlNumber: e.target.value })}
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>Cost (PKR)</label>
              <input
                type="number"
                min="0"
                value={editing.cost}
                onChange={(e) => setEditing({ ...editing, cost: Number(e.target.value) })}
                className={INPUT_CLS}
              />
            </div>

            <div id="edit-asset-purchaseDate">
              <label className={LABEL_CLS}>Purchase date<RequiredMark /></label>
              <ControlledDatePicker
                id="edit-asset-purchase-date"
                value={editing.purchaseDate.slice(0, 10)}
                onChange={(value) => setEditing({ ...editing, purchaseDate: new Date(value).toISOString() })}
                className={`${INPUT_CLS} pr-9 ${editErrors.purchaseDate ? "border-red-500 ring-1 ring-red-500" : ""}`}
              />
              <FieldError message={editErrors.purchaseDate} />
            </div>

            <div>
              <label className={LABEL_CLS}>Warranty until</label>
              <ControlledDatePicker
                id="edit-asset-warranty-until"
                value={editing.warrantyUntil ? editing.warrantyUntil.slice(0, 10) : ""}
                onChange={(value) =>
                  setEditing({ ...editing, warrantyUntil: value ? new Date(value).toISOString() : null })
                }
                placeholder="Optional"
                className={`${INPUT_CLS} pr-9`}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>Vendor</label>
              <input
                value={editing.vendor ?? ""}
                onChange={(e) => setEditing({ ...editing, vendor: e.target.value })}
                placeholder="Optional"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>Invoice number</label>
              <input
                value={editing.invoiceNumber ?? ""}
                onChange={(e) => setEditing({ ...editing, invoiceNumber: e.target.value })}
                placeholder="Optional"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>Status<RequiredMark /></label>
              <AccountingSelect
                label="Status"
                className=""
                value={editing.status}
                onChange={(value) => {
                  const status = value as AssetStatus;
                  // Switching away from Assigned while an employee (or a
                  // location) is still picked would otherwise save those
                  // against a non-Assigned status — clear them so the
                  // fields can't drift.
                  setEditing({
                    ...editing,
                    status,
                    assignedToId: status === "ASSIGNED" ? editing.assignedToId : null,
                    location: status === "ASSIGNED" ? editing.location : null,
                  });
                }}
                options={ASSET_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS_LABELS[s] }))}
              />
            </div>

            <div id="edit-asset-assignedToId">
              <label className={LABEL_CLS}>
                Assigned to{editing.status === "ASSIGNED" && <RequiredMark />}
              </label>
              <div className={invalidRing(Boolean(editErrors.assignedToId))}>
              <AccountingSelect
                label="Assigned to"
                className=""
                value={editing.assignedToId ?? ""}
                onChange={(value) => {
                  const assignedToId = value || null;
                  // Picking someone implies the asset is now Assigned; clearing
                  // it while Status was Assigned implies it's back to Available
                  // — same behavior the dedicated unlink endpoint already has.
                  // This is exactly the bug a user hit: assigning here without
                  // this sync left status showing Available.
                  setEditing({
                    ...editing,
                    assignedToId,
                    status: assignedToId ? "ASSIGNED" : editing.status === "ASSIGNED" ? "AVAILABLE" : editing.status,
                    location: assignedToId ? editing.location : null,
                  });
                }}
                options={[
                  { value: "", label: editing.status === "ASSIGNED" ? "Required" : "Unassigned" },
                  ...employeeOptions.map((emp) => ({ value: emp.id, label: emp.name })),
                ]}
              />
              </div>
              <FieldError message={editErrors.assignedToId} />
            </div>

            {/* Only meaningful once the asset is actually assigned to someone;
                required whenever it's shown — see the assignedToId+location
                check in handleSaveAsset. */}
            {editing.status === "ASSIGNED" && (
              <div id="edit-asset-location">
                <label className={LABEL_CLS}>Location<RequiredMark /></label>
                <div className={invalidRing(Boolean(editErrors.location))}>
                  <AccountingSelect
                    label="Location"
                    className=""
                    value={editing.location ?? ""}
                    onChange={(value) => setEditing({ ...editing, location: (value as AssetLocation) || null })}
                    options={[
                      { value: "", label: "Select location" },
                      ...ASSET_LOCATIONS.map((loc) => ({ value: loc, label: ASSET_LOCATION_LABELS[loc] })),
                    ]}
                  />
                </div>
                <FieldError message={editErrors.location} />
              </div>
            )}
          </div>

          {/* Laptop/desktop/phone/tablet only — device specs don't mean anything on
              a monitor, keyboard, network gear, etc. */}
          {showsSpecs(editing.cateogry) && (
            <div>
              <p className={LABEL_CLS}>Specifications</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={editing.processor ?? ""}
                  onChange={(e) => setEditing({ ...editing, processor: e.target.value })}
                  placeholder="Processor, e.g. Apple M3"
                  className={INPUT_CLS}
                />
                <input
                  value={editing.ram ?? ""}
                  onChange={(e) => setEditing({ ...editing, ram: e.target.value })}
                  placeholder="RAM, e.g. 16GB"
                  className={INPUT_CLS}
                />
                <input
                  value={editing.storage ?? ""}
                  onChange={(e) => setEditing({ ...editing, storage: e.target.value })}
                  placeholder="Storage, e.g. 512GB SSD"
                  className={INPUT_CLS}
                />
                <input
                  value={editing.os ?? ""}
                  onChange={(e) => setEditing({ ...editing, os: e.target.value })}
                  placeholder="OS, e.g. macOS Sonoma"
                  className={INPUT_CLS}
                />
                <input
                  value={editing.screenSize ?? ""}
                  onChange={(e) => setEditing({ ...editing, screenSize: e.target.value })}
                  placeholder="Screen size, e.g. 14&quot;"
                  className={`${INPUT_CLS} col-span-2`}
                />
              </div>
            </div>
          )}
        </Drawer>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
          <div
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium text-white shadow-lg ${toast.type === "success"
                ? "bg-emerald-600"
                : toast.type === "error"
                  ? "bg-red-600"
                  : "bg-gray-900 dark:bg-gray-700"
              }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={14} />
            ) : toast.type === "error" ? (
              <AlertCircle size={14} />
            ) : (
              <Info size={14} />
            )}
            {toast.message}
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={deletingAsset !== null}
        title={deletingAsset ? `Delete ${deletingAsset.name}?` : ""}
        description="This can't be undone."
        confirmLabel="Delete asset"
        isLoading={isDeletingAsset}
        onConfirm={() => void handleDeleteAsset()}
        onClose={() => setDeletingAsset(null)}
      />
    </div>
  );
}
