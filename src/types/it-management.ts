/**
 * IT Management — company-owned assets, the people they're assigned to, and
 * hardware/software purchase requests. Mirrors what `/assets`,
 * `/company-employees` and `/it-requests` actually return.
 *
 * `CompanyEmployee` here is a **separate** entity from the accounting
 * module's `Employee` (commission tracking, `src/services/accounting.service.ts`)
 * — same word, different Prisma model, different endpoints. Don't conflate them.
 */

import type { Notification } from "./notification";

/** The app's standard paginated envelope. */
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

export type SortOrder = "asc" | "desc";

// ── Assets ────────────────────────────────────────────────────────────────

/**
 * The only four values `AssetStatus` accepts server-side. There is no
 * `RETIRED` — a dead/retired asset is `DEAD`.
 */
export const ASSET_STATUSES = [
  "ASSIGNED",
  "AVAILABLE",
  "UNDER_REPAIR",
  "DEAD",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  ASSIGNED: "Assigned",
  AVAILABLE: "Available",
  UNDER_REPAIR: "Under Repair",
  DEAD: "Dead",
};

/**
 * Suggested categories for the picker — `cateogry` (sic, matches the DB
 * column) is free text server-side, not a closed enum, so this is a
 * convenience list, not a validation constraint. Any non-empty string is
 * accepted.
 */
export const ASSET_CATEGORY_SUGGESTIONS = [
  "LAPTOP",
  "DESKTOP",
  "MONITOR",
  "KEYBOARD",
  "MOUSE",
  "NETWORK",
  "PHONE",
  "TABLET",
  "ACCESSORY",
] as const;

/** Friendly display label for each suggestion — the category picker shows
 *  these ("PC", "Mobile") instead of the raw value actually sent/stored
 *  ("DESKTOP", "PHONE"). Only covers the fixed suggestions; a custom
 *  category typed into the picker has no entry here and falls back to
 *  showing its own (uppercased) text as-is. */
export const ASSET_CATEGORY_LABELS: Record<(typeof ASSET_CATEGORY_SUGGESTIONS)[number], string> = {
  LAPTOP: "Laptop",
  DESKTOP: "PC",
  MONITOR: "Monitor",
  KEYBOARD: "Keyboard",
  MOUSE: "Mouse",
  NETWORK: "Network",
  PHONE: "Mobile",
  TABLET: "Tablet",
  ACCESSORY: "Accessory",
};

/** Categories whose Add/Edit Asset form shows the specs fields below
 *  (laptop/pc/mobile/tablet, in product terms). */
export const SPEC_CATEGORIES = ["LAPTOP", "DESKTOP", "PHONE", "TABLET"] as const;

/**
 * Device specs — only meaningful (and only collected in the form) for a
 * `SPEC_CATEGORIES` category. These are flat top-level fields on the asset,
 * *not* a nested `specs` object: that's exactly how `AssetResponseDto`,
 * `CreateAssetDto` and `UpdateAssetDto` define them server-side. Every one
 * is free text and optional.
 */
export type AssetSpecs = {
  processor?: string;
  ram?: string;
  storage?: string;
  os?: string;
  screenSize?: string;
};

/**
 * Where an assigned asset physically sits. Only meaningful once an asset is
 * `ASSIGNED` — the picker hides this field for any other status. Unlike
 * `cateogry`, this *is* a closed enum server-side — send one of these exact
 * values, not the display label.
 */
export const ASSET_LOCATIONS = [
  "FIRST_FLOOR",
  "SECOND_FLOOR",
  "THIRD_FLOOR",
  "HK_TEAM",
  "TRIO",
] as const;
export type AssetLocation = (typeof ASSET_LOCATIONS)[number];

export const ASSET_LOCATION_LABELS: Record<AssetLocation, string> = {
  FIRST_FLOOR: "1st Floor",
  SECOND_FLOOR: "2nd Floor",
  THIRD_FLOOR: "3rd Floor",
  HK_TEAM: "HK Team",
  TRIO: "TRIO",
};

/** The employee an asset is assigned to, as embedded on `AssetResponseDto`. */
export type AssignedEmployeeBrief = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  department: string;
  designation: string;
};

/**
 * `serianlNumber`/`cateogry` are spelled exactly as the API returns them —
 * typos in the underlying DB column, not a transcription error here. Do not
 * "fix" the spelling; doing so would silently break every request.
 */
