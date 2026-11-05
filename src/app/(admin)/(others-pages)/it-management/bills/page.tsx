"use client"; // Next.js App Router — uses hooks

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, X, Check, Pencil, Trash2, FileText, UploadCloud, Receipt,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import ControlledDatePicker from "@/components/form/ControlledDatePicker";
import DateRangePicker from "@/components/form/DateRangePicker";
import Pagination from "@/components/common/Pagination";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import {
  IT_BILL_INVOICE_MAX_BYTES,
  IT_BILL_INVOICE_MIME_TYPES,
  itBillsService,
} from "@/services/it-management.service";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { IT_BILL_STATUS_LABELS } from "@/types/it-management";
import type {
  CreateItBillPayload,
  ItBill,
  ItBillStatus,
  ItBillStoredStatus,
  ItBillsSummary,
  UpdateItBillPayload,
} from "@/types/it-management";

/* ------------------------------ config ------------------------------ */

const PAGE_SIZE = 10;

const TABS: { key: ItBillStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "DUE_SOON", label: "Due Soon" },
  { key: "PAID", label: "Paid" },
  { key: "OVERDUE", label: "Overdue" },
];

/** Only these two are ever sent to create/update — `DUE_SOON`/`OVERDUE` are
 *  computed server-side and 422 as input. */
const EDITABLE_STATUSES: ItBillStoredStatus[] = ["PENDING", "PAID"];

const STATUS_STYLES: Record<ItBillStatus, string> = {
  PENDING: "bg-[#ECF1F5] text-[#535A79] dark:bg-blue-950 dark:text-blue-400",
  DUE_SOON: "bg-[#F9EDDB] text-[#D97706] dark:bg-amber-950 dark:text-amber-400",
  PAID: "bg-[#ECF5EF] text-[#16A34A] dark:bg-emerald-950 dark:text-emerald-400",
  OVERDUE: "bg-[#F9E6E8] text-[#FF3B30] dark:bg-red-950 dark:text-red-400",
};

/** Hex counterpart of each stat card's tone, for the icon ring — same
 *  treatment as the dashboard's stat cards (see it-management/page.tsx). */
const STAT_CARDS: { key: keyof ItBillsSummary; label: string; hint: string; color: string }[] = [
  { key: "outstanding", label: "Outstanding", hint: "Across all vendors", color: "#535A79" },
  { key: "dueSoon", label: "Due Soon", hint: "Within 7 days", color: "#D97706" },
  { key: "overdue", label: "Overdue", hint: "Need immediate action", color: "#FF3B30" },
  { key: "paid", label: "Paid", hint: "Settled invoices", color: "#16A34A" },
];

const CARD_SHADOW =
  "shadow-[0_-5px_12px_rgba(0,0,0,0.02),0_-22px_22px_rgba(0,0,0,0.02),0_-48px_29px_rgba(0,0,0,0.01)]";

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#081735] dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-blue-500 dark:[color-scheme:dark]";

const LABEL_CLS = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-400";

/* ------------------------------ helpers ------------------------------ */

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

const fmtMoney = (n: number) => `PKR ${n.toLocaleString("en-US")}`;

/** Same "prefer the server's field-level reason over the generic envelope
 *  message" rule the Assets screen uses — see `assetErrorMessage` there. */
function billErrorMessage(err: unknown, fallback: string): string {
  const { message, details } = parseApiError(err);
  if (details && details.length > 0) return details.map((d) => d.message).join(" ");
  return message || fallback;
}

/* -------------------------- reusable pieces -------------------------- */

