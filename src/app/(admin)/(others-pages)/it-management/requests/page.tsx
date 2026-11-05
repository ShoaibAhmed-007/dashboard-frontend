"use client"; // Next.js App Router — uses hooks

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X as ClearIcon } from "lucide-react";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import ControlledDatePicker from "@/components/form/ControlledDatePicker";
import DateRangePicker from "@/components/form/DateRangePicker";
import Pagination from "@/components/common/Pagination";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import {
  companyEmployeesService,
  itRequestsService,
} from "@/services/it-management.service";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { departmentLabel } from "@/types/it-management";
import { useDepartmentOptions } from "@/hooks/useDepartmentOptions";
import type {
  CreateItRequestPayload,
  Department,
  ItRequest,
  ItRequestPriority,
  ItRequestStatus,
  ItRequestType,
  UpdateItRequestPayload,
} from "@/types/it-management";

/** Board columns per status — narrower than the table screens', since each
 *  is one card wide rather than one row. */
const COLUMN_PAGE_SIZE = 10;

/** One column's page of requests — `requestStatus` scopes it to exactly the
 *  column it backs, so paginating one column can never eat into another's
 *  rows the way slicing one flat REQUESTED+APPROVED+REJECTED+PURCHASED list
 *  by page would. `requestType`/`priority` are real `GET /it-requests` query
 *  params (server-side, so the column's total/pagination stay accurate);
 *  "ALL" or "" simply omits that param rather than sending it. Department
 *  and the needed-by date range have no server-side filter for this
 *  endpoint, so those are applied client-side against whatever page this
 *  returns — see `visibleItems` below, same tradeoff `search` already makes. */
function useRequestColumn(
  workspaceId: string | null,
  requestType: ItRequestType | "ALL",
  priority: ItRequestPriority | "",
  status: ItRequestStatus,
  page: number
) {
  const params = useMemo(
    () => ({
      ...(requestType !== "ALL" && { requestType }),
      ...(priority && { priority }),
      requestStatus: status,
      page,
      limit: COLUMN_PAGE_SIZE,
    }),
    [requestType, priority, status, page]
  );
  return useQuery({
    queryKey: queryKeys.itRequests(workspaceId, params),
    queryFn: () => itRequestsService.list(params),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}

/* keep in sync with page background */
const PAGE_BG = "bg-[#EDEFF2] dark:bg-gray-950";

const drawerStyles = `
  @keyframes s9-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes s9-fade-in { from { opacity: 0; } to { opacity: 1; } }
  .s9-drawer-panel { animation: s9-drawer-in .32s cubic-bezier(.32,.72,0,1) both; }
  .s9-drawer-overlay { animation: s9-fade-in .2s ease-out both; }
`;

const money = (n: number) => "PKR " + n.toLocaleString("en-US");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

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
const MonitorIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><rect width="20" height="14" x="2" y="3" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></Icon>
);
const CodeIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></Icon>
);
const PlusIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><path d="M5 12h14" /><path d="M12 5v14" /></Icon>
);
const XIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>
);
const ArrowRightIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Icon>
);
const PencilIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></Icon>
);
const TrashIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}>
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Icon>
);
const CheckIcon = ({ className }: { className?: string }) => (
  <Icon {...{ className }}><polyline points="20 6 9 17 4 12" /></Icon>
);

