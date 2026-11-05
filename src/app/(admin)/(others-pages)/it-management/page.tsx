"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Laptop, Users, Receipt, AlertTriangle,
  ReceiptText, CalendarClock, ShieldAlert, ArrowUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  assetsService,
  companyEmployeesService,
  itBillsService,
  itDashboardService,
} from "@/services/it-management.service";
import { queryKeys } from "@/queries/keys";
import { useWorkspaceStore } from "@/stores/workspace.store";
import {
  ASSET_CATEGORY_LABELS,
  ASSET_LOCATION_LABELS,
  ASSET_STATUS_LABELS,
  type AssetStatus,
  type DashboardActionItem,
} from "@/types/it-management";
import { resolveNotificationRoute } from "@/types/notification";
import { parseApiError } from "@/lib/api";

/* ------------------------------ config ------------------------------ */

const STAT_TONES = {
  purple: "#9236E5",
  blue: "#2C65E7",
  red: "#D9232C",
  orange: "#E75620",
};

const GREEN = "#137255";

const ACTION_TONES = {
  danger: { bg: "#FEE2E2", icon: "#FF3B30" },
  warning: { bg: "#FEF3C7", icon: "#D97706" },
  info: { bg: "#DBEAFE", icon: "#2563EB" },
};

const ACTION_CARD_SHADOW =
  "shadow-[0_-5px_12px_rgba(0,0,0,0.02),0_-22px_22px_rgba(0,0,0,0.02),0_-48px_29px_rgba(0,0,0,0.01)]";

const DOT_COLORS = { read: "#D9D9D9", unread: "#2E5FD8" };

/** Same map, same classes as the Assets screen's own table — this widget
 *  is meant to be that exact table's top-5 slice, not a lookalike. */