export type Asset = {
  id: string;
  name: string;
  serianlNumber: string;
  cateogry: string;
  /** ISO datetime. */
  purchaseDate: string;
  cost: number;
  status: AssetStatus;
  assignedToId: string | null;
  assignedTo: AssignedEmployeeBrief | null;
  /** Only meaningful when `status` is `ASSIGNED`; `null` otherwise. */
  location: AssetLocation | null;
  /** ISO datetime, or `null` if the asset has no tracked warranty. */
  warrantyUntil: string | null;
  vendor: string | null;
  invoiceNumber: string | null;
  /* Flat spec fields — see {@link AssetSpecs}. Only populated for a
     `SPEC_CATEGORIES` category; empty string otherwise. */
  processor: string | null;
  ram: string | null;
  storage: string | null;
  os: string | null;
  screenSize: string | null;
  createdAt: string;
  updatedAt: string;
};

/** One entry of `GET /assets/summary`'s `stats` array — per-category rollup. */
export type AssetCategorySummary = {
  category: string;
  total: number;
  assigned: number;
  available: number;
};

/** `GET /assets/summary`. `latestAssets` is the 6 most recently created
 *  assets in the workspace, newest first, same shape as {@link Asset}. */
export type AssetsSummary = {
  stats: AssetCategorySummary[];
  latestAssets: Asset[];
};

export type CreateAssetPayload = {
  name: string;
  serianlNumber?: string;
  cateogry: string;
  /** ISO datetime. */
  purchaseDate: string;
  cost?: number;
  status: AssetStatus;
  /** Must be a `CompanyEmployee` in the current workspace, or 404. */
  assignedToId?: string;
  /** Only sent when `status` is `ASSIGNED`. */
  location?: AssetLocation;
  /** ISO datetime. */
  warrantyUntil?: string;
  vendor?: string;
  invoiceNumber?: string;
  /* Flat spec fields — only sent for a `SPEC_CATEGORIES` category. */
  processor?: string;
  ram?: string;
  storage?: string;
  os?: string;
  screenSize?: string;
};

/** Every field optional; `.refine` on the server rejects an empty body. */
export type UpdateAssetPayload = {
  name?: string;
  serianlNumber?: string;
  cateogry?: string;
  purchaseDate?: string;
  cost?: number;
  status?: AssetStatus;
  /** `null` clears the assignment. */
  assignedToId?: string | null;
  /** `null` clears it — sent that way whenever status moves off `ASSIGNED`. */
  location?: AssetLocation | null;
  /** `null` clears it. ISO datetime. */
  warrantyUntil?: string | null;
  vendor?: string | null;
  invoiceNumber?: string | null;
  /* Flat spec fields — cleared (sent empty) when the category moves off a
     `SPEC_CATEGORIES` value. */
  processor?: string | null;
  ram?: string | null;
  storage?: string | null;
  os?: string | null;
  screenSize?: string | null;
};

export type AssetListParams = {
  q?: string;
  cateogry?: string;
  status?: AssetStatus;
  assignedToId?: string;
  department?: string;
  purchaseDateFrom?: string;
  purchaseDateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "purchaseDate" | "cost" | "createdAt" | "updatedAt";
  sortOrder?: SortOrder;
};

// ── Company employees ────────────────────────────────────────────────────

/**
 * Departments offered first in the employee form. No longer a closed set: the
 * server stores free text, so an IT manager can also type a new department.
 * Legacy rows keep these upper-case values.
 */
export const DEPARTMENTS = [
  "DESIGN",
  "DEVELOPMENT",
  "SALES",
  "HR",
  "ACCOUNTS",
  "TRIO",
  "CONTENT_WRITER",
  "SOCIAL_MEDIA",
  "OTHER",
] as const;

/** A suggested value above, or any department name typed by an IT manager. */
export type Department = string;

export const DEPARTMENT_LABELS: Record<string, string> = {
  DESIGN: "Design",
  DEVELOPMENT: "Development",
  SALES: "Sales",
  HR: "HR",
  ACCOUNTS: "Accounts",
  TRIO: "TRIO",
  CONTENT_WRITER: "Content Writer",
  SOCIAL_MEDIA: "Social Media",
  OTHER: "Other",
};

/** Display text for a stored department: a suggestion's label, or a custom
 *  department exactly as it was typed. */