/* ====================================================================
   Shared bits
==================================================================== */
function Avatar({ src, name, className = "" }: { src: string; name: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken || !src) {
    const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-100 text-[10px] font-semibold text-indigo-600 dark:from-indigo-500/20 dark:to-sky-500/20 dark:text-indigo-300 ${className}`}>
        {initials}
      </div>
    );
  }
  return <img src={src} alt={name} onError={() => setBroken(true)} className={`object-cover ${className}`} />;
}

const PRIORITY_STYLES: Record<ItRequestPriority, string> = {
  HIGH: "bg-[#FDF2F2] text-[#EF4444] dark:bg-red-500/10 dark:text-red-400",
  MEDIUM: "bg-[#FEF7EC] text-[#D97706] dark:bg-amber-500/10 dark:text-amber-400",
  LOW: "bg-[#F0FDF4] text-[#15803D] dark:bg-emerald-500/10 dark:text-emerald-400",
};
const PRIORITY_LABEL: Record<ItRequestPriority, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

/* NOTE: contract has no approvedDate/purchasedDate/deliveredDate — approved/
   rejected/purchased/delivered cards fall back to updatedAt until the backend
   adds explicit fields. WITHDRAWN has no column here — it's the requester's
   own action (My Requests), not something this board manages. */
const STATUS_META: Record<ItRequestStatus, { label: string; dateLabel: string }> = {
  REQUESTED: { label: "Requested", dateLabel: "Needed by" },
  APPROVED: { label: "Approved", dateLabel: "Approved on" },
  REJECTED: { label: "Rejected", dateLabel: "Rejected on" },
  PURCHASED: { label: "Purchased", dateLabel: "Purchased on" },
  DELIVERED: { label: "Delivered", dateLabel: "Delivered on" },
  WITHDRAWN: { label: "Withdrawn", dateLabel: "Withdrawn on" },
};

/** WITHDRAWN has no column — this board never queries/paginates it. */
type BoardStatus = Exclude<ItRequestStatus, "WITHDRAWN">;

/** Copy for the "advance" confirm modal — one of the three forward status
 *  transitions a manager can trigger from a card's own advance button. */
const ADVANCE_COPY: Record<
  "APPROVED" | "PURCHASED" | "DELIVERED",
  { verb: string; description: string; confirmLabel: string }
> = {
  APPROVED: {
    verb: "Approve",
    description: "This moves the request into Approved.",
    confirmLabel: "Approve request",
  },
  PURCHASED: {
    verb: "Mark as purchased",
    description: "This moves the request into Purchased.",
    confirmLabel: "Mark as purchased",
  },
  DELIVERED: {
    verb: "Mark as delivered",
    description: "This closes out the request as delivered.",
    confirmLabel: "Mark as delivered",
  },
};

const COLUMNS: { status: BoardStatus; label: string }[] = [
  { status: "REQUESTED", label: "Requested" },
  { status: "APPROVED", label: "Approved" },
  { status: "PURCHASED", label: "Purchased" },
  { status: "DELIVERED", label: "Delivered" },
  { status: "REJECTED", label: "Rejected" },
];

/* ====================================================================
   Requirement card
==================================================================== */
function RequirementCard({
  req,
  onAdvance,
  onReject,
  onEdit,
  onDelete,
}: {
  req: ItRequest;
  onAdvance: () => void;
  onReject: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[req.requestStatus];
  const date = req.requestStatus === "REQUESTED" ? req.requestedDate : req.updatedAt;
  const canAdvance =
    req.requestStatus === "REQUESTED" || req.requestStatus === "APPROVED" || req.requestStatus === "PURCHASED";
  const canReject = req.requestStatus === "REQUESTED" || req.requestStatus === "APPROVED";
  const advanceLabel =
    req.requestStatus === "REQUESTED" ? "Approve" : req.requestStatus === "APPROVED" ? "Purchase" : "Mark Delivered";

  return (
    <article className="group relative min-w-0 rounded-xl border border-[#E6E8F0] bg-white p-4 transition hover:shadow-md hover:shadow-slate-900/5 dark:border-white/10 dark:bg-white/[0.04] dark:hover:shadow-black/30">
      {/* Edit/delete sit over the card's corner instead of taking a slot in the
          action row — that row is the tightest part of a narrow column, and
          reserving room for two hidden icons is what pushed Reject out of the
          card. Also shown on keyboard focus, not just hover. */}
      <div className="absolute right-2 top-2 flex gap-0.5 rounded-lg bg-white/95 opacity-0 shadow-sm transition focus-within:opacity-100 group-hover:opacity-100 dark:bg-gray-900/95">
        <button
          onClick={onEdit}
          aria-label={`Edit ${req.itemName}`}
          className="rounded-lg p-1.5 text-[#8F95B2] transition hover:bg-gray-100 hover:text-[#535A79] dark:hover:bg-white/10 dark:hover:text-white"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          aria-label={`Delete ${req.itemName}`}
          className="rounded-lg p-1.5 text-[#8F95B2] transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* The title gets the full width (two lines before it truncates) — it
          used to share a row with the priority chip and was cut to "Zoom…". */}
      <h4 className="line-clamp-2 break-words text-base font-medium text-[#081735] dark:text-white" title={req.itemName}>
        {req.itemName}
      </h4>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[req.priority]}`}>
          {PRIORITY_LABEL[req.priority]}
        </span>
        <span className="text-xs text-[#535A79] dark:text-gray-500">
          {meta.dateLabel} {fmtDate(date)} · Qty {req.quantity}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2.5">
        {req.requestedBy ? (
          <>
            <Avatar src={req.requestedBy.imageUrl} name={req.requestedBy.name} className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#081735] dark:text-gray-200">{req.requestedBy.name}</p>
              <p className="truncate text-xs text-[#535A79] dark:text-gray-500">{departmentLabel(req.requestedBy.department)}</p>
            </div>
          </>
        ) : (
          <p className="truncate text-xs text-[#8F95B2] dark:text-gray-500">No requester on file</p>
        )}
      </div>

      <div className="mt-3 border-t border-[#E6E8F0] dark:border-white/10" />

      <div className="mt-3 flex items-center gap-2">
        {canAdvance && (
          <button
            onClick={onAdvance}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#E9ECF2] px-3 py-1.5 text-[13px] font-semibold text-[#081735] transition hover:bg-[#dde1ea] active:scale-[0.98] dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            {advanceLabel} <ArrowRightIcon className="h-3.5 w-3.5 shrink-0" />
          </button>
        )}
        {canReject && (
          <button
            onClick={onReject}
            className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-[#FDF2F2] bg-[#FDF2F2] px-3 py-1.5 text-[13px] font-semibold text-[#EF4444] transition hover:bg-red-100 dark:border-red-900 dark:bg-transparent dark:hover:bg-red-950/40"
          >
            Reject
          </button>
        )}
        {req.requestStatus === "DELIVERED" && (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#15803D] dark:text-emerald-400">
            <CheckIcon className="h-3.5 w-3.5" /> Completed
          </span>
        )}
        {req.requestStatus === "REJECTED" && (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#EF4444]">
            <XIcon className="h-3.5 w-3.5" /> Rejected
          </span>
        )}
      </div>
    </article>
  );
}

