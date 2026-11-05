"use client"; // Next.js App Router — uses hooks

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  assetsService,
  companyEmployeesService,
  EMPLOYEE_AVATAR_MAX_BYTES,
  EMPLOYEE_AVATAR_MIME_TYPES,
} from "@/services/it-management.service";
import Pagination from "@/components/common/Pagination";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import DepartmentPicker from "@/components/it-management/DepartmentPicker";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace.store";
import type {
  Asset,
  AssetLocation,
  CompanyEmployee,
  CreateCompanyEmployeePayload,
  EmployeeAssetBrief,
  UpdateCompanyEmployeePayload,
} from "@/types/it-management";
import {
  ASSET_LOCATIONS,
  ASSET_LOCATION_LABELS,
  ASSET_STATUS_LABELS,
  DEPARTMENTS,
  canonicalDepartment,
  departmentLabel,
} from "@/types/it-management";

/** Red asterisk for a required field's label. */
const RequiredMark = () => <span className="text-red-500" aria-hidden="true"> *</span>;

/* shared with the rest of the IT module (see it-management/page.tsx) */
const PAGE_BG = "bg-[#EDEFF2] dark:bg-gray-950";

const PAGE_SIZE = 20;

const drawerStyles = `
  @keyframes s9-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes s9-fade-in { from { opacity: 0; } to { opacity: 1; } }
  .s9-drawer-panel { animation: s9-drawer-in .32s cubic-bezier(.32,.72,0,1) both; }
  .s9-drawer-overlay { animation: s9-fade-in .2s ease-out both; }
  /* Chrome/Edge/Safari only paint the datalist dropdown arrow on :hover,
     via their UA stylesheet — a plain utility class loses to that on
     hover, so this needs !important and an explicit :hover rule too. */
  #s9-designation-input::-webkit-calendar-picker-indicator,
  #s9-designation-input:hover::-webkit-calendar-picker-indicator {
    display: none !important;
    opacity: 0 !important;
    appearance: none !important;
    -webkit-appearance: none !important;
  }
`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Fallback suggestions for a brand-new workspace with no employees yet to
 *  derive real designations from — see `designationOptionsSeed`. */
const DESIGNATION_SUGGESTIONS = [
  "Senior Engineer",
  "Backend Engineer",
  "Graphic Designer",
  "Brand Designer",
  "Product Designer",
  "Project Manager",
  "Financial Analyst",
  "Controller",
  "People Operations",
  "Account Executive",
  "Sales Lead",
  "Automation Tester",
  "IT Admin",
];

/** `designation` is free text server-side — nothing stops "Engineer" and
 *  "engineer" from being saved as two different values unless the write
 *  path reconciles casing itself. If an existing option already matches
 *  case-insensitively, reuse its exact casing rather than saving the newly
 *  typed variant; otherwise keep what the user typed (this is a human-facing
 *  label, so it isn't forced to a fixed case). `department` used to go
 *  through this too, but it's now a picker that also accepts a new name
 *  (see `DepartmentPicker`). */
function resolveCanonical(value: string, options: string[]): string {
  const trimmed = value.trim();
  const existing = options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
  return existing ?? trimmed;
}

/* ====================================================================
   Icons
==================================================================== */
function Icon({ className = "h-4 w-4", children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

const SearchIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon>
);
const MailIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></Icon>
);
const PlusIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><path d="M5 12h14" /><path d="M12 5v14" /></Icon>
);
const XIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>
);
const InboxIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </Icon>
);
const PencilIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></Icon>
);
const TrashIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}>
    <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
  </Icon>
);
const DotsIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
  </svg>
);