export function departmentLabel(department: string): string {
  return DEPARTMENT_LABELS[department] ?? department;
}

/** Longest department name the server accepts. */
export const DEPARTMENT_NAME_MAX_LENGTH = 60;

/** An asset as embedded on `CompanyEmployeeResponseDto` — deliberately
 *  narrower than {@link Asset}: no purchase/assignment metadata. */
export type EmployeeAssetBrief = {
  id: string;
  name: string;
  serianlNumber: string;
  cateogry: string;
  status: AssetStatus;
};

export type CompanyEmployee = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  department: string;
  designation: string;
  createdAt: string;
  updatedAt: string;
  _count: { assets: number };
  /** Newest first. Always embedded — not detail-only. */
  assets: EmployeeAssetBrief[];
};

export type CreateCompanyEmployeePayload = {
  name: string;
  email: string;
  imageUrl?: string;
  department?: Department;
  designation?: string;
};

/** Every field optional; `.refine` on the server rejects an empty body. */
export type UpdateCompanyEmployeePayload = {
  name?: string;
  email?: string;
  imageUrl?: string;
  department?: Department;
  designation?: string;
};

export type CompanyEmployeeListParams = {
  q?: string;
  department?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "department" | "designation" | "createdAt" | "updatedAt";
  sortOrder?: SortOrder;
};

// ── IT requests ───────────────────────────────────────────────────────────

export const IT_REQUEST_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type ItRequestPriority = (typeof IT_REQUEST_PRIORITIES)[number];

export const IT_REQUEST_TYPES = ["HARDWARE", "SOFTWARE"] as const;
export type ItRequestType = (typeof IT_REQUEST_TYPES)[number];

/** The wizard's "Reason" chip group — a closed set server-side (unlike
 *  `category`, which is free text and varies by `requestType`). */
export const IT_REQUEST_REASONS = [
  "NEW_HIRE",
  "REPLACEMENT",
  "UPGRADE",
  "BROKEN_LOST",
  "ADDITIONAL",
] as const;
export type ItRequestReason = (typeof IT_REQUEST_REASONS)[number];

export const IT_REQUEST_REASON_LABELS: Record<ItRequestReason, string> = {
  NEW_HIRE: "New Hire",
  REPLACEMENT: "Replacement",
  UPGRADE: "Upgrade",
  BROKEN_LOST: "Broken/Lost",
  ADDITIONAL: "Additional",
};

/** Where the requester will use this item — the wizard's "Location" toggle. */
export const IT_REQUEST_LOCATIONS = ["OFFICE", "REMOTE"] as const;
export type ItRequestLocation = (typeof IT_REQUEST_LOCATIONS)[number];

export const IT_REQUEST_LOCATION_LABELS: Record<ItRequestLocation, string> = {
  OFFICE: "Office",
  REMOTE: "Remote",
};

/** Suggestions only, like `ASSET_CATEGORY_SUGGESTIONS` — `category` is free
 *  text server-side, not a closed enum. HARDWARE and SOFTWARE don't share
 *  one list. */
export const IT_REQUEST_HARDWARE_CATEGORIES = [
  "Laptop",
  "Desktop",
  "Monitor",
  "Peripherals",
  "Accessories",
  "Mobile",
  "Networking",
  "Printer",
  "Other",
] as const;
export const IT_REQUEST_SOFTWARE_CATEGORIES = [
  "Design",
  "Development",
  "Productivity",
  "Communication",
  "Security",
  "Analytics",
  "Other",
] as const;

/** One uploaded supporting file — from `itRequestsService.uploadAttachment`. */
export type ItRequestAttachment = { url: string; name: string };

/**
 * Every request is created as `REQUESTED` — the server ignores any status
 * sent at creation. From there the state machine is:
 * `REQUESTED → APPROVED | REJECTED | WITHDRAWN`, `APPROVED → PURCHASED | REJECTED`,
 * `PURCHASED → DELIVERED`. `WITHDRAWN` is set only by the requester themselves
 * (`itRequestsService.withdraw`), never via `updateStatus`.
 * `REJECTED`/`DELIVERED`/`WITHDRAWN` are terminal.
 */
export const IT_REQUEST_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "PURCHASED",
  "DELIVERED",
  "WITHDRAWN",
] as const;
export type ItRequestStatus = (typeof IT_REQUEST_STATUSES)[number];