/* ====================================================================
   New / Edit Requirement drawer
==================================================================== */
/* `dark:[color-scheme:dark]` is the fix, not the Tailwind dark: color
   classes alone — those style the closed control, but a native <select>'s
   open popup is rendered by the browser/OS using its own light-by-default
   palette unless the element's `color-scheme` says otherwise. Without it,
   the popup ignores the page's dark theme entirely. */
const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:[color-scheme:dark]";
const labelCls = "mb-1.5 block text-xs font-medium text-slate-500 dark:text-gray-400";

type RequirementFormPayload = {
  itemName: string;
  requestType: ItRequestType;
  priority: ItRequestPriority;
  quantity: number;
  requestedDate: string;
  cost: number;
  requestedById: string;
  category: string;
  businessJustification: string;
};

function RequirementDrawer({
  editing,
  defaultRequestType,
  people,
  onClose,
  onSave,
  isSaving,
}: {
  editing: ItRequest | null;
  /** Which tab was active when "New Requirement" was clicked — only used to
   *  preset the field on create; edit always starts from the request's own
   *  type. */
  defaultRequestType: ItRequestType;
  people: { id: string; name: string; department: string }[];
  onClose: () => void;
  onSave: (payload: RequirementFormPayload) => void;
  isSaving: boolean;
}) {
  const [itemName, setItemName] = useState(editing?.itemName ?? "");
  const [requestType, setRequestType] = useState<ItRequestType>(editing?.requestType ?? defaultRequestType);
  const [requestedById, setRequestedById] = useState(editing?.requestedById ?? "");
  const [priority, setPriority] = useState<ItRequestPriority>(editing?.priority ?? "MEDIUM");
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1);
  const [requestedDate, setRequestedDate] = useState(
    (editing?.requestedDate ?? new Date().toISOString()).slice(0, 10),
  );
  const [cost, setCost] = useState<number>(editing?.cost ?? 0);
  const [category, setCategory] = useState(editing?.category ?? "");
  const [businessJustification, setBusinessJustification] = useState(editing?.businessJustification ?? "");

  const valid =
    itemName.trim().length > 0 &&
    requestedById !== "" &&
    category.trim().length > 0 &&
    businessJustification.trim().length > 0 &&
    !isSaving;

  return (
    <div className="fixed inset-0 z-50">
      <div className="s9-drawer-overlay absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit requirement" : "New requirement"}
        className="s9-drawer-panel absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-gray-900 dark:text-white"
      >
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editing ? "Edit Requirement" : "New Requirement"}
            </h2>
            <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">What is needed, by whom and by when</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <XIcon />
          </button>
        </div>

        <div className="mt-6 flex-1 space-y-4 overflow-y-auto px-6">
          <div>
            <label className={labelCls}>Item Name</label>
            <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Network firewall appliance" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Laptop" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Request Type</label>
            <AccountingSelect
              label="Request Type"
              className=""
              value={requestType}
              onChange={(value) => setRequestType(value as ItRequestType)}
              options={[
                { value: "HARDWARE", label: "Hardware" },
                { value: "SOFTWARE", label: "Software" },
              ]}
            />
          </div>

          <div>
            <label className={labelCls}>Requested by</label>
            <AccountingSelect
              label="Requested by"
              className=""
              value={requestedById}
              onChange={setRequestedById}
              options={[
                { value: "", label: "Select employee" },
                ...people.map((p) => ({ value: p.id, label: `${p.name} — ${p.department}` })),
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Priority</label>
              <AccountingSelect
                label="Priority"
                className=""
                value={priority}
                onChange={(value) => setPriority(value as ItRequestPriority)}
                options={[
                  { value: "LOW", label: "Low" },
                  { value: "MEDIUM", label: "Medium" },
                  { value: "HIGH", label: "High" },
                ]}
              />
            </div>
            <div>
              <label className={labelCls}>Quantity</label>
              <AccountingSelect
                label="Quantity"
                className=""
                value={String(quantity)}
                onChange={(value) => setQuantity(Number(value))}
                options={Array.from({ length: 10 }, (_, i) => i + 1).map((n) => ({ value: String(n), label: String(n) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Requested Date</label>
              <ControlledDatePicker
                id="requested-date"
                value={requestedDate}
                onChange={setRequestedDate}
                className={`${inputCls} pr-9`}
              />
            </div>
            <div>
              <label className={labelCls}>Cost (PKR)</label>
              <input type="number" min={0} value={cost} onChange={(e) => setCost(Number(e.target.value))} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Business Justification</label>
            <textarea
              rows={3}
              value={businessJustification}
              onChange={(e) => setBusinessJustification(e.target.value)}
              placeholder="Why this request is needed"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-white/10">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() =>
              onSave({
                itemName: itemName.trim(),
                requestType,
                priority,
                quantity,
                requestedDate: new Date(requestedDate).toISOString(),
                cost,
                requestedById,
                category: category.trim(),
                businessJustification: businessJustification.trim(),
              })
            }
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ====================================================================
   Page
==================================================================== */
export default function ItRequestsPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const [activeTab, setActiveTab] = useState<ItRequestType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  // Department and the needed-by date range have no server-side filter on
  // this endpoint (unlike requestType/priority) — applied client-side, see
  // useRequestColumn's doc comment.
  const [department, setDepartment] = useState<Department | "">("");
  const departmentOptions = useDepartmentOptions();
  const [priorityFilter, setPriorityFilter] = useState<ItRequestPriority | "">("");
  const [neededByFrom, setNeededByFrom] = useState("");
  const [neededByTo, setNeededByTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnPages, setColumnPages] = useState<Record<BoardStatus, number>>({
    REQUESTED: 1,
    APPROVED: 1,
    REJECTED: 1,
    PURCHASED: 1,
    DELIVERED: 1,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ItRequest | null>(null);
  const [deleting, setDeleting] = useState<ItRequest | null>(null);
  const [rejecting, setRejecting] = useState<ItRequest | null>(null);
  /* The card's "Approve"/"Purchase"/"Mark Delivered" button — a confirm
     step before any of the three forward transitions, same as every other
     mutating action in this module. */
  const [advancing, setAdvancing] = useState<{ req: ItRequest; targetStatus: "APPROVED" | "PURCHASED" | "DELIVERED" } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // A server-side filter change (type/priority) starts every column back at
  // its own page 1 — a client-side-only one (department, needed-by date,
  // search) doesn't, since it just narrows whatever page is already loaded.
  useEffect(() => {
    setColumnPages({ REQUESTED: 1, APPROVED: 1, REJECTED: 1, PURCHASED: 1, DELIVERED: 1 });
  }, [activeTab, priorityFilter]);

  const setColumnPage = (status: BoardStatus, page: number) =>
    setColumnPages((prev) => ({ ...prev, [status]: page }));

  const requestedQuery = useRequestColumn(workspaceId, activeTab, priorityFilter, "REQUESTED", columnPages.REQUESTED);
  const approvedQuery = useRequestColumn(workspaceId, activeTab, priorityFilter, "APPROVED", columnPages.APPROVED);
  const purchasedQuery = useRequestColumn(workspaceId, activeTab, priorityFilter, "PURCHASED", columnPages.PURCHASED);
  const deliveredQuery = useRequestColumn(workspaceId, activeTab, priorityFilter, "DELIVERED", columnPages.DELIVERED);
  const rejectedQuery = useRequestColumn(workspaceId, activeTab, priorityFilter, "REJECTED", columnPages.REJECTED);

  const columnQueries: Record<BoardStatus, ReturnType<typeof useRequestColumn>> = {
    REQUESTED: requestedQuery,
    APPROVED: approvedQuery,
    PURCHASED: purchasedQuery,
    DELIVERED: deliveredQuery,
    REJECTED: rejectedQuery,
  };

  /** Every employee, unpaginated, for the "Requested by" picker — mirrors
   *  employeeService.searchAll's fetch-once-filter-locally shape. */
  const peopleQuery = useQuery({
    queryKey: queryKeys.companyEmployees(workspaceId, { limit: 100 }),
    queryFn: () => companyEmployeesService.list({ limit: 100 }),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  /* Header "open requests / estimated spend" reads from the summary
     endpoint rather than the (now per-column-paginated) columns — those
     only ever hold one page each, so summing across them would undercount
     as soon as any column spans more than one page. */
  const summaryQuery = useQuery({
    queryKey: queryKeys.itRequestsSummary(workspaceId),
    queryFn: () => itRequestsService.summary(),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
  // The summary endpoint has one entry per requestType, not a combined
  // "ALL" row — sum both when that tab is active.
  const openCount =
    activeTab === "ALL"
      ? (summaryQuery.data ?? []).reduce((sum, s) => sum + s.openCount, 0)
      : summaryQuery.data?.find((s) => s.requestType === activeTab)?.openCount ?? 0;
  const spend =
    activeTab === "ALL"
      ? (summaryQuery.data ?? []).reduce((sum, s) => sum + s.estimatedSpend, 0)
      : summaryQuery.data?.find((s) => s.requestType === activeTab)?.estimatedSpend ?? 0;

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  /* Root-only key, not `["it-requests", workspaceId]` — the detail/summary
     queries nest a different second segment ("detail"/"summary"), so a key
     with workspaceId at index 1 would silently miss them. Same fix as
     invalidateAssets/invalidateEmployees in the sibling IT-management pages. */
  const invalidateRequests = () =>
    queryClient.invalidateQueries({ queryKey: ["it-requests"] });

  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  const transition = async (req: ItRequest, status: "APPROVED" | "REJECTED" | "PURCHASED" | "DELIVERED") => {
    try {
      await itRequestsService.updateStatus(req.id, { status });
      invalidateRequests();
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't update that request.");
    }
  };

  const advance = (req: ItRequest) =>
    setAdvancing({
      req,
      targetStatus:
        req.requestStatus === "REQUESTED" ? "APPROVED" : req.requestStatus === "APPROVED" ? "PURCHASED" : "DELIVERED",
    });

  const handleConfirmAdvance = async () => {
    if (!advancing) return;
    setIsAdvancing(true);
    try {
      await transition(advancing.req, advancing.targetStatus);
      setAdvancing(null);
    } finally {
      setIsAdvancing(false);
    }
  };

  const reject = (req: ItRequest) => setRejecting(req);

  const handleConfirmReject = async () => {
    if (!rejecting) return;
    setIsRejecting(true);
    try {
      await transition(rejecting, "REJECTED");
      setRejecting(null);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await itRequestsService.delete(deleting.id);
      invalidateRequests();
      toast.success(`"${deleting.itemName}" deleted.`);
      setDeleting(null);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't delete that request.");
    } finally {
      setIsDeleting(false);
    }
  };

  const save = async (payload: RequirementFormPayload) => {
    setIsSaving(true);
    try {
      if (editing) {
        const updatePayload: UpdateItRequestPayload = payload;
        await itRequestsService.update(editing.id, updatePayload);
        toast.success(`"${payload.itemName}" updated.`);
      } else {
        const createPayload: CreateItRequestPayload = payload;
        await itRequestsService.create(createPayload);
        toast.success(`"${payload.itemName}" requested.`);
      }
      invalidateRequests();
      closeDrawer();
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't save that request.");
    } finally {
      setIsSaving(false);
    }
  };

  // `h-full`, not `h-screen` — see the matching comment on the Employees
  // page's own root div; `h-screen` here spills past AdminLayoutClient's
  // shorter, `overflow-hidden` `<main>` and gets silently clipped.
  return (
    <div className={`h-full overflow-y-auto ${PAGE_BG} px-4 py-6 sm:px-6 lg:px-8`}>
      <style>{drawerStyles}</style>

      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[29px] font-medium leading-tight text-[#081735] dark:text-white">Requests</h1>
          <p className="mt-1.5 text-sm text-[#8F95B2] dark:text-gray-400">
            {openCount} open requests · <span className="font-semibold text-[#535A79] dark:text-gray-200">{money(spend)}</span> estimated spend
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex w-80 items-center gap-2 rounded-[10px] border border-[#E6E8F0] bg-white px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
            <Search className="h-4 w-4 shrink-0 text-[#8F95B2]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search requests"
              className="w-full bg-transparent text-sm text-[#081735] outline-none placeholder:text-[#8F95B2] dark:text-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="text-[#8F95B2] transition hover:text-[#535A79] dark:hover:text-gray-200"
              >
                <ClearIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* <button
            onClick={() => { setEditing(null); setDrawerOpen(true); }}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#081735] px-5 py-3 text-sm font-medium capitalize text-white shadow-sm transition hover:bg-[#132449] active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200"
          >
            <PlusIcon className="h-4 w-4" />
            New requirement
          </button> */}
        </div>
      </div>

      {/* type tabs */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        {([
          { id: "ALL" as const, label: "All Requests", icon: null },
          { id: "HARDWARE" as const, label: "Hardware Requests", icon: MonitorIcon },
          { id: "SOFTWARE" as const, label: "Software Requests", icon: CodeIcon },
        ]).map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-[20px] px-[18px] py-2 text-base font-medium transition ${active
                  ? "bg-[#081735] text-white shadow-sm dark:bg-white dark:text-slate-900"
                  : "border border-[#E6E8F0] bg-white text-[#8F95B2] hover:text-[#535A79] dark:bg-white/[0.06] dark:text-gray-400 dark:hover:text-gray-100"
                }`}
            >
              {tab.icon && <tab.icon className="h-4 w-4" />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
            department || priorityFilter || neededByFrom || neededByTo
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
              : "border-[#E6E8F0] bg-white text-[#8F95B2] hover:text-[#535A79] dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-400 dark:hover:text-gray-100"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {!!(department || priorityFilter || neededByFrom || neededByTo) && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-xs font-semibold text-emerald-600 dark:bg-gray-900">
              {[department, priorityFilter, neededByFrom || neededByTo].filter(Boolean).length}
            </span>
          )}
        </button>

        {(department || priorityFilter || neededByFrom || neededByTo) && (
          <button
            type="button"
            onClick={() => {
              setDepartment("");
              setPriorityFilter("");
              setNeededByFrom("");
              setNeededByTo("");
            }}
            className="text-sm font-medium text-red-500 transition hover:text-red-600"
          >
            Clear filters
          </button>
        )}
      </div>

      {filtersOpen && (
        <div className="mt-3 grid gap-4 rounded-2xl border border-[#E6E8F0] bg-white p-4 dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-3">
          <div>
            <label className={labelCls}>Department</label>
            <AccountingSelect
              label="Department"
              className=""
              value={department}
              onChange={(value) => setDepartment(value as Department | "")}
              options={[
                { value: "", label: "All departments" },
                ...departmentOptions.map((d) => ({ value: d, label: departmentLabel(d) })),
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Priority</label>
            <AccountingSelect
              label="Priority"
              className=""
              value={priorityFilter}
              onChange={(value) => setPriorityFilter(value as ItRequestPriority | "")}
              options={[
                { value: "", label: "All priorities" },
                { value: "LOW", label: "Low" },
                { value: "MEDIUM", label: "Medium" },
                { value: "HIGH", label: "High" },
              ]}
            />
          </div>
          <div>
            <label className={labelCls}>Needed by</label>
            <DateRangePicker
              id="requests-filter-needed-by"
              from={neededByFrom}
              to={neededByTo}
              onChange={(from, to) => { setNeededByFrom(from); setNeededByTo(to); }}
              placeholder="Any date"
              className={`${inputCls} pr-9`}
            />
          </div>
        </div>
      )}

      {/* board — each column paginates independently against its own
          `requestStatus` filter, so one status running long never eats into
          another's rows */}
      <div className="mt-4 flex flex-col items-stretch gap-4 md:grid md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const query = columnQueries[col.status];
          const items = query.data?.items ?? [];
          const needle = search.trim().toLowerCase();
          // Client-side on top of whatever page the server already
          // returned — see useRequestColumn's doc comment for why
          // department/needed-by can't be real query params here yet.
          const visibleItems = items.filter((req) => {
            if (needle) {
              const matches =
                req.itemName.toLowerCase().includes(needle) ||
                (req.requestedBy?.name.toLowerCase().includes(needle) ?? false);
              if (!matches) return false;
            }
            if (department && req.department !== department) return false;
            if (neededByFrom || neededByTo) {
              const day = req.requestedDate.slice(0, 10);
              if (neededByFrom && day < neededByFrom) return false;
              if (neededByTo && day > neededByTo) return false;
            }
            return true;
          });
          return (
            <section
              key={col.status}
              aria-label={col.label}
              className="flex min-h-[600px] min-w-0 flex-1 flex-col gap-4 rounded-2xl border border-[#E6E8F0] bg-white/50 p-3 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between pb-2">
                <h3 className="text-xl font-medium capitalize text-[#081735] dark:text-white">{col.label}</h3>
                <span className="flex items-center justify-center rounded-full bg-[#E9ECF2] px-2 py-0.5 text-xs font-bold text-[#535A79] dark:bg-white/10 dark:text-gray-300">
                  {query.data?.meta.total ?? items.length}
                </span>
              </div>

              <div className="border-t border-[#E6E8F0] dark:border-white/10" />

              <div className="flex flex-1 flex-col gap-3">
                {query.isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-900 border-t-transparent dark:border-white dark:border-t-transparent" />
                  </div>
                ) : query.isError ? (
                  <div className="rounded-xl border border-dashed border-red-200 p-4 text-center text-xs text-red-500 dark:border-red-900">
                    {parseApiError(query.error).message}
                    <button
                      onClick={() => query.refetch()}
                      className="mt-2 block w-full rounded-lg bg-[#081735] py-1.5 text-[11px] font-medium text-white dark:bg-white dark:text-slate-900"
                    >
                      Try again
                    </button>
                  </div>
                ) : visibleItems.length > 0 ? (
                  visibleItems.map((req) => (
                    <RequirementCard
                      key={req.id}
                      req={req}
                      onAdvance={() => advance(req)}
                      onReject={() => reject(req)}
                      onEdit={() => { setEditing(req); setDrawerOpen(true); }}
                      onDelete={() => setDeleting(req)}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[#E6E8F0] p-6 text-center text-xs text-[#8F95B2] dark:border-white/10 dark:text-gray-500">
                    {needle || department || neededByFrom || neededByTo ? "No matches" : "Nothing here"}
                  </div>
                )}
              </div>

              <Pagination meta={query.data?.meta} onPageChange={(page) => setColumnPage(col.status, page)} />
            </section>
          );
        })}
      </div>

      {/* drawer */}
      {drawerOpen && (
        <RequirementDrawer
          key={editing?.id ?? "new"}
          editing={editing}
          defaultRequestType={activeTab === "ALL" ? "HARDWARE" : activeTab}
          people={peopleQuery.data?.items ?? []}
          isSaving={isSaving}
          onClose={closeDrawer}
          onSave={(payload) => void save(payload)}
        />
      )}

      <ConfirmActionModal
        isOpen={deleting !== null}
        title={deleting ? `Delete "${deleting.itemName}"?` : ""}
        description="This can't be undone."
        confirmLabel="Delete request"
        isLoading={isDeleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />

      <ConfirmActionModal
        isOpen={rejecting !== null}
        title={rejecting ? `Reject "${rejecting.itemName}"?` : ""}
        description={
          rejecting?.requestStatus === "APPROVED"
            ? "This request was already approved — rejecting it now will undo that approval."
            : "This can't be undone."
        }
        confirmLabel="Reject request"
        isLoading={isRejecting}
        onConfirm={() => void handleConfirmReject()}
        onClose={() => setRejecting(null)}
      />

      <ConfirmActionModal
        isOpen={advancing !== null}
        title={advancing ? `${ADVANCE_COPY[advancing.targetStatus].verb} "${advancing.req.itemName}"?` : ""}
        description={advancing ? ADVANCE_COPY[advancing.targetStatus].description : ""}
        confirmLabel={advancing ? ADVANCE_COPY[advancing.targetStatus].confirmLabel : "Confirm"}
        isLoading={isAdvancing}
        onConfirm={() => void handleConfirmAdvance()}
        onClose={() => setAdvancing(null)}
      />
    </div>
  );
}