const STATUS_STYLES: Record<AssetStatus, string> = {
  ASSIGNED: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  AVAILABLE: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  UNDER_REPAIR: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  DEAD: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

/** Same format as the Assets screen's own `fmtDate`. */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const fmtMoney = (n: number) => `PKR ${n.toLocaleString("en-US")}`;

/** `DashboardActionItem`'s redirect, built from `type` + id per the doc's
 *  §7 ("Build the redirect from `type` + id"). Neither Bills nor Requests
 *  has a per-entity detail route today (unlike Assets) — those land on the
 *  entity's list screen instead. */
function actionItemHref(item: DashboardActionItem): string {
  switch (item.type) {
    case "BILL_OVERDUE":
    case "BILL_DUE_SOON":
      return "/it-management/bills";
    case "IT_REQUEST":
      return "/it-management/requests";
  }
}

function actionItemContent(item: DashboardActionItem): { tone: keyof typeof ACTION_TONES; icon: LucideIcon; title: string; meta: string } {
  switch (item.type) {
    case "BILL_OVERDUE":
      return {
        tone: "danger",
        icon: ReceiptText,
        title: `${item.vendor} bill is overdue`,
        meta: `${item.invoiceNumber} · ${fmtMoney(item.cost)}${item.dueDate ? ` · due ${fmtDate(item.dueDate)}` : ""}`,
      };
    case "BILL_DUE_SOON":
      return {
        tone: "warning",
        icon: CalendarClock,
        title: `${item.vendor} bill due soon`,
        meta: `${item.invoiceNumber} · ${fmtMoney(item.cost)}${item.dueDate ? ` · due ${fmtDate(item.dueDate)}` : ""}`,
      };
    case "IT_REQUEST":
      return {
        tone: "info",
        icon: ShieldAlert,
        title: `New ${item.priority.toLowerCase()}-priority requirement`,
        meta: `${item.itemName} · Qty ${item.quantity} · ${fmtMoney(item.cost)}`,
      };
  }
}

/* -------------------------- reusable pieces -------------------------- */

/* the three tilted cards peeking out from behind each stat card, as a group
   centered over the card regardless of the card's actual width. Positions,
   sizes and rotations are fixed — only what's drawn inside each slot (below,
   via GHOST_CONTENT) changes per stat card. */
const GHOST_CLUSTER_WIDTH = 224; // bounding width of the three tilted cards below
const GHOST_SLOTS = [
  "left-0 top-[13px] h-[81px] w-[158px] -rotate-[5deg] opacity-70",
  "left-[43px] top-[5px] h-[81px] w-[112px] rotate-[5deg] opacity-50",
  "left-[74px] top-[6px] h-[77px] w-[116px] rotate-[14deg] opacity-50",
];

type GhostSlot = { avatar?: string; icon?: LucideIcon; title: string; subtitle?: string };

const STAT_SHADOW =
  "shadow-[0_-5px_12px_rgba(0,0,0,0.02),0_-22px_22px_rgba(0,0,0,0.02),0_-48px_29px_rgba(0,0,0,0.01)]";

type StatCardProps = {
  icon: LucideIcon;
  tone: keyof typeof STAT_TONES;
  /** Up to 3 preview cards behind the stat card — fewer than 3 (e.g. a
   *  workspace with only 1 asset category) just leaves that slot empty. */
  ghosts: GhostSlot[];
  label: string;
  value: number;
  children?: ReactNode;
};

function StatCard({ icon: Icon, tone, ghosts, label, value, children }: StatCardProps) {
  return (
    <div className="relative h-[180px]">
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2"
        style={{ width: GHOST_CLUSTER_WIDTH }}
      >
        {GHOST_SLOTS.map((cls, i) => {
          const slot = ghosts[i];
          if (!slot) return null;
          const { avatar, icon: GhostIcon, title, subtitle } = slot;
          return (
            <div
              key={i}
              className={`absolute origin-top-left overflow-hidden rounded-lg border-[0.68px] border-[#E6E8F0] bg-white p-2 dark:border-gray-800 dark:bg-gray-900 ${cls}`}
            >
              <div className="flex items-center gap-1">
                {avatar ? (
                  <img src={avatar} alt="" className="h-3.5 w-3.5 shrink-0 rounded-full object-cover" />
                ) : GhostIcon ? (
                  <GhostIcon size={9} className="shrink-0 text-[#8F95B2]" />
                ) : null}
                <div className="min-w-0 leading-none">
                  <p className="truncate text-[7px] font-bold text-[#8F95B2]">{title}</p>
                  {subtitle && <p className="truncate text-[6px] font-medium text-[#8F95B2]">{subtitle}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={`absolute inset-x-0 top-[38px] flex h-[142px] flex-col justify-between rounded-2xl bg-[#F6F7F9] px-6 py-4 dark:bg-gray-900 ${STAT_SHADOW}`}
      >
        <div className="flex items-start gap-[11px]">
          <div
            className="shrink-0 rounded-full border p-2.5"
            style={{ borderColor: STAT_TONES[tone], color: STAT_TONES[tone] }}
          >
            <Icon size={28} strokeWidth={1.5} />
          </div>
          <div className="flex min-w-0 flex-col gap-[5px]">
            <p className="text-base font-light text-[#081735] dark:text-gray-300">{label}</p>
            <p className="text-[32px] leading-none text-[#081735] dark:text-white">{value}</p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

function Trend({ value, color = GREEN }: { value: ReactNode; color?: string }) {
  return (
    <div className="flex items-center gap-1" style={{ color }}>
      <ArrowUp size={14} strokeWidth={2} />
      <span className="text-sm font-bold leading-5">{value}</span>
    </div>
  );
}

function StatFooter({
  trend,
  trendColor,
  caption,
}: {
  trend?: ReactNode;
  trendColor?: string;
  caption: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {trend != null && <Trend value={trend} color={trendColor} />}
      <p className="text-xs leading-4 text-[#8F95B2]">{caption}</p>
    </div>
  );
}

function ProgressBar({ total, filled }: { total: number; filled: number }) {
  return (
    <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-white dark:bg-gray-900">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-full flex-1 rounded-[1px] ${
            i < filled ? "bg-[#FF1B1B]" : "bg-[#E3E5E8] dark:bg-gray-700"
          }`}
        />
      ))}
    </div>
  );
}

/* -------------------------------- page -------------------------------- */

export default function ItManagementDashboardPage() {
  const router = useRouter();
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  // Snapshot "now" once via the lazy initializer rather than calling
  // Date.now() inside the useMemo blocks below — React's purity rule
  // (react-hooks/purity) forbids calling an impure function during render,
  // including inside a memoized callback; this is the sanctioned way to get
  // a stable "current time" without re-deriving it (impurely) every render.
  const [now] = useState(() => Date.now());

  /* One call powers assets/employees/bills/warranty headline numbers,
     recentAssets, actionRequired and latestNotifications — see doc §7. */
  const overviewQuery = useQuery({
    queryKey: queryKeys.itDashboardOverview(workspaceId),
    queryFn: () => itDashboardService.overview(),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
  const overview = overviewQuery.data;

  /* Per-category rollup — the overview endpoint only gives a flat
     assets.total/assigned/available, not a per-category breakdown, so the
     "Total assets" ghost previews (top 3 categories) still need this. */
  const assetsSummaryQuery = useQuery({
    queryKey: queryKeys.itAssetsSummary(workspaceId),
    queryFn: () => assetsService.summary(),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  /* Same query (and cache key) the Employees screen uses for its own
     department filter chips — feeds the "Employees" ghost previews
     (newest 3 hires), which the overview endpoint doesn't carry either. */
  const employeesQuery = useQuery({
    queryKey: queryKeys.companyEmployees(workspaceId, { limit: 100 }),
    queryFn: () => companyEmployeesService.list({ limit: 100 }),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  /* Soonest-expiring-warranty ghost previews — same reasoning: the overview
     endpoint gives only `warranties.expiringCount`, not the underlying
     assets, so this still fetches the raw rows to pick the top 3 from. */
  const assetsListQuery = useQuery({
    queryKey: queryKeys.itAssets(workspaceId, { limit: 100 }),
    queryFn: () => assetsService.list({ limit: 100 }),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  /** Recent-bills ghost previews for the "Pending bills" stat card — same
   *  "top 3 by recency" treatment the other 3 stat cards get. */
  const billsListQuery = useQuery({
    queryKey: queryKeys.itBills(workspaceId, { limit: 3 }),
    queryFn: () => itBillsService.list({ limit: 3 }),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const assetStats = useMemo(() => {
    const stats = assetsSummaryQuery.data?.stats ?? [];
    const ghosts: GhostSlot[] = [...stats]
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .map((s) => ({
        title: ASSET_CATEGORY_LABELS[s.category as keyof typeof ASSET_CATEGORY_LABELS] ?? s.category,
      }));
    return {
      total: overview?.assets.total ?? 0,
      assigned: overview?.assets.assigned ?? 0,
      available: overview?.assets.available ?? 0,
      ghosts,
    };
  }, [assetsSummaryQuery.data, overview]);

  const employeeStats = useMemo(() => {
    const items = employeesQuery.data?.items ?? [];
    const msPerDay = 24 * 60 * 60 * 1000;
    const ghosts: GhostSlot[] = [...items]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
      .map((e) => ({
        avatar: e.imageUrl || undefined,
        icon: e.imageUrl ? undefined : Users,
        title: e.name,
      }));
    return {
      total: overview?.employees.total ?? 0,
      departments: overview?.employees.departmentsCount ?? 0,
      // Real hires-in-the-last-30-days count — there's no historical
      // headcount snapshot to compute an actual month-over-month percentage
      // from, so this counts new rows client-side instead.
      newThisMonth: items.filter((e) => now - new Date(e.createdAt).getTime() <= 30 * msPerDay).length,
      ghosts,
    };
  }, [employeesQuery.data, overview, now]);

  const billStats = useMemo(() => {
    const items = billsListQuery.data?.items ?? [];
    const ghosts: GhostSlot[] = items.slice(0, 3).map((b) => ({
      icon: Receipt,
      title: b.vendor,
      subtitle: fmtMoney(b.cost),
    }));
    return {
      pendingCount: overview?.bills.pendingCount ?? 0,
      outstanding: overview?.bills.outstanding ?? 0,
      ghosts,
    };
  }, [billsListQuery.data, overview]);

  const warrantyStats = useMemo(() => {
    const items = assetsListQuery.data?.items ?? [];
    const msPerDay = 24 * 60 * 60 * 1000;
    const expiring = items
      .filter((a): a is typeof items[number] & { warrantyUntil: string } => a.warrantyUntil != null)
      .map((a) => ({ asset: a, daysLeft: Math.ceil((new Date(a.warrantyUntil).getTime() - now) / msPerDay) }))
      .filter((a) => a.daysLeft >= 0 && a.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);
    const ghosts: GhostSlot[] = expiring.slice(0, 3).map(({ asset }) => ({
      icon: AlertTriangle,
      title: asset.name,
      subtitle: new Date(asset.warrantyUntil as string).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
      }),
    }));
    return { count: overview?.warranties.expiringCount ?? 0, ghosts };
  }, [assetsListQuery.data, overview, now]);

  /* 10 most recently created assets, workspace-wide, straight from the
     overview call — sliced to 5 for this widget's row count. */
  const recentAssets = useMemo(() => (overview?.recentAssets ?? []).slice(0, 5), [overview]);

  const actionRequired = overview?.actionRequired ?? [];
  const latestNotifications = overview?.latestNotifications ?? [];

  // `h-full`, not `h-screen` — see the matching comment on the Employees
  // page's own root div; `h-screen` here spills past AdminLayoutClient's
  // shorter, `overflow-hidden` `<main>` and gets silently clipped.
  return (
    <div className="h-full overflow-y-auto bg-[#EDEFF2] px-6 py-6 text-gray-800 dark:bg-gray-950 dark:text-white">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Dashboards</span>
          <span>/</span>
          <span className="font-medium text-gray-600 dark:text-gray-300">Default</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Laptop} tone="purple" ghosts={assetStats.ghosts} label="Total assets" value={assetStats.total}>
          <div className="flex flex-col gap-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-0.5">
                <span className="text-sm font-medium leading-none text-[#137255]">{assetStats.assigned}</span>
                <span className="text-xs leading-none text-[#8F95B2]">Assigned</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="text-sm font-medium leading-none text-[#137255]">{assetStats.available}</span>
                <span className="text-xs leading-none text-[#8F95B2]">Available</span>
              </div>
            </div>
            <ProgressBar total={assetStats.total} filled={assetStats.assigned} />
          </div>
        </StatCard>

        <StatCard icon={Users} tone="blue" ghosts={employeeStats.ghosts} label="Employees" value={employeeStats.total}>
          <StatFooter
            trend={employeeStats.newThisMonth > 0 ? `${employeeStats.newThisMonth} new` : undefined}
            caption={`${employeeStats.departments} department${employeeStats.departments === 1 ? "" : "s"}`}
          />
        </StatCard>

        <StatCard icon={Receipt} tone="red" ghosts={billStats.ghosts} label="Pending bills" value={billStats.pendingCount}>
          <StatFooter caption={`${fmtMoney(billStats.outstanding)} outstanding`} />
        </StatCard>

        <StatCard
          icon={AlertTriangle}
          tone="orange"
          ghosts={warrantyStats.ghosts}
          label="Warranties expiring"
          value={warrantyStats.count}
        >
          <StatFooter caption="Within the next month" />
        </StatCard>
      </div>

      {/* Action Required + Latest Notifications */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Action Required */}
        <div
          className={`overflow-scroll rounded-2xl bg-white/50 px-4 dark:bg-gray-900/50 xl:col-span-2 ${ACTION_CARD_SHADOW}`}
        >
          <div className="flex items-center justify-between border-b border-[#E6E8F0] py-6 dark:border-gray-800">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl font-medium capitalize text-[#081735] dark:text-white">Action required</h2>
              <p className="text-[13px] text-[#8F95B2]">Urgent items across bills, assets and requests</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium capitalize text-[#FF3B30] dark:bg-gray-800">
              {actionRequired.length} open
            </span>
          </div>

          <div className="flex py-2 gap-2 flex-col">
            {overviewQuery.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#071936] border-t-transparent dark:border-white dark:border-t-transparent" />
              </div>
            ) : actionRequired.length === 0 ? (
              <div className="px-2 py-10 text-center text-sm text-[#8F95B2] dark:text-gray-500">
                Nothing needs attention right now.
              </div>
            ) : (
              actionRequired.map((item, i) => {
                const { tone, icon: Icon, title, meta } = actionItemContent(item);
                const key = item.type === "IT_REQUEST" ? item.requestId : item.billId;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => router.push(actionItemHref(item))}
                    className={`flex items-center rounded-[20px] justify-between gap-4 px-4 py-4 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      i < actionRequired.length - 1 ? "border-b border-[#E6E8F0] dark:border-gray-800" : ""
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: ACTION_TONES[tone].bg }}
                      >
                        <Icon size={20} strokeWidth={2} style={{ color: ACTION_TONES[tone].icon }} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-[#081735] dark:text-gray-100">{title}</p>
                        <p className="mt-1 truncate text-[13px] text-[#535A79] dark:text-gray-400">{meta}</p>
                      </div>
                    </div>

                    <img src="/images/it/arrow-right.svg" alt="" className="h-4 w-4 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Latest Notifications */}
        <div className={`flex flex-col gap-6 rounded-2xl bg-white/50 py-4 dark:bg-gray-900/50 ${ACTION_CARD_SHADOW}`}>
          <div className="flex items-center justify-between px-6">
            <h2 className="text-xl font-medium capitalize text-[#081735] dark:text-white">Latest notifications</h2>
          </div>

          <div className="flex flex-col gap-2">
            {overviewQuery.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#071936] border-t-transparent dark:border-white dark:border-t-transparent" />
              </div>
            ) : latestNotifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[#8F95B2] dark:text-gray-500">
                No notifications yet.
              </div>
            ) : (
              latestNotifications.map((item, i) => {
                const route = resolveNotificationRoute(item.referenceType, item.referenceId);
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => route && router.push(route)}
                      disabled={!route}
                      className="flex w-full items-start gap-2 px-4 text-left disabled:cursor-default"
                    >
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: item.isRead ? DOT_COLORS.read : DOT_COLORS.unread }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-3.5 text-[#081735] dark:text-gray-100">{item.title}</p>
                        {item.message && (
                          <p className="mt-1 text-xs leading-4 text-[#8F95B2]">{item.message}</p>
                        )}
                      </div>
                    </button>
                    {i < latestNotifications.length - 1 && (
                      <div className="mt-2 h-px bg-black/10 dark:bg-white/10" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recently Added Assets */}
      <div
        className={`mt-4 mb-14 flex flex-col gap-4 overflow-scroll rounded-2xl bg-white/50 px-4 dark:bg-gray-900/50 ${ACTION_CARD_SHADOW}`}
      >
        <div className="flex items-center justify-between pb-1 pt-6 px-2">
          <h2 className="text-xl font-medium capitalize text-black dark:text-white">Recently added assets</h2>
          <Link
            href="/it-management/assets"
            className="rounded-full bg-white px-3 py-1 text-xs font-medium capitalize text-[#2E5FD8] transition hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            Open assets
          </Link>
        </div>

        {overviewQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#071936] border-t-transparent dark:border-white dark:border-t-transparent" />
          </div>
        ) : overviewQuery.isError ? (
          <div className="px-2 pb-10 pt-4 text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Couldn&apos;t load the dashboard</p>
            <p className="mt-1 text-xs text-gray-400">{parseApiError(overviewQuery.error).message}</p>
          </div>
        ) : recentAssets.length === 0 ? (
          <div className="px-2 pb-10 pt-4 text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No assets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Same columns, same row layout as the Assets screen's own
                "Recently added assets" widget, sourced from the dashboard
                overview's `recentAssets`. */}
            <div className="min-w-[1030px]">
              <div className="flex items-center gap-4 rounded-2xl border-b border-[#E6E8F0] bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex-1 text-[11px] font-bold uppercase text-black dark:text-white">Asset Name</div>
                <div className="w-[140px] text-[11px] font-bold uppercase text-black dark:text-white">Serial</div>
                <div className="w-[200px] text-[11px] font-bold uppercase text-black dark:text-white">Assigned To</div>
                <div className="w-[130px] text-[11px] font-bold uppercase text-black dark:text-white">Location</div>
                <div className="w-[120px] text-[11px] font-bold uppercase text-black dark:text-white">Category</div>
                <div className="w-[110px] text-[11px] font-bold uppercase text-black dark:text-white">Cost</div>
                <div className="w-[120px] text-[11px] font-bold uppercase text-black dark:text-white">Purchased</div>
                <div className="w-[110px] text-[11px] font-bold uppercase text-black dark:text-white">Status</div>
              </div>

              <div className="flex flex-col">
                {recentAssets.map((asset) => (
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
                            <img
                              src={asset.assignedTo.imageUrl}
                              alt={asset.assignedTo.name}
                              className="h-8 w-8 shrink-0 rounded-xl object-cover"
                            />
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

                    <div className="w-[120px] truncate text-sm font-medium leading-5 text-black dark:text-gray-300">
                      {asset.cateogry}
                    </div>

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
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