/** The employee who filed the request, as embedded on `ItRequestResponseDto`. */
export type RequestedByBrief = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  department: string;
  designation: string;
};

export type ItRequest = {
  id: string;
  itemName: string;
  priority: ItRequestPriority;
  quantity: number;
  /** ISO datetime. */
  requestedDate: string;
  cost: number;
  requestType: ItRequestType;
  requestStatus: ItRequestStatus;
  requestedById: string | null;
  requestedBy: RequestedByBrief | null;
  /** Defaults to the requester's own `CompanyEmployee.department` when not
   *  given at creation — independent of it afterward, the two can drift. */
  department: Department | null;
  /** Free text, suggestions only — see {@link IT_REQUEST_HARDWARE_CATEGORIES}
   *  / {@link IT_REQUEST_SOFTWARE_CATEGORIES}. */
  category: string | null;
  /** Flat key-value spec answers — keys vary by `requestType` and aren't
   *  validated server-side beyond "a string-to-string map". */
  specifications: Record<string, string> | null;
  reason: ItRequestReason | null;
  businessJustification: string | null;
  location: ItRequestLocation | null;
  attachments: ItRequestAttachment[];
  createdAt: string;
  updatedAt: string;
};

/** `GET /it-requests/summary` — one entry per `requestType`. */
export type ItRequestSummary = {
  requestType: ItRequestType;
  /** Count with status in `[REQUESTED, APPROVED]`. */
  openCount: number;
  estimatedSpend: number;
};

export type CreateItRequestPayload = {
  itemName: string;
  priority: ItRequestPriority;
  quantity?: number;
  /** ISO datetime. */
  requestedDate: string;
  cost?: number;
  requestType: ItRequestType;
  /** IT manager/OWNER only — a `CompanyEmployee` in the current workspace, or
   *  404. Omit to create the request for yourself; the server resolves (or
   *  auto-creates) your own linked `CompanyEmployee` row. */
  requestedById?: string;
  /** Defaults to the requester's own department when omitted. */
  department?: Department;
  category: string;
  specifications?: Record<string, string>;
  reason?: ItRequestReason;
  businessJustification: string;
  location?: ItRequestLocation;
  /** From `itRequestsService.uploadAttachment`, up to 5. */
  attachments?: ItRequestAttachment[];
};

/** `requestStatus` is deliberately absent — transition it via
 *  `itRequestsService.updateStatus` instead, the only route that accepts it. */
export type UpdateItRequestPayload = {
  itemName?: string;
  priority?: ItRequestPriority;
  quantity?: number;
  requestedDate?: string;
  cost?: number;
  requestType?: ItRequestType;
  requestedById?: string | null;
  department?: Department | null;
  category?: string;
  specifications?: Record<string, string> | null;
  reason?: ItRequestReason | null;
  businessJustification?: string;
  location?: ItRequestLocation | null;
  /** Replaces the whole list, not a merge. */
  attachments?: ItRequestAttachment[];
};

/** `PATCH /it-requests/:id/status` — IT manager/OWNER only. `REQUESTED` and
 *  `WITHDRAWN` are never valid targets here — withdrawal is the requester's
 *  own action, via `itRequestsService.withdraw` instead. */
export type UpdateItRequestStatusPayload = {
  status: "APPROVED" | "REJECTED" | "PURCHASED" | "DELIVERED";
};

export type ItRequestListParams = {
  q?: string;
  requestType?: ItRequestType;
  requestStatus?: ItRequestStatus;
  priority?: ItRequestPriority;
  requestedById?: string;
  page?: number;
  limit?: number;
  sortBy?: "itemName" | "cost" | "requestedDate" | "createdAt" | "updatedAt";
  sortOrder?: SortOrder;
};

// ── IT bills ──────────────────────────────────────────────────────────────

/** The only two values ever *stored* — `create`/`update` reject the other
 *  two as input (422). */
export const IT_BILL_STORED_STATUSES = ["PENDING", "PAID"] as const;
export type ItBillStoredStatus = (typeof IT_BILL_STORED_STATUSES)[number];

/**
 * `DUE_SOON`/`OVERDUE` are computed fresh on every response from `dueDate`
 * vs. "now" — never persisted. All four are valid `?status=` filter values
 * though; the server translates the computed two into real `dueDate`
 * conditions. See the doc's "Computed status" note (§6).
 */