/* ====================================================================
   Avatar with initials fallback
==================================================================== */
function Avatar({ src, name, className = "" }: { src: string; name: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken || !src) {
    const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-100 font-semibold text-indigo-600 dark:from-indigo-500/20 dark:to-sky-500/20 dark:text-indigo-300 ${className}`}>
        {initials}
      </div>
    );
  }
  return <img src={src} alt={name} onError={() => setBroken(true)} className={`object-cover ${className}`} />;
}

/* ====================================================================
   Card surface — public/images/it/card-bg.svg rebuilt as a component.
   As a background-image the shape has to stretch to the card, which
   turns the 16px corner radii into ellipses and widens the notch as
   soon as the grid gives cards more than the 253px the file was drawn
   at. Re-emitting the path against the measured box keeps the radii
   and the notch at a constant size whatever the card ends up being.
==================================================================== */
const CARD_R = 16;        /* corner + notch fillet radius */
const CARD_NOTCH_W = 44.836;
const CARD_NOTCH_H = 42;

function cardSurfacePath(w: number, h: number) {
  const r = CARD_R;
  const nw = CARD_NOTCH_W;
  const nh = CARD_NOTCH_H;
  /* clockwise from the top-left corner; the one sweep-0 arc is the
     concave fillet where the notch turns back out to the right edge */
  return [
    `M${r} 0`,
    `H${w - nw - r}`,
    `A${r} ${r} 0 0 1 ${w - nw} ${r}`,
    `V${nh - r}`,
    `A${r} ${r} 0 0 0 ${w - nw + r} ${nh}`,
    `H${w - r}`,
    `A${r} ${r} 0 0 1 ${w} ${nh + r}`,
    `V${h - r}`,
    `A${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H${r}`,
    `A${r} ${r} 0 0 1 0 ${h - r}`,
    `V${r}`,
    `A${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join("");
}

function CardSurface() {
  const ref = useRef<HTMLDivElement>(null);
  /* the file's own dimensions, used until the box is measured */
  const [{ w, h }, setSize] = useState({ w: 253, h: 240 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        fill="none"
        className="text-white/50 dark:text-white/[0.04]"
      >
        <path d={cardSurfacePath(w, h)} fill="currentColor" />
      </svg>
    </div>
  );
}

/* ====================================================================
   Employee card (notched corner from card-bg.svg + ⋯ menu)
==================================================================== */
function EmployeeCard({
  employee,
  onOpen,
  onEdit,
  onDelete,
}: {
  employee: CompanyEmployee;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const first = employee.assets[0];

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
      }}
      className="group relative flex h-full min-h-60 cursor-pointer flex-col justify-between rounded-2xl p-4 transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#081735]"
    >
      <CardSurface />

      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        aria-label={`Options for ${employee.name}`}
        aria-expanded={menuOpen}
        className="absolute right-0 top-0 flex items-center justify-center rounded-full bg-white p-[5px] text-[#535A79] transition hover:bg-gray-50 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20"
      >
        <DotsIcon className="h-6 w-6" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
          <div className="absolute right-3 top-11 z-20 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-gray-800">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpen(); }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-600 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <InboxIcon className="h-3.5 w-3.5" /> View details
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-slate-600 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <PencilIcon className="h-3.5 w-3.5" /> Edit employee
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-red-500 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <TrashIcon className="h-3.5 w-3.5" /> Delete employee
            </button>
          </div>
        </>
      )}

      <div className="relative flex flex-col gap-4">
        <Avatar src={employee.imageUrl} name={employee.name} className="h-14 w-14 rounded-full ring-2 ring-white dark:ring-white/10" />

        <div className="flex w-full flex-col gap-1">
          <h3 className="truncate text-base font-semibold text-[#081735] dark:text-white">{employee.name}</h3>
          <p className="truncate text-xs text-[#535A79] dark:text-gray-400">{departmentLabel(employee.department)}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#535A79] dark:text-gray-400">
          <MailIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{employee.email}</span>
        </div>
      </div>

      <div className="relative flex items-end justify-between">
        <div className="flex items-center gap-1">
          {first ? (
            <>
              <span className="max-w-[170px] truncate rounded-full bg-white px-2 py-1 text-[10px] text-[#535A79] dark:bg-white/10 dark:text-gray-300">
                {first.name}
              </span>
              {employee._count.assets > 1 && (
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] text-[#535A79] dark:bg-white/10 dark:text-gray-300">
                  {employee._count.assets}+
                </span>
              )}
            </>
          ) : (
            <span className="rounded-full bg-white px-2 py-1 text-[10px] text-[#8F95B2] dark:bg-white/10 dark:text-gray-500">
              No assets
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ====================================================================
   Asset picker — lets the drawer assign an existing AVAILABLE asset to
   this employee. There is no "create asset from employee" flow server-side;
   assigning is done by patching the asset's own `assignedToId`.
==================================================================== */
function AssetPickerModal({
  workspaceId,
  onClose,
  onPick,
  isAssigning,
}: {
  workspaceId: string | null;
  onClose: () => void;
  /** Server-enforced: any asset with an `assignedToId` requires `location` —
   *  see the doc's Assets §"Assignment business rules". Picking an asset here
   *  doesn't assign it right away; it steps into a second "where is it"
   *  screen first so that PATCH never goes out missing the field it needs. */
  onPick: (asset: Asset, location: AssetLocation) => void;
  isAssigning: boolean;
}) {
  const query = useQuery({
    queryKey: queryKeys.itAssets(workspaceId, { status: "AVAILABLE", limit: 100 }),
    queryFn: () => assetsService.list({ status: "AVAILABLE", limit: 100 }),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const [pickedAsset, setPickedAsset] = useState<Asset | null>(null);
  // Prefill from the asset's last known location (e.g. one just unassigned
  // elsewhere) rather than forcing a re-pick when it's already known.
  const [location, setLocation] = useState<AssetLocation | "">("");

  const pick = (asset: Asset) => {
    setPickedAsset(asset);
    setLocation(asset.location ?? "");
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      {/* No `overflow-hidden` here — the Location step's dropdown (AccountingSelect,
          positioned absolutely off its own trigger, not portaled) needs to be able
          to overflow past this panel's bottom edge instead of getting clipped by it.
          Nothing touches the panel's raw corners (the header and both content
          branches all carry their own padding), so dropping it doesn't expose a
          square corner. */}
      <div className="relative z-10 max-h-[80vh] w-full max-w-md overflow-visible rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {pickedAsset ? "Where is it?" : "Assign an available asset"}
          </h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-gray-100 dark:hover:bg-white/10">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {pickedAsset ? (
          <div className="p-5">
            <div className="rounded-xl border border-gray-200 px-4 py-3 dark:border-white/10">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-gray-200">{pickedAsset.name}</p>
              <p className="truncate text-xs text-slate-400 dark:text-gray-500">{pickedAsset.cateogry} · {pickedAsset.serianlNumber}</p>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-gray-400">Location *</label>
              <AccountingSelect
                label="Location"
                className=""
                value={location}
                onChange={(value) => setLocation(value as AssetLocation)}
                options={[
                  { value: "", label: "Select location" },
                  ...ASSET_LOCATIONS.map((loc) => ({ value: loc, label: ASSET_LOCATION_LABELS[loc] })),
                ]}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPickedAsset(null)}
                disabled={isAssigning}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Back
              </button>
              <button
                onClick={() => location && onPick(pickedAsset, location)}
                disabled={!location || isAssigning}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200"
              >
                {isAssigning ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto p-3">
            {query.isLoading ? (
              <p className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">Loading…</p>
            ) : query.isError ? (
              <p className="py-10 text-center text-sm text-red-500">{parseApiError(query.error).message}</p>
            ) : (query.data?.items.length ?? 0) === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">No available assets to assign.</p>
            ) : (
              <div className="space-y-2">
                {query.data!.items.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => pick(asset)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-700 dark:text-gray-200">{asset.name}</span>
                      <span className="block truncate text-xs text-slate-400 dark:text-gray-500">{asset.cateogry} · {asset.serianlNumber}</span>
                    </span>
                    <PlusIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================================================================
   Employee details drawer (assigned assets)
==================================================================== */
function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-700 dark:text-gray-200">{value}</p>
    </div>
  );
}

function EmployeeDrawer({
  employee,
  onClose,
  onEdit,
  onUnassign,
  onAdd,
}: {
  employee: CompanyEmployee;
  onClose: () => void;
  onEdit: () => void;
  onUnassign: (asset: EmployeeAssetBrief) => void;
  onAdd: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(employee.assets[0]?.id ?? null);
  const assets = employee.assets;
  const openId =
    expandedId && assets.some((a) => a.id === expandedId) ? expandedId : assets[0]?.id ?? null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="s9-drawer-overlay absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Employee details: ${employee.name}`}
        className="s9-drawer-panel absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-gray-900 dark:text-white"
      >
        {/* header */}
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Employee Details</h2>
            <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">Everything assigned to this person, at a glance.</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              aria-label="Edit employee"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <PencilIcon />
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* profile */}
        <div className="mt-5 flex items-center gap-3 px-6">
          <Avatar src={employee.imageUrl} name={employee.name} className="h-14 w-14 shrink-0 rounded-2xl" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{employee.name}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
              {employee.designation} · {departmentLabel(employee.department)}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400 dark:text-gray-500">
              <MailIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{employee.email}</span>
            </p>
          </div>
        </div>

        {/* assets */}
        <div className="mt-6 flex items-center justify-between px-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Assigned Assets</h3>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:bg-white/10 dark:text-gray-400">
            {assets.length} total
          </span>
        </div>

        <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto px-6 pb-4">
          {assets.map((asset) =>
            asset.id === openId ? (
              <div key={asset.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{asset.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-slate-400 dark:text-gray-500">
                      {asset.serianlNumber}
                    </p>
                  </div>
                  <button
                    onClick={() => onUnassign(asset)}
                    aria-label={`Unassign ${asset.name}`}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3 dark:bg-white/5">
                  <Spec label="Category" value={asset.cateogry} />
                  <Spec label="Status" value={ASSET_STATUS_LABELS[asset.status]} />
                  <Spec label="Asset ID" value={asset.id.slice(0, 8)} />
                </div>
              </div>
            ) : (
              <div
                key={asset.id}
                className="flex items-center gap-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 transition hover:border-gray-300 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20"
              >
                <button
                  onClick={() => setExpandedId(asset.id)}
                  title="Show details"
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                >
                  <span className="truncate text-sm font-medium text-slate-700 dark:text-gray-200">{asset.name}</span>
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-slate-400 dark:text-gray-500">
                    {asset.serianlNumber}
                  </span>
                </button>
                <button
                  onClick={() => onUnassign(asset)}
                  aria-label={`Unassign ${asset.name}`}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          )}
          {assets.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-400 dark:text-gray-500">No assets assigned yet.</p>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-white/10">
          <p className="text-[11px] text-slate-400 dark:text-gray-500">Member since {fmtDate(employee.createdAt)}</p>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200"
          >
            <PlusIcon className="h-4 w-4" />
            Add Assets
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ====================================================================
   Add / Edit Employee drawer (matches design:
   avatar w/ pencil, Name, Department + Role/designation, Email)
==================================================================== */
/* dark:[color-scheme:dark] — without it, a native <select>'s open popup
   renders with the browser/OS's default light palette regardless of the
   page's dark theme, since only that property (not the dark: color
   classes) tells the browser which palette to draw its own chrome in. */
const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:[color-scheme:dark]";
const labelCls = "mb-1.5 block text-xs font-medium text-slate-500 dark:text-gray-400";

function EmployeeFormDrawer({
  editing,
  designationOptionsSeed,
  departmentOptions,
  onClose,
  onSave,
  isSaving,
}: {
  editing: CompanyEmployee | null;
  /** Suggested departments plus every one already in use, as stored values. */
  departmentOptions: string[];
  /** Distinct designations already in use — falls back to
   *  `DESIGNATION_SUGGESTIONS` only when the workspace has none yet. */
  designationOptionsSeed: string[];
  onClose: () => void;
  onSave: (payload: CreateCompanyEmployeePayload) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  // Free text: a suggestion, an existing department, or a new name typed in
  // the picker. A legacy value (e.g. "DESIGN") is simply kept as stored.
  const [department, setDepartment] = useState(editing?.department ?? "");
  const [attempted, setAttempted] = useState(false);
  const [designation, setDesignation] = useState(editing?.designation ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  // `imageUrl` is the saved/uploaded permanent URL; `avatarPreview` is a
  // local object URL shown immediately after picking, before the upload
  // (to S3, via the presign flow) finishes.
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Object URLs leak until revoked.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nameMissing = name.trim().length === 0;
  const departmentMissing = department.trim().length === 0;
  const valid = !nameMissing && emailValid && !departmentMissing && !isSaving && !uploadingAvatar;

  const designationOptions = designationOptionsSeed.length ? designationOptionsSeed : DESIGNATION_SUGGESTIONS;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after a failure
    if (!file) return;
    setAvatarError("");

    if (!EMPLOYEE_AVATAR_MIME_TYPES.includes(file.type as (typeof EMPLOYEE_AVATAR_MIME_TYPES)[number])) {
      setAvatarError("Photo must be a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > EMPLOYEE_AVATAR_MAX_BYTES) {
      setAvatarError("Photo must be 2MB or smaller.");
      return;
    }

    // Show the picked image straight away; the upload runs behind it.
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setUploadingAvatar(true);
    try {
      setImageUrl(await companyEmployeesService.uploadAvatar(file));
    } catch (err) {
      setAvatarError(parseApiError(err).message || "Couldn't upload the photo.");
      URL.revokeObjectURL(preview);
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="s9-drawer-overlay absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit employee" : "New employee"}
        className="s9-drawer-panel absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-gray-900 dark:text-white"
      >
        {/* header */}
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editing ? "Edit Employee" : "New Employee"}
            </h2>
            <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">
              {editing ? "Employee profile, department and contact info." : "Add a team member, their department and contact info."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <XIcon />
          </button>
        </div>

        {/* form */}
        <div className="mt-6 flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          {/* avatar + upload */}
          <div>
            <div className="relative inline-block">
              <Avatar
                src={avatarPreview ?? imageUrl}
                name={name || "?"}
                className={`h-16 w-16 rounded-full ${uploadingAvatar ? "opacity-60" : ""}`}
              />
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Change photo"
                title="Change photo"
                className="absolute -right-1.5 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={EMPLOYEE_AVATAR_MIME_TYPES.join(",")}
                className="hidden"
                onChange={(e) => void onFile(e)}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-gray-500">
              {uploadingAvatar ? "Uploading…" : "PNG, JPEG or WebP · max 2MB"}
            </p>
            {avatarError && <p className="mt-1 text-[11px] text-red-500">{avatarError}</p>}
          </div>

          <p className="-mb-2 text-[11px] text-slate-400 dark:text-gray-500">
            <span className="text-red-500">*</span> Required
          </p>

          <div>
            <label className={labelCls}>Name<RequiredMark /></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shoaib Ahmed"
              aria-invalid={attempted && nameMissing}
              className={`${inputCls} ${attempted && nameMissing ? "border-red-500 ring-1 ring-red-500" : ""}`}
            />
            {attempted && nameMissing && <p role="alert" className="mt-1.5 text-[11px] text-red-500">Name is required.</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Department<RequiredMark /></label>
              <DepartmentPicker
                value={department}
                onChange={setDepartment}
                options={departmentOptions}
                invalid={attempted && departmentMissing}
                className={inputCls}
              />
              {attempted && departmentMissing && (
                <p role="alert" className="mt-1.5 text-[11px] text-red-500">Choose or add a department.</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Role / designation</label>
              <input
                id="s9-designation-input"
                list="designation-options"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Engineer"
                // Chrome/Edge/Safari draw a small dropdown-arrow indicator
                // (only on hover) on any input with a `list` attribute —
                // hidden here via `drawerStyles` above with !important,
                // since that hover-only paint beats a plain utility class.
                className={inputCls}
              />
            </div>
          </div>
          <datalist id="designation-options">
            {designationOptions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>

          <div>
            <label className={labelCls}>Email<RequiredMark /></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={`${inputCls} ${(email || attempted) && !emailValid ? "border-red-300 focus:border-red-400 focus:ring-red-500/10 dark:border-red-500/40" : ""}`}
            />
            {(email || attempted) && !emailValid && (
              <p className="mt-1.5 text-[11px] text-red-500">
                {email ? "Enter a valid email address." : "Email is required."}
              </p>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-white/10">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            disabled={isSaving || uploadingAvatar}
            onClick={() => {
              setAttempted(true);
              if (!valid) return;
              onSave({
                name: name.trim(),
                email: email.trim(),
                imageUrl,
                department: canonicalDepartment(department, departmentOptions),
                designation: resolveCanonical(designation, designationOptions),
              });
            }}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200"
          >
            {isSaving
              ? "Saving…"
              : uploadingAvatar
                ? "Uploading photo…"
                : editing
                  ? "Save Changes"
                  : "Add Employee"}
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ====================================================================
   Page
==================================================================== */
export default function ItEmployeesPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const [activeDept, setActiveDept] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<CompanyEmployee | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<CompanyEmployee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Assign/unassign both change who's responsible for a physical asset — a
  // confirm step before either, same as delete. Both stack on top of the
  // drawer/picker they came from rather than replacing it.
  const [unassigningAsset, setUnassigningAsset] = useState<EmployeeAssetBrief | null>(null);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [pendingAssign, setPendingAssign] = useState<{ asset: Asset; location: AssetLocation } | null>(null);

  // A filter/search change can leave `page` pointing past the new result
  // set's last page — reset it whenever the query itself changes.
  useEffect(() => {
    setPage(1);
  }, [query, activeDept]);

  const listParams = useMemo(
    () => ({
      q: query.trim() || undefined,
      department: activeDept === "All" ? undefined : activeDept,
      page,
      limit: PAGE_SIZE,
    }),
    [query, activeDept, page]
  );

  const listQuery = useQuery({
    queryKey: queryKeys.companyEmployees(workspaceId, listParams),
    queryFn: () => companyEmployeesService.list(listParams),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const employees = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  /* Every employee, unpaginated — used only to derive the department/role
     facets (filter tabs, form comboboxes). Deliberately independent of
     `listQuery`: once the list itself is paginated, deriving facets from
     just the current page would make department tabs appear/disappear
     depending on which page happens to be showing. */
  const facetsQuery = useQuery({
    queryKey: queryKeys.companyEmployees(workspaceId, { limit: 100, facets: true }),
    queryFn: () => companyEmployeesService.list({ limit: 100 }),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
  const allEmployees = useMemo(() => facetsQuery.data?.items ?? [], [facetsQuery.data]);

  const departments = useMemo(
    () => ["All", ...Array.from(new Set(allEmployees.map((e) => e.department).filter(Boolean)))],
    [allEmployees]
  );

  /* Suggested departments first, then any custom ones already in use, so a team
     added once is offered to the next employee too. */
  const departmentOptions = useMemo(() => {
    const known = new Set<string>(DEPARTMENTS);
    const custom = Array.from(
      new Set(allEmployees.map((e) => e.department).filter((d) => d && !known.has(d)))
    ).sort((a, b) => a.localeCompare(b));
    return [...DEPARTMENTS, ...custom];
  }, [allEmployees]);

  const designations = useMemo(
    () => Array.from(new Set(allEmployees.map((e) => e.designation).filter(Boolean))),
    [allEmployees]
  );

  const selected = employees.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && !formOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSelectedId(null); closeForm(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, formOpen]);

  /* Root-only key — see the matching comment in the assets page's
     invalidateAssets: a key with workspaceId at index 1 misses the "detail"
     sub-query, which nests a different second segment. */
  const invalidateEmployees = () =>
    queryClient.invalidateQueries({ queryKey: ["company-employees"] });

  const closeForm = () => { setFormOpen(false); setEditingEmployee(null); };

  const openCreate = () => { setEditingEmployee(null); setSelectedId(null); setFormOpen(true); };
  const openEdit = (employee: CompanyEmployee) => { setEditingEmployee(employee); setSelectedId(null); setFormOpen(true); };

  const unassignAsset = async (employeeId: string, asset: EmployeeAssetBrief) => {
    setIsUnassigning(true);
    try {
      await companyEmployeesService.unlinkAsset(employeeId, asset.id);
      invalidateEmployees();
      queryClient.invalidateQueries({ queryKey: ["it-assets"] });
      toast.success(`${asset.name} unassigned.`);
      setUnassigningAsset(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't unassign that asset.");
      setUnassigningAsset(null);
    } finally {
      setIsUnassigning(false);
    }
  };

  const assignAsset = async (employeeId: string, asset: Asset, location: AssetLocation) => {
    setIsAssigning(true);
    try {
      await assetsService.update(asset.id, { assignedToId: employeeId, status: "ASSIGNED", location });
      invalidateEmployees();
      queryClient.invalidateQueries({ queryKey: ["it-assets"] });
      toast.success(`${asset.name} assigned.`);
      setPendingAssign(null);
      setPickerOpen(false);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't assign that asset.");
      setPendingAssign(null);
    } finally {
      setIsAssigning(false);
    }
  };

  const saveEmployee = async (payload: CreateCompanyEmployeePayload) => {
    setIsSaving(true);
    try {
      if (editingEmployee) {
        const updatePayload: UpdateCompanyEmployeePayload = payload;
        await companyEmployeesService.update(editingEmployee.id, updatePayload);
        toast.success(`${payload.name} updated.`);
      } else {
        await companyEmployeesService.create(payload);
        toast.success(`${payload.name} added.`);
      }
      invalidateEmployees();
      closeForm();
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't save that employee.");
    } finally {
      setIsSaving(false);
    }
  };

  /** Unconditional server-side — any assets assigned to this employee get
   *  `assignedToId` cleared (SET NULL) rather than blocking the delete, so
   *  no separate "reassign their assets first" step is needed here. */
  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    setIsDeleting(true);
    try {
      await companyEmployeesService.delete(deletingEmployee.id);
      invalidateEmployees();
      queryClient.invalidateQueries({ queryKey: ["it-assets"] });
      toast.success(`${deletingEmployee.name} deleted.`);
      // Close anything else open on this employee — deleting them out from
      // under an open details/edit drawer would otherwise leave it showing
      // a now-nonexistent record.
      if (selectedId === deletingEmployee.id) setSelectedId(null);
      if (editingEmployee?.id === deletingEmployee.id) closeForm();
      setDeletingEmployee(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't delete that employee.");
    } finally {
      setIsDeleting(false);
    }
  };

  // `h-full`, not `h-screen` — this div renders inside AdminLayoutClient's
  // `<main>`, whose actual height is the viewport minus the header and
  // margins, not the full 100vh `h-screen` claims. Since `main` itself is
  // `overflow-hidden` (for its rounded corners, not scrolling), the excess
  // spilled past its shorter real height, clipping whatever sat at the very
  // bottom — the pagination controls — out of view and out of scroll reach.
  // `h-full` instead inherits `main`'s real box.
  return (
    <div className={`h-full overflow-y-auto ${PAGE_BG} px-4 py-6 sm:px-6 lg:px-8`}>
      <style>{drawerStyles}</style>

      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[29px] font-medium leading-10 text-[#081735] dark:text-white">Employees</h1>
          <p className="text-sm font-medium text-[#8F95B2] dark:text-gray-400">
            {listQuery.data?.meta.total ?? employees.length} people across {Math.max(0, departments.length - 1)} departments
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#081735] px-5 py-3 text-base font-medium text-white shadow-sm transition hover:bg-[#12224a] active:scale-[0.98] dark:bg-white dark:text-[#081735] dark:hover:bg-gray-200"
        >
          <PlusIcon className="h-4 w-4" />
          Add employee
        </button>
      </div>

      {/* filters + search */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {departments.map((dept) => {
            const active = dept === activeDept;
            return (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`rounded-full px-[18px] py-2 font-medium transition ${active
                    ? "bg-[#081735] text-base text-white shadow-sm dark:bg-white dark:text-[#081735]"
                    : "border border-[#E6E8F0] bg-white text-sm text-[#8F95B2] hover:text-[#081735] dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-400 dark:hover:text-gray-100"
                  }`}
              >
                {dept === "All" ? dept : departmentLabel(dept)}
              </button>
            );
          })}
        </div>
        <div className="relative lg:w-80">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8F95B2]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            className="w-full rounded-[10px] border border-[#E6E8F0] bg-white py-2.5 pl-10 pr-4 text-sm text-[#081735] outline-none transition placeholder:text-[#8F95B2]/50 focus:border-[#8F95B2] focus:ring-4 focus:ring-[#081735]/5 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-white/20"
          />
        </div>
      </div>

      {/* grid */}
      {listQuery.isLoading ? (
        <div className="mt-10 flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#081735] border-t-transparent dark:border-white dark:border-t-transparent" />
        </div>
      ) : listQuery.isError ? (
        <div className="mt-10 rounded-2xl border border-[#E6E8F0] px-6 py-16 text-center dark:border-white/10">
          <p className="text-sm font-medium text-[#081735] dark:text-gray-200">Couldn&apos;t load employees</p>
          <p className="mt-1 text-xs text-[#8F95B2] dark:text-gray-500">{parseApiError(listQuery.error).message}</p>
          <button
            onClick={() => listQuery.refetch()}
            className="mt-4 rounded-full bg-[#081735] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-[#12224a] dark:bg-white dark:text-[#081735]"
          >
            Try again
          </button>
        </div>
      ) : employees.length > 0 ? (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {employees.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                onOpen={() => setSelectedId(employee.id)}
                onEdit={() => openEdit(employee)}
                onDelete={() => setDeletingEmployee(employee)}
              />
            ))}
          </div>
          <Pagination meta={listQuery.data?.meta} onPageChange={setPage} />
        </>
      ) : (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-white/[0.06]">
            <InboxIcon className="h-5 w-5 text-[#8F95B2]" />
          </div>
          <p className="mt-4 text-sm font-medium text-[#081735] dark:text-gray-200">No people found</p>
          <p className="mt-1 text-xs text-[#8F95B2] dark:text-gray-500">Try a different department or search term.</p>
        </div>
      )}

      {/* details drawer */}
      {selected && (
        <EmployeeDrawer
          key={selected.id}
          employee={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => openEdit(selected)}
          onUnassign={(asset) => setUnassigningAsset(asset)}
          onAdd={() => setPickerOpen(true)}
        />
      )}

      {/* asset picker (assigns an existing AVAILABLE asset to the selected employee) */}
      {selected && pickerOpen && (
        <AssetPickerModal
          workspaceId={workspaceId}
          isAssigning={isAssigning}
          onClose={() => setPickerOpen(false)}
          onPick={(asset, location) => setPendingAssign({ asset, location })}
        />
      )}

      {/* add / edit drawer (sits above details drawer) */}
      {formOpen && (
        <EmployeeFormDrawer
          key={editingEmployee?.id ?? "new"}
          editing={editingEmployee}
          designationOptionsSeed={designations}
          departmentOptions={departmentOptions}
          isSaving={isSaving}
          onClose={closeForm}
          onSave={(payload) => void saveEmployee(payload)}
        />
      )}

      <ConfirmActionModal
        isOpen={deletingEmployee !== null}
        title={deletingEmployee ? `Delete ${deletingEmployee.name}?` : ""}
        description="This can't be undone. Any assets assigned to them will be unassigned, not deleted."
        confirmLabel="Delete employee"
        isLoading={isDeleting}
        onConfirm={() => void handleDeleteEmployee()}
        onClose={() => setDeletingEmployee(null)}
      />

      <ConfirmActionModal
        isOpen={unassigningAsset !== null}
        title={unassigningAsset ? `Unassign ${unassigningAsset.name}?` : ""}
        description={`It will go back to the available pool${selected ? ` and no longer show under ${selected.name}` : ""}.`}
        confirmLabel="Unassign asset"
        isLoading={isUnassigning}
        onConfirm={() => {
          if (selected && unassigningAsset) void unassignAsset(selected.id, unassigningAsset);
        }}
        onClose={() => setUnassigningAsset(null)}
      />

      <ConfirmActionModal
        isOpen={pendingAssign !== null}
        title={pendingAssign && selected ? `Assign ${pendingAssign.asset.name} to ${selected.name}?` : ""}
        description="They'll be responsible for this asset going forward."
        confirmLabel="Assign asset"
        isLoading={isAssigning}
        onConfirm={() => {
          if (selected && pendingAssign) void assignAsset(selected.id, pendingAssign.asset, pendingAssign.location);
        }}
        onClose={() => setPendingAssign(null)}
      />
    </div>
  );
}
