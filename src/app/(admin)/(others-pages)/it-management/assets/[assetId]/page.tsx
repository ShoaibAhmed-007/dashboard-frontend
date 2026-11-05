"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Boxes, Cpu, Laptop, Monitor, Server, Mouse, Keyboard, HardDrive,
  Smartphone, Tablet, Cable, Pencil, ReceiptText, UserRound, UserRoundCog, X,
} from "lucide-react";
import {
  assetsService,
  companyEmployeesService,
} from "@/services/it-management.service";
import { queryKeys } from "@/queries/keys";
import { parseApiError } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspace.store";
import AccountingSelect from "@/components/accounts/AccountingSelect";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import {
  ASSET_CATEGORY_LABELS,
  ASSET_LOCATIONS,
  ASSET_LOCATION_LABELS,
  ASSET_STATUS_LABELS,
  departmentLabel,
  SPEC_CATEGORIES,
} from "@/types/it-management";
import type { Asset, AssetLocation, AssetStatus, Department } from "@/types/it-management";

/* ------------------------------ config ------------------------------ */

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

/** Status pill in the header — mirrors the list table's own status colours. */
const STATUS_PILL: Record<AssetStatus, string> = {
  ASSIGNED: "text-[#16A34A]",
  AVAILABLE: "text-[#2E5FD8]",
  UNDER_REPAIR: "text-[#D97706]",
  DEAD: "text-[#8F95B2]",
};

const CARD_CLS =
  "flex flex-col gap-6 rounded-2xl border border-[#DCE1E9] bg-white/50 p-8 dark:border-gray-800 dark:bg-gray-900/50";

/* ------------------------------ helpers ------------------------------ */

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

const categoryLabel = (value: string) =>
  ASSET_CATEGORY_LABELS[value as keyof typeof ASSET_CATEGORY_LABELS] ?? value;

/** Specs only exist for laptop/pc/mobile/tablet — the whole Technical
 *  specifications card is hidden for anything else, same rule the Add/Edit
 *  form uses to decide whether to collect them in the first place. */
const showsSpecs = (category: string) =>
  (SPEC_CATEGORIES as readonly string[]).includes(category.trim().toUpperCase());