function BillDrawer({
  open,
  editing,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean;
  editing: ItBill | null;
  onClose: () => void;
  onSave: (payload: CreateItBillPayload | UpdateItBillPayload) => void;
  isSaving: boolean;
}) {
  const [vendor, setVendor] = useState(editing?.vendor ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(editing?.invoiceNumber ?? "");
  const [purchaseDate, setPurchaseDate] = useState(
    (editing?.purchaseDate ?? new Date().toISOString()).slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(editing?.dueDate?.slice(0, 10) ?? "");
  const [cost, setCost] = useState<number>(editing?.cost ?? 0);
  const [status, setStatus] = useState<ItBillStoredStatus>(
    editing?.status === "PAID" ? "PAID" : "PENDING"
  );
  const [fileUrl, setFileUrl] = useState<string | null>(editing?.fileUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(editing?.fileName ?? null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileError, setFileError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  const valid = vendor.trim().length > 0 && invoiceNumber.trim().length > 0 && !isSaving && !uploadingFile;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError("");
    if (!IT_BILL_INVOICE_MIME_TYPES.includes(file.type as (typeof IT_BILL_INVOICE_MIME_TYPES)[number])) {
      setFileError("Invoice must be a JPEG, PNG, PDF or MP4 file.");
      return;
    }
    if (file.size > IT_BILL_INVOICE_MAX_BYTES) {
      setFileError("Invoice must be 50MB or smaller.");
      return;
    }
    setUploadingFile(true);
    try {
      const uploaded = await itBillsService.uploadInvoice(file);
      setFileUrl(uploaded.fileUrl);
      setFileName(uploaded.fileName);
    } catch (err) {
      setFileError(parseApiError(err).message || "Couldn't upload the invoice.");
    } finally {
      setUploadingFile(false);
    }
  };

  const removeFile = () => {
    setFileUrl(null);
    setFileName(null);
  };

  const submit = () => {
    onSave({
      vendor: vendor.trim(),
      invoiceNumber: invoiceNumber.trim(),
      purchaseDate: new Date(purchaseDate).toISOString(),
      dueDate: dueDate ? new Date(dueDate).toISOString() : editing ? null : undefined,
      cost,
      status,
      fileUrl: fileUrl ?? (editing ? null : undefined),
      fileName: fileName ?? (editing ? null : undefined),
    });
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start justify-between border-b border-gray-100 p-5 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{editing ? "Edit bill" : "Bill"}</h3>
            <p className="mt-0.5 text-[11px] text-gray-400">Vendor invoice details and payment schedule</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>Vendor *</label>
                <input
                  autoFocus
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g. Microsoft"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Invoice number *</label>
                <input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-9821"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Purchase date</label>
                <ControlledDatePicker
                  id="bill-purchase-date"
                  value={purchaseDate}
                  onChange={setPurchaseDate}
                  className={`${INPUT_CLS} pr-9`}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Due date</label>
                <ControlledDatePicker
                  id="bill-due-date"
                  value={dueDate}
                  onChange={setDueDate}
                  className={`${INPUT_CLS} pr-9`}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Cost (PKR)</label>
                <input
                  type="number"
                  min={0}
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  placeholder="0"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Status</label>
                <AccountingSelect
                  label="Status"
                  className=""
                  value={status}
                  onChange={(value) => setStatus(value as ItBillStoredStatus)}
                  options={EDITABLE_STATUSES.map((s) => ({ value: s, label: IT_BILL_STATUS_LABELS[s] }))}
                />
              </div>
            </div>

            <div>
              <label className={LABEL_CLS}>Upload invoice</label>
              {uploadingFile ? (
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                  <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#071936] border-t-transparent dark:border-white dark:border-t-transparent" />
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Uploading…</p>
                </div>
              ) : fileUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                    <FileText size={16} className="text-[#071936] dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">{fileName || "Invoice"}</p>
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">
                      View file
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    void handleFile(e.dataTransfer.files?.[0]);
                  }}
                  className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
                    dragActive
                      ? "border-[#071936] bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/30"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <UploadCloud size={22} className="mx-auto text-gray-400" />
                  <p className="mt-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                    Choose a file or drag &amp; drop it here
                  </p>
                  <p className="mt-0.5 text-[10px] text-gray-400">JPEG, PNG, PDF, and MP4 formats, up to 50MB</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Browse File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept={IT_BILL_INVOICE_MIME_TYPES.join(",")}
                    onChange={(e) => {
                      void handleFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
              {fileError && <p className="mt-1 text-[11px] text-red-500">{fileError}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!valid}
                className="rounded-lg bg-[#071936] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#10284d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving…" : editing ? "Save Changes" : "Save Bill"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- page -------------------------------- */

export default function ItBillsPage() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const [activeTab, setActiveTab] = useState<ItBillStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);

  /* Closes the due-date popover on an outside click. Skips clicks inside
     `.flatpickr-calendar` — `DateRangePicker` appends its calendar as a
     direct child of <body>, never inside `dateFilterRef`, so without this
     check every day-click would read as "outside" and close the popover
     before the pick registers (same fix the Assets screen's own date
     filter uses). */
  useEffect(() => {
    if (!dateFilterOpen) return;
    const onDown = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(".flatpickr-calendar")) return;
      if (dateFilterRef.current && !dateFilterRef.current.contains(e.target as Node)) {
        setDateFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [dateFilterOpen]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ItBill | null>(null);
  const [deleting, setDeleting] = useState<ItBill | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  // Pending confirmation, separate from markingPaidId (the in-flight id used
  // for the button's own "Marking…" state and the confirm modal's spinner).
  const [confirmMarkPaid, setConfirmMarkPaid] = useState<ItBill | null>(null);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, dueDateFrom, dueDateTo]);

  const params = {
    q: search.trim() || undefined,
    status: activeTab === "ALL" ? undefined : activeTab,
    dueDateFrom: dueDateFrom || undefined,
    dueDateTo: dueDateTo || undefined,
    page,
    limit: PAGE_SIZE,
  };

  /* `summary` comes bundled with this same call and is always workspace-wide
     — independent of `params` — so the 4 stat cards read it straight off
     the list response rather than a second `/it-bills/summary` round trip. */
  const listQuery = useQuery({
    queryKey: queryKeys.itBills(workspaceId, params),
    queryFn: () => itBillsService.list(params),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const bills = listQuery.data?.items ?? [];
  const summary = listQuery.data?.summary ?? { outstanding: 0, dueSoon: 0, overdue: 0, paid: 0 };
  const hasDateRange = Boolean(dueDateFrom || dueDateTo);

  /* Root-only key — same reasoning as invalidateRequests/invalidateAssets in
     the sibling IT-management pages: a 2-segment key would miss the
     "detail"/"summary" nested queries. */
  const invalidateBills = () => queryClient.invalidateQueries({ queryKey: ["it-bills"] });

  const openAddDrawer = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (bill: ItBill) => {
    setEditing(bill);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
  };

  const handleSave = async (payload: CreateItBillPayload | UpdateItBillPayload) => {
    setIsSaving(true);
    try {
      if (editing) {
        await itBillsService.update(editing.id, payload as UpdateItBillPayload);
        toast.success(`"${payload.vendor}" updated.`);
      } else {
        await itBillsService.create(payload as CreateItBillPayload);
        toast.success(`"${payload.vendor}" added.`);
      }
      invalidateBills();
      closeDrawer();
    } catch (err) {
      toast.error(billErrorMessage(err, editing ? "Couldn't update that bill." : "Couldn't add that bill."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkPaid = async (bill: ItBill) => {
    setMarkingPaidId(bill.id);
    try {
      await itBillsService.markPaid(bill.id);
      invalidateBills();
      toast.success(`${bill.vendor} marked as paid.`);
      setConfirmMarkPaid(null);
    } catch (err) {
      toast.error(billErrorMessage(err, "Couldn't mark that bill as paid."));
      setConfirmMarkPaid(null);
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await itBillsService.delete(deleting.id);
      invalidateBills();
      toast.success(`Invoice ${deleting.invoiceNumber} removed.`);
      setDeleting(null);
    } catch (err) {
      toast.error(billErrorMessage(err, "Couldn't delete that bill."));
    } finally {
      setIsDeleting(false);
    }
  };

  /* ---------- render ---------- */
  // `h-full`, not `h-screen` — see the matching comment on the Employees
  // page's own root div; `h-screen` here spills past AdminLayoutClient's
  // shorter, `overflow-hidden` `<main>` and gets silently clipped.
  return (
    <div className="h-full overflow-y-auto bg-[#EDEFF2] px-6 py-6 text-gray-800 dark:bg-gray-950 dark:text-white">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[29px] font-medium leading-tight text-[#081735] dark:text-white">Bills</h1>
          <p className="mt-1.5 text-sm text-[#8F95B2] dark:text-gray-400">Vendor invoices, due dates and payment status</p>
        </div>

        <button
          type="button"
          onClick={openAddDrawer}
          className="flex shrink-0 items-center gap-2 rounded-[10px] bg-[#081735] px-5 py-3 text-sm font-medium capitalize text-white shadow-sm transition hover:bg-[#132449]"
        >
          <Plus size={17} />
          Add bill
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((c) => (
          <div
            key={c.key}
            className={`flex h-[120px] flex-col justify-between rounded-2xl bg-[#F6F7F9] px-6 py-4 dark:bg-gray-900 ${CARD_SHADOW}`}
          >
            <div className="flex items-start gap-[11px]">
              <div className="shrink-0 rounded-full border p-2.5" style={{ borderColor: c.color, color: c.color }}>
                <Receipt size={20} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-light text-[#081735] dark:text-gray-300">{c.label}</p>
                <p className="text-[32px] leading-none text-[#081735] dark:text-white">{fmtMoney(summary[c.key])}</p>
              </div>
            </div>
            <p className="text-xs leading-3 text-[#8F95B2] dark:text-gray-500">{c.hint}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search + date filter */}
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-[20px] px-[18px] py-2 text-base font-medium transition ${
                activeTab === tab.key
                  ? "bg-[#081735] text-white shadow-sm"
                  : "border border-[#E6E8F0] bg-white text-[#8F95B2] hover:text-[#535A79] dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={dateFilterRef}>
            <button
              type="button"
              onClick={() => setDateFilterOpen((v) => !v)}
              className={`flex h-11 items-center gap-2 rounded-[10px] border px-4 text-sm font-medium transition ${
                hasDateRange
                  ? "border-[#081735] bg-[#081735] text-white"
                  : "border-[#E6E8F0] bg-white text-[#535A79] hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
              }`}
            >
              <CalendarDays size={16} />
              {hasDateRange ? `${dueDateFrom || "…"} → ${dueDateTo || "…"}` : "Due date"}
            </button>

            {dateFilterOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <p className="pb-2 text-[9px] font-semibold uppercase tracking-wide text-gray-400">Due date range</p>
                <DateRangePicker
                  id="bill-filter-due-date-range"
                  from={dueDateFrom}
                  to={dueDateTo}
                  onChange={(from, to) => {
                    setDueDateFrom(from);
                    setDueDateTo(to);
                  }}
                  placeholder="Click to pick a start and end date"
                  className={`${INPUT_CLS} pr-9`}
                />
                {hasDateRange && (
                  <button
                    type="button"
                    onClick={() => {
                      setDueDateFrom("");
                      setDueDateTo("");
                    }}
                    className="mt-3 text-xs font-medium text-red-500 hover:text-red-600"
                  >
                    Clear dates
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex h-11 w-full items-center gap-2 rounded-[10px] border border-[#E6E8F0] bg-white px-4 md:w-80 dark:border-gray-800 dark:bg-gray-900">
            <Search size={16} className="shrink-0 text-[#8F95B2]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bills"
              className="w-full bg-transparent text-sm text-[#081735] outline-none placeholder:text-[#8F95B2] dark:text-gray-200"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-[#8F95B2] hover:text-[#535A79] dark:hover:text-gray-200">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`mt-4 rounded-2xl bg-white/50 px-4 py-6 dark:bg-gray-900/50 ${CARD_SHADOW}`}>
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#071936] border-t-transparent dark:border-white dark:border-t-transparent" />
          </div>
        ) : listQuery.isError ? (
          <div className="py-14 text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Couldn&apos;t load bills</p>
            <p className="mt-1 text-xs text-gray-400">{parseApiError(listQuery.error).message}</p>
            <button
              onClick={() => listQuery.refetch()}
              className="mt-3 rounded-lg bg-[#081735] px-4 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-slate-900"
            >
              Try again
            </button>
          </div>
        ) : bills.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <Search size={20} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No bills found</p>
            <p className="mt-1 text-xs text-gray-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[860px] w-full">
              <thead>
                <tr className="rounded-2xl border-b border-[#E6E8F0] bg-white dark:border-gray-800 dark:bg-gray-900">
                  {["Vendor", "Invoice", "Amount", "Due date", "Status", "File", "Actions"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-4 text-[11px] font-bold text-[#081735] dark:text-gray-300 ${h === "Actions" ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {bills.map((bill) => (
                  <tr
                    key={bill.id}
                    className="h-14 border-b border-[#E6E8F0] transition last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-bold text-[#081735] dark:text-gray-200">
                      {bill.vendor}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-[13px] font-medium text-[#081735] dark:text-gray-400">{bill.invoiceNumber}</td>

                    <td className="whitespace-nowrap px-4 py-4 text-[13px] font-medium text-[#081735] dark:text-gray-300">
                      {bill.cost.toLocaleString("en-US")} PKR
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-[13px] font-medium text-[#081735] dark:text-gray-400">
                      {fmtDate(bill.dueDate)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[bill.status]}`}>
                        {IT_BILL_STATUS_LABELS[bill.status]}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      {bill.fileUrl ? (
                        <a
                          href={bill.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex max-w-[150px] items-center gap-1.5 text-[13px] font-medium text-[#535A79] hover:text-[#081735] dark:text-gray-400 dark:hover:text-white"
                          title={bill.fileName ?? undefined}
                        >
                          <FileText size={16} className="shrink-0" />
                          <span className="truncate">{bill.fileName || "Invoice"}</span>
                        </a>
                      ) : (
                        <span className="text-sm text-[#8F95B2]">—</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center justify-end gap-3">
                        {bill.status !== "PAID" ? (
                          <button
                            type="button"
                            onClick={() => setConfirmMarkPaid(bill)}
                            disabled={markingPaidId === bill.id}
                            className="flex items-center gap-1.5 rounded-full bg-white/50 px-2 py-1 text-xs font-medium capitalize text-[#535A79] transition hover:bg-gray-100 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <Check size={16} strokeWidth={1.5} />
                            {markingPaidId === bill.id ? "Marking…" : "Mark Paid"}
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-[#8F95B2] dark:text-gray-600">
                            <Check size={16} strokeWidth={1.5} />
                            Settled
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => openEditDrawer(bill)}
                          title="Edit bill"
                          className="rounded-lg p-1 text-[#535A79] transition hover:bg-gray-100 hover:text-[#081735] dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        >
                          <Pencil size={16} strokeWidth={1.5} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleting(bill)}
                          title="Delete bill"
                          className="rounded-lg p-1 text-[#FF3B30] transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination meta={listQuery.data?.meta} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Add / Edit drawer */}
      <BillDrawer
        key={editing?.id ?? "new"}
        open={drawerOpen}
        editing={editing}
        isSaving={isSaving}
        onClose={closeDrawer}
        onSave={(payload) => void handleSave(payload)}
      />

      <ConfirmActionModal
        isOpen={deleting !== null}
        title={deleting ? `Delete invoice "${deleting.invoiceNumber}"?` : ""}
        description="This can't be undone."
        confirmLabel="Delete bill"
        isLoading={isDeleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />

      <ConfirmActionModal
        isOpen={confirmMarkPaid !== null}
        title={confirmMarkPaid ? `Mark "${confirmMarkPaid.vendor}" as paid?` : ""}
        description="This records the invoice as settled — it won't appear as outstanding or overdue anymore."
        confirmLabel="Mark as paid"
        isLoading={markingPaidId === confirmMarkPaid?.id}
        onConfirm={() => {
          if (confirmMarkPaid) void handleMarkPaid(confirmMarkPaid);
        }}
        onClose={() => setConfirmMarkPaid(null)}
      />
    </div>
  );
}