export const IT_BILL_STATUSES = ["PENDING", "DUE_SOON", "PAID", "OVERDUE"] as const;
export type ItBillStatus = (typeof IT_BILL_STATUSES)[number];

export const IT_BILL_STATUS_LABELS: Record<ItBillStatus, string> = {
  PENDING: "Pending",
  DUE_SOON: "Due Soon",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

export type ItBill = {
  id: string;
  vendor: string;
  invoiceNumber: string;
  /** ISO datetime. */
  purchaseDate: string;
  /** ISO datetime, or `null` if untracked (always reads as `PENDING`). */
  dueDate: string | null;
  cost: number;
  status: ItBillStatus;
  fileUrl: string | null;
  fileName: string | null;
  /** Stamped the moment `status` becomes `PAID`. ISO datetime. */
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** `GET /it-bills/summary`, and also embedded in `GET /it-bills`'s response.
 *  `outstanding` = `PENDING + DUE_SOON + OVERDUE` combined. Always
 *  workspace-wide — independent of whatever filters the list call used. */
export type ItBillsSummary = {
  outstanding: number;
  dueSoon: number;
  overdue: number;
  paid: number;
};

export type CreateItBillPayload = {
  vendor: string;
  invoiceNumber: string;
  /** ISO datetime. */
  purchaseDate: string;
  /** ISO datetime. */
  dueDate?: string;
  cost?: number;
  /** Only `PENDING`/`PAID` accepted — the computed values 422. */
  status?: ItBillStoredStatus;
  fileUrl?: string;
  fileName?: string;
};

/** Every field optional; `.refine` on the server rejects an empty body. */
export type UpdateItBillPayload = {
  vendor?: string;
  invoiceNumber?: string;
  purchaseDate?: string;
  dueDate?: string | null;
  cost?: number;
  status?: ItBillStoredStatus;
  fileUrl?: string | null;
  fileName?: string | null;
};

export type ItBillListParams = {
  q?: string;
  status?: ItBillStatus;
  dueDateFrom?: string;
  dueDateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: "vendor" | "invoiceNumber" | "purchaseDate" | "dueDate" | "cost" | "createdAt" | "updatedAt";
  sortOrder?: SortOrder;
};

// ── Dashboard ─────────────────────────────────────────────────────────────

/** `GET /it-dashboard/overview` — one call powers the whole main screen. */
export type DashboardOverview = {
  assets: { total: number; assigned: number; available: number };
  /** `departmentsCount` = distinct departments with >=1 employee. */
  employees: { total: number; departmentsCount: number };
  /** Bills not yet `PAID`. */
  bills: { pendingCount: number; outstanding: number };
  /** `warrantyUntil` within 30 days, not already expired. */
  warranties: { expiringCount: number };
  /** 10 most recently created assets. */
  recentAssets: Asset[];
  /** 0-3 items, most-urgent first. Any of the 3 slots with no candidate is
   *  simply omitted — never a null placeholder. */
  actionRequired: DashboardActionItem[];
  /** The viewer's own most recent 6. Empty unless the viewer is an
   *  OWNER or MANAGER. */
  latestNotifications: Notification[];
};

export type DashboardActionItem =
  | {
      type: "BILL_OVERDUE";
      billId: string;
      vendor: string;
      invoiceNumber: string;
      cost: number;
      dueDate: string | null;
    }
  | {
      type: "BILL_DUE_SOON";
      billId: string;
      vendor: string;
      invoiceNumber: string;
      cost: number;
      dueDate: string | null;
    }
  | {
      type: "IT_REQUEST";
      requestId: string;
      itemName: string;
      priority: ItRequestPriority;
      quantity: number;
      cost: number;
      requestType: ItRequestType;
    };

const departmentKey = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, " ").trim();

/**
 * The value to send for a typed or picked department. Collapses whitespace,
 * and when the text matches a known department — by stored value or by label,
 * ignoring case — returns that department's stored value, so "design" and
 * "Design" don't become two teams. Mirrors the server's own normalisation.
 */
export function canonicalDepartment(input: string, known: readonly string[] = DEPARTMENTS): string {
  const collapsed = input.trim().replace(/\s+/g, " ");
  const key = departmentKey(collapsed);
  const match = [...known, ...DEPARTMENTS].find(
    (value) => departmentKey(value) === key || departmentKey(departmentLabel(value)) === key
  );
  return match ?? collapsed;
}