/** Every value on this page renders through here so a missing/unset field
 *  shows a consistent dash rather than an empty gap or "null". */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="text-xs uppercase text-[#8F95B2]">{label}</p>
      <p className="break-words text-base font-medium text-[#081735] dark:text-gray-100">{value || "—"}</p>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof Laptop;
  children: React.ReactNode;
}) {
  return (
    <section className={CARD_CLS}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-medium capitalize text-[#081735] dark:text-white">{title}</h2>
          <p className="mt-1 text-sm text-[#8F95B2]">{subtitle}</p>
        </div>
        <Icon size={32} strokeWidth={1.5} className="shrink-0 text-[#535A79] dark:text-gray-400" />
      </div>
      {children}
    </section>
  );
}

/* -------------------------------- page -------------------------------- */

export default function AssetDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams<{ assetId: string }>();
  const assetId = params.assetId;
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [transferLocation, setTransferLocation] = useState<AssetLocation | "">("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Assigning/unassigning changes who's responsible for a physical asset —
     a confirm step before either, same as every other mutating action in
     this module. Stacks on top of the transfer drawer (which stays open
     underneath) rather than replacing it, same pattern the Assets list's
     edit-drawer + delete-confirm already uses. */
  const [pendingAssignment, setPendingAssignment] = useState<{ assignedToId: string | null } | null>(null);

  const assetQuery = useQuery({
    queryKey: queryKeys.itAsset(workspaceId, assetId),
    queryFn: () => assetsService.get(assetId),
    enabled: Boolean(workspaceId) && Boolean(assetId),
  });

  const employeesQuery = useQuery({
    queryKey: queryKeys.companyEmployees(workspaceId, { limit: 100 }),
    queryFn: () => companyEmployeesService.list({ limit: 100 }),
    enabled: Boolean(workspaceId) && transferOpen,
    staleTime: 60_000,
  });

  const asset: Asset | undefined = assetQuery.data;
  const employeeOptions = employeesQuery.data?.items ?? [];

  const CategoryIcon = useMemo(
    () => (asset ? CATEGORY_ICONS[asset.cateogry.toUpperCase()] ?? HardDrive : HardDrive),
    [asset]
  );

  /** Derived from `warrantyUntil` — there's no separate status field. */
  const warrantyStatus = useMemo(() => {
    if (!asset?.warrantyUntil) return null;
    return new Date(asset.warrantyUntil).getTime() >= Date.now() ? "Active" : "Expired";
  }, [asset?.warrantyUntil]);

  const openTransfer = () => {
    setTransferTo(asset?.assignedToId ?? "");
    // Prefill from the asset's current location rather than forcing a
    // re-pick when it's already known.
    setTransferLocation(asset?.location ?? "");
    setError(null);
    setTransferOpen(true);
  };

  /** Picking someone implies Assigned; clearing implies Available — the same
   *  status/assignee sync the list screen's own edit drawer applies, so the
   *  two fields can't drift apart. Any asset with an `assignedToId` requires
   *  `location` server-side (doc's Assets §"Assignment business rules"), so
   *  assigning goes out with whatever's in the Location field, not the
   *  asset's old value — a never-before-assigned asset has none, and
   *  silently reusing `null` there would 422. The Save button stays
   *  disabled until a location is picked, so `location` is never actually
   *  empty here when `assignedToId` is set. */
  const saveAssignment = async (assignedToId: string | null) => {
    if (!asset) return;
    setIsSaving(true);
    setError(null);
    try {
      await assetsService.update(asset.id, {
        assignedToId,
        status: assignedToId ? "ASSIGNED" : asset.status === "ASSIGNED" ? "AVAILABLE" : asset.status,
        // An unassigned asset has no location to sit at.
        location: assignedToId ? transferLocation || null : null,
      });
      queryClient.invalidateQueries({ queryKey: ["it-assets"] });
      queryClient.invalidateQueries({ queryKey: ["company-employees"] });
      setTransferOpen(false);
      setPendingAssignment(null);
    } catch (err) {
      // Back to the transfer drawer to show the error — not left stuck
      // behind the (now closed) confirm step.
      setPendingAssignment(null);
      setError(parseApiError(err).message || "Couldn't update that assignment.");
    } finally {
      setIsSaving(false);
    }
  };

  const pendingAssignmentName = pendingAssignment?.assignedToId
    ? employeeOptions.find((emp) => emp.id === pendingAssignment.assignedToId)?.name ?? "this person"
    : null;

  /* ---------- states ---------- */
  if (assetQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#EDEFF2] dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#071936] border-t-transparent dark:border-white dark:border-t-transparent" />
      </div>
    );
  }

  if (assetQuery.isError || !asset) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#EDEFF2] dark:bg-gray-950">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Couldn&apos;t load that asset</p>
        {assetQuery.isError && (
          <p className="text-xs text-gray-400">{parseApiError(assetQuery.error).message}</p>
        )}
        <button
          type="button"
          onClick={() => router.push("/it-management/assets")}
          className="mt-2 rounded-full bg-[#071936] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-[#10284d]"
        >
          Back to assets
        </button>
      </div>
    );
  }

  const assignee = asset.assignedTo;

  // `h-full`, not `h-screen` — see the matching comment on the Employees
  // page's own root div; `h-screen` here spills past AdminLayoutClient's
  // shorter, `overflow-hidden` `<main>` and gets silently clipped.
  return (
    <div className="h-full overflow-y-auto bg-[#EDEFF2] px-6 pb-40 pt-6 text-gray-800 dark:bg-gray-950 dark:text-white">
      <button
        type="button"
        onClick={() => router.push("/it-management/assets")}
        className="mb-5 flex items-center gap-2 text-sm font-medium text-[#535A79] transition hover:text-[#081735] dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to assets
      </button>

      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="shrink-0 rounded-full border border-[#535A79] p-2.5 text-[#535A79] dark:border-gray-500 dark:text-gray-400">
              <CategoryIcon size={28} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-[29px] font-medium leading-10 text-[#081735] dark:text-white">
                  {asset.name}
                </h1>
                <span
                  className={`rounded-full bg-white px-2.5 py-0.5 text-sm shadow-[0_32px_64px_rgba(8,23,53,0.12)] dark:bg-gray-800 ${STATUS_PILL[asset.status]}`}
                >
                  {ASSET_STATUS_LABELS[asset.status]}
                </span>
              </div>
              <p className="mt-1.5 truncate text-sm text-[#8F95B2]">
                {categoryLabel(asset.cateogry)} | Serial {asset.serianlNumber || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/it-management/assets?edit=${asset.id}`)}
              title="Edit asset details"
              className="flex items-center gap-2 rounded-[10px] border border-[#E6E8F0] bg-white px-4 py-3 text-sm font-medium capitalize text-[#081735] transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
            >
              <Pencil size={18} strokeWidth={1.5} />
              Edit
            </button>
            <button
              type="button"
              onClick={openTransfer}
              className="flex items-center gap-2 rounded-[10px] bg-[#081735] px-5 py-3 text-sm font-medium capitalize text-white transition hover:bg-[#10284d]"
            >
              <UserRoundCog size={20} strokeWidth={1.5} />
              Transfer Asset
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="flex flex-col gap-4 xl:w-[672px] xl:shrink-0">
            <SectionCard title="Asset overview" subtitle="Core inventory information" icon={Boxes}>
              <div className="flex flex-col gap-7">
                <div className="flex flex-wrap gap-4">
                  <Field label="Category" value={categoryLabel(asset.cateogry)} />
                  <Field label="Serial Number" value={asset.serianlNumber} />
                  <Field label="Status" value={ASSET_STATUS_LABELS[asset.status]} />
                  <Field
                    label="Location"
                    value={asset.location ? ASSET_LOCATION_LABELS[asset.location as AssetLocation] : null}
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <Field
                    label="Department"
                    value={
                      assignee?.department
                        ? departmentLabel(assignee.department)
                        : null
                    }
                  />
                  <Field label="Added on" value={fmtDate(asset.createdAt)} />
                  <Field label="Last updated" value={fmtDate(asset.updatedAt)} />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Current assignment"
              subtitle="Who is responsible for this asset"
              icon={UserRound}
            >
              {assignee ? (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-2">
                    {assignee.imageUrl ? (
                      <img
                        src={assignee.imageUrl}
                        alt={assignee.name}
                        className="h-14 w-14 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500 dark:bg-gray-800">
                        {assignee.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[#081735] dark:text-white">
                        {assignee.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-[#535A79] dark:text-gray-400">
                        {assignee.designation || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-[#DCE1E9] dark:bg-gray-800" />

                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap gap-4">
                      <Field label="Designation" value={assignee.designation} />
                      <Field
                        label="Department"
                        value={
                          assignee.department
                            ? departmentLabel(assignee.department)
                            : null
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Field label="Email" value={assignee.email} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openTransfer}
                    className="w-fit rounded-lg border border-[#8F95B2] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#081735] transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
                  >
                    Transfer or unassign
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-4">
                  <p className="text-sm text-[#8F95B2]">This asset isn&apos;t assigned to anyone right now.</p>
                  <button
                    type="button"
                    onClick={openTransfer}
                    className="rounded-lg border border-[#8F95B2] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#081735] transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
                  >
                    Assign to someone
                  </button>
                </div>
              )}
            </SectionCard>
          </div>

          <div className="flex flex-1 flex-col gap-4">
            {showsSpecs(asset.cateogry) && (
              <SectionCard
                title="Technical specifications"
                subtitle="Category-specific device information"
                icon={Cpu}
              >
                <div className="flex flex-col gap-4">
                  <Field label="Processor" value={asset.processor} />
                  <Field label="RAM" value={asset.ram} />
                  <Field label="Storage" value={asset.storage} />
                  <Field label="Operating System" value={asset.os} />
                  <Field label="Screen Size" value={asset.screenSize} />
                </div>
              </SectionCard>
            )}

            <SectionCard
              title="Purchase & warranty"
              subtitle="Financial and coverage information"
              icon={ReceiptText}
            >
              <div className="flex flex-wrap gap-7">
                <div className="flex min-w-[160px] flex-1 flex-col gap-4">
                  <Field label="Purchase date" value={fmtDate(asset.purchaseDate)} />
                  <Field label="Vendor" value={asset.vendor} />
                  <Field label="Warranty expiry" value={fmtDate(asset.warrantyUntil)} />
                </div>
                <div className="flex min-w-[160px] flex-1 flex-col gap-4">
                  <Field label="Purchase price" value={`PKR ${asset.cost.toLocaleString()}`} />
                  <Field label="Warranty status" value={warrantyStatus} />
                  <Field label="Invoice number" value={asset.invoiceNumber} />
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Transfer / unassign */}
      {transferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => setTransferOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Transfer asset"
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Transfer asset</h2>
                <p className="mt-1 text-xs text-slate-400 dark:text-gray-500">
                  Hand {asset.name} to someone else, or release it back to the pool.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Assign to
              </label>
              <AccountingSelect
                label="Assign to"
                className=""
                value={transferTo}
                onChange={setTransferTo}
                disabled={employeesQuery.isLoading}
                options={[
                  { value: "", label: employeesQuery.isLoading ? "Loading people…" : "Unassigned" },
                  ...employeeOptions.map((emp) => ({ value: emp.id, label: emp.name })),
                ]}
              />
            </div>

            {/* Only meaningful once assigned to someone; required whenever
                shown — any asset with an assignedToId needs a location, same
                rule the list screen's own edit drawer enforces. */}
            {transferTo && (
              <div className="mt-4">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Location *
                </label>
                <AccountingSelect
                  label="Location"
                  className=""
                  value={transferLocation}
                  onChange={(value) => setTransferLocation(value as AssetLocation)}
                  options={[
                    { value: "", label: "Select location" },
                    ...ASSET_LOCATIONS.map((loc) => ({ value: loc, label: ASSET_LOCATION_LABELS[loc] })),
                  ]}
                />
              </div>
            )}

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

            <div className="mt-6 flex items-center justify-between gap-3">
              {asset.assignedToId && (
                <button
                  type="button"
                  onClick={() => setPendingAssignment({ assignedToId: null })}
                  disabled={isSaving}
                  className="rounded-lg border border-red-200 px-3 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/40"
                >
                  Unassign
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setTransferOpen(false)}
                  disabled={isSaving}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAssignment({ assignedToId: transferTo || null })}
                  disabled={isSaving || (Boolean(transferTo) && !transferLocation)}
                  className="rounded-lg bg-[#071936] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#10284d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={pendingAssignment !== null}
        title={
          pendingAssignment?.assignedToId
            ? `Assign ${asset.name} to ${pendingAssignmentName}?`
            : `Unassign ${asset.name}?`
        }
        description={
          pendingAssignment?.assignedToId
            ? "They'll be responsible for this asset going forward."
            : "This asset will go back to the available pool."
        }
        confirmLabel={pendingAssignment?.assignedToId ? "Assign asset" : "Unassign asset"}
        isLoading={isSaving}
        onConfirm={() => {
          if (pendingAssignment) void saveAssignment(pendingAssignment.assignedToId);
        }}
        onClose={() => setPendingAssignment(null)}
      />
    </div>
  );
}
