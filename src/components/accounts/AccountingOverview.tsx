"use client";

import NumberFlow from "@number-flow/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useAccountingOverview } from "@/hooks/useAccounting";
import { useInView } from "@/hooks/useInView";
import type {
  Currency,
  OverviewBankAccount,
  OverviewPeriod,
  OverviewResponse,
} from "@/services/accounting.service";
import { CARD_CLASS, formatMoney } from "@/components/accounts/platformMeta";
import BankAvatar from "@/components/accounts/BankAvatar";
import NameAvatar from "@/components/accounts/NameAvatar";
import CurrencyDonut from "@/components/accounts/CurrencyDonut";

const revenueChartConfig = {
  revenue: { label: "Revenue", color: "#6366f1" },
} satisfies ChartConfig;

const PERIODS: { label: string; value: OverviewPeriod }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

/**
 * `revenueOverview.points[].label` granularity varies by period: `YYYY-MM-DD`
 * for daily/weekly, `YYYY-MM` for monthly, and a bare year for yearly.
 */
function formatPointLabel(label: string, period: OverviewPeriod): string {
  if (period === "yearly") return label;
  const parts = label.split("-");
  if (period === "monthly" && parts.length >= 2) {
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return Number.isNaN(date.getTime())
      ? label
      : new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(date);
  }
  const date = new Date(`${label}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? label
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

/** `+12.4% vs yesterday` — `changePercent` is already a percentage. */
function formatChange(changePercent: number, comparison: string): string {
  const sign = changePercent > 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(1)}% ${comparison}`;
}

/** Renders a per-currency total list as `PKR 8,165,000 · USD 1,200`. */
function formatCurrencyTotals(totals: { currency: Currency; total: number }[]): string {
  if (totals.length === 0) return "—";
  return totals.map((entry) => formatMoney(entry.currency, entry.total)).join(" · ");
}


function findByAccountType(
  overview: OverviewResponse | null,
  accountType: "LOCAL" | "INTERNATIONAL"
) {
  return overview?.balances.byAccountType.find((entry) => entry.accountType === accountType) ?? null;
}

function AccountRowItem({ account }: { account: OverviewBankAccount }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <BankAvatar bankName={account.bankName} logoUrl={account.logoUrl} size={28} />
        <span className="text-sm text-gray-800 dark:text-gray-100">{account.bankName}</span>
      </div>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
        {formatMoney(account.currencyType, account.amount)}
      </span>
    </div>
  );
}

/** Inline pulse blocks — the repo has no shared skeleton component. */
function OverviewSkeleton() {
  return (
    <div className="flex h-full flex-1 flex-col gap-4 overflow-y-auto bg-[#FAFAFF] p-6 dark:bg-gray-907">
      <div className="h-[188px] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      <div className="h-[340px] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-[300px] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-[300px] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  );
}

export default function AccountingOverview() {
  const [period, setPeriod] = useState<OverviewPeriod>("daily");
  const { overview, isLoading, isFetching, error } = useAccountingOverview(period);
  // The chart still shows the previous period's points until the new response
  // lands, so signal that rather than letting the toggle look unresponsive.
  const isSwitchingPeriod =
    isFetching && overview?.revenueOverview.period !== period;

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const local = findByAccountType(overview, "LOCAL");
  const international = findByAccountType(overview, "INTERNATIONAL");

  // International accounts only. The API returns every account of both types;
  // local ones are already covered by the Local Accounts panel below, so
  // listing them here duplicated them on the same screen.
  const bankRows = (overview?.revenueByBankAccount ?? []).filter(
    (row) => row.accountType === "INTERNATIONAL"
  );
  const currencyRows = overview?.revenueByCurrency ?? [];
  // Bar widths key off the USD figure — `totalRevenue` is nullable when an
  // account holds more than one currency, `totalRevenueUsd` never is.
  const maxBankValue = Math.max(1, ...bankRows.map((row) => row.totalRevenueUsd));

  const revenueChartData = useMemo(
    () =>
      (overview?.revenueOverview.points ?? []).map((point) => ({
        label: formatPointLabel(point.label, overview?.revenueOverview.period ?? period),
        revenue: point.totalUsd,
      })),
    [overview, period]
  );

  // NumberFlow only animates the transition between two values it has
  // rendered — it can't sweep from 0 on its very first paint since it has no
  // prior value to diff against. Rendering 0 first, then flipping to the
  // real numbers a tick after mount, gives it that transition to animate.
  const [numbersRevealed, setNumbersRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setNumbersRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const [donutCardRef, donutInView] = useInView<HTMLDivElement>();
  const [platformCardRef, platformInView] = useInView<HTMLDivElement>();

  // Only block on the very first load — period switches refetch in place so the
  // chart doesn't collapse to a skeleton on every toggle.
  if (isLoading && !overview) return <OverviewSkeleton />;

  if (!overview) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-[#FAFAFF] p-6 dark:bg-gray-907">
        <div className="text-center">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            Couldn&apos;t load the accounting overview
          </p>
          <p className="mt-1 text-sm text-gray-400">{error ?? "Please try again."}</p>
        </div>
      </div>
    );
  }

  const { revenueSummary, balances } = overview;

  const kpiCards = [
    // Today leads, then yesterday — the cards read newest-first, left to right.
    // Only rendered when the API actually sends it, so an older backend build
    // shows the original four cards rather than an empty tile.
    ...(revenueSummary.todayVsYesterday
      ? [
          {
            // Deliberately partial: today so far against all of yesterday. The
            // label has to say "so far" or an early-morning reading looks like
            // a collapse rather than an incomplete day.
            label: "Today so far",
            value: revenueSummary.todayVsYesterday.totalUsd,
            valuePrefix: "USD ",
            changePercent: revenueSummary.todayVsYesterday.changePercent,
            comparison: "vs all of yesterday",
          },
        ]
      : []),
    {
      // The `today` key is a misnomer the backend kept deliberately: renaming
      // it would have made the field vanish from un-updated clients rather
      // than merely change value. It carries *yesterday's* revenue, compared
      // against the day before — two complete days, so the figure no longer
      // reads as a large morning drop from comparing a partial day to a whole
      // one.
      label: "Yesterday's Revenue",
      value: revenueSummary.today.totalUsd,
      valuePrefix: "USD ",
      changePercent: revenueSummary.today.changePercent,
      comparison: "vs the day before",
    },
    {
      label: "This Month's Revenue",
      value: revenueSummary.thisMonth.totalUsd,
      valuePrefix: "USD ",
      changePercent: revenueSummary.thisMonth.changePercent,
      comparison: "vs last month",
    },
    {
      label: "This Year's Revenue",
      value: revenueSummary.thisYear.totalUsd,
      valuePrefix: "USD ",
      changePercent: revenueSummary.thisYear.changePercent,
      comparison: "vs last year",
    },
    {
      label: "Total Sales",
      value: revenueSummary.totalSales.count,
      valuePrefix: "",
      changePercent: revenueSummary.totalSales.changePercent,
      comparison: "vs last month",
    },
  ];

  // Rates are live now (refreshed hourly server-side, with a static table as
  // fallback), so this states the rate actually used rather than a placeholder.
  // Only the currencies this workspace actually holds are listed: the table
  // always carries all seven, and printing rates for currencies with no
  // accounts pushed this to three lines while telling the reader nothing about
  // their own balances.
  const heldCurrencies = new Set(
    balances.byAccountType.flatMap((group) => group.totals.map((entry) => entry.currency))
  );
  const nonUsdRates = Object.entries(balances.exchangeRatesToUsd).filter(
    ([code]) => code !== "USD" && heldCurrencies.has(code as Currency)
  );
  const conversionNote = nonUsdRates.length
    ? `Converted at ${nonUsdRates
        // Rates are live now, so they arrive with full precision
        // (`277.73437676`) — trim to 2dp rather than printing the noise.
        .map(([code, rate]) => `${code} ${Number(rate.toFixed(2))}/USD`)
        .join(", ")}`
    : "Converted to USD";

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-[#FAFAFF] p-6 dark:bg-gray-907">
      {/* Balance summary and KPI metrics */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-[#FFFFFF] p-4 dark:border-gray-800 dark:bg-gray-901">
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-8 md:col-span-2">
          <div>
            <p className="text-sm text-gray-400">Local Balance</p>
            {/* Plain text, not a currency switcher: a LOCAL account is PKR by
                definition (see `LOCAL_CURRENCY`), so there is never a second
                currency to switch to. */}
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrencyTotals(local?.totals ?? [])}
            </p>
            <p className="mt-1 text-xs text-gray-400">{local?.accountCount ?? 0} accounts</p>
          </div>
          <div className="h-14 w-px shrink-0 bg-gray-200 dark:bg-gray-800" />
          <div>
            <p className="text-sm text-gray-400">International Balance</p>
            {/* One converted figure rather than the per-currency list: this
                group can span USD/AED/GBP, and `totalUsd` is the server's own
                sum at the live rates. */}
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              <NumberFlow
                value={numbersRevealed ? (international?.totalUsd ?? 0) : 0}
                prefix="USD "
                format={{ maximumFractionDigits: 0 }}
              />
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {international?.accountCount ?? 0} accounts
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-[#000000] p-4 text-white">
          <p className="text-sm text-gray-300">Total Balance</p>
          <p className="mt-1 text-2xl font-semibold">
            {/* Whole dollars, matching the Local/International cards beside it
                — the converted total lands on fractions that would otherwise
                read as false precision next to two rounded figures. */}
            <NumberFlow
              value={numbersRevealed ? balances.totalBalanceUsd : 0}
              prefix="USD "
              format={{ maximumFractionDigits: 0 }}
            />
          </p>
          {/* Hard-clamped to two lines — the rate list scales with how many
              currencies the workspace holds, and this card sits in a fixed-height
              row alongside the balance panels. */}
          <p className="mt-1 line-clamp-2 text-xs text-gray-400" title={conversionNote}>
            {conversionNote}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className={CARD_CLASS}>
            <p className="text-sm text-gray-400">{kpi.label}</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {/* Whole units, matching the balance cards above — these are
                    server-converted USD figures that land on fractions, and
                    two rounding conventions on one screen reads as an error.
                    Sales count is an integer either way. */}
                <NumberFlow
                  value={numbersRevealed ? kpi.value : 0}
                  prefix={kpi.valuePrefix}
                  format={{ notation: "standard", maximumFractionDigits: 0 }}
                />
              </p>
            </div>
            <p
              className={`mt-1 text-xs ${
                kpi.changePercent >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {formatChange(kpi.changePercent, kpi.comparison)}
            </p>
          </div>
        ))}
      </div>
      </div>

      {/* Revenue Overview */}
      <div className={`mb-4 ${CARD_CLASS}`}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-normal text-gray-800 dark:text-white">Revenue Overview</h3>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-905">
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  period === option.value
                    ? "bg-white text-brand-500 shadow-sm dark:bg-gray-800 dark:text-brand-400"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <ChartContainer
          config={revenueChartConfig}
          className={`h-[280px] w-full transition-opacity duration-200 ${
            isSwitchingPeriod ? "opacity-40" : "opacity-100"
          }`}
        >
          <AreaChart data={revenueChartData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical horizontal strokeDasharray="4 4" strokeOpacity={0.8} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12, fill: "#9ca3af" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              tickFormatter={(val: number) => `$${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `$${Number(value).toLocaleString()}`}
                />
              }
            />
            <Area
              dataKey="revenue"
              type="monotone"
              stroke="var(--color-revenue)"
              strokeWidth={2.5}
              fill="url(#revenueFill)"
            />
          </AreaChart>
        </ChartContainer>
      </div>

      {/* Bank account bar list + currency donut */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD_CLASS} ref={platformCardRef}>
          <h3 className="mb-4 text-base font-normal text-gray-800 dark:text-white">Revenue by Bank Account</h3>
          {/* Fixed height with internal scroll — the account list is uncapped
              (every account renders, including zero-sale ones), so without this
              the card grows past its neighbour as accounts are added. */}
          <div className="no-scrollbar h-[300px] space-y-3 overflow-y-auto pr-1">
            {bankRows.map((row, i) => (
              <div key={row.id} className="group flex items-center gap-3">
                <BankAvatar
                  bankName={row.bankName}
                  logoUrl={row.logoUrl}
                  size={24}
                />
                <span className="w-20 shrink-0 truncate text-sm text-gray-600 dark:text-gray-300">
                  {row.bankName}
                </span>
                <div className="flex h-2 flex-1 items-center overflow-visible rounded-full bg-brand-100 dark:bg-gray-905">
                  <div
                    className="h-full origin-left rounded-full bg-brand-500 transition-[width,transform] ease-out group-hover:scale-y-150"
                    style={{
                      width: platformInView
                        ? `${(row.totalRevenueUsd / maxBankValue) * 100}%`
                        : "0%",
                      transitionDuration: platformInView ? "700ms, 150ms" : "150ms",
                      transitionDelay: platformInView ? `${i * 60}ms` : "0ms",
                    }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-sm text-gray-800 dark:text-gray-100">
                  ${row.totalRevenueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
            {bankRows.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">
                No international accounts yet.
              </p>
            )}
          </div>
        </div>

        <div className={CARD_CLASS} ref={donutCardRef}>
          <h3 className="mb-4 text-base font-normal text-gray-800 dark:text-white">Revenue by Currency</h3>
          {/* Matches the bank list's fixed height so the two cards stay level. */}
          <CurrencyDonut rows={currencyRows} inView={donutInView} />
        </div>
      </div>

      {/* Account lists */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD_CLASS}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-normal text-gray-800 dark:text-white">Local Accounts</h3>
              <p className="text-xs text-gray-400">{formatCurrencyTotals(local?.totals ?? [])}</p>
            </div>
            <a href="/accounts/balances" className="text-sm font-medium text-brand-500 hover:text-brand-600">
              View all &rarr;
            </a>
          </div>
          <div className="space-y-3">
            {overview.bankAccounts.local.map((account) => (
              <AccountRowItem key={account.id} account={account} />
            ))}
            {overview.bankAccounts.local.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">No local accounts yet.</p>
            )}
          </div>
        </div>

        <div className={CARD_CLASS}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-normal text-gray-800 dark:text-white">International Accounts</h3>
              <p className="text-xs text-gray-400">
                {formatCurrencyTotals(international?.totals ?? [])}
              </p>
            </div>
            <a href="/accounts/balances" className="text-sm font-medium text-brand-500 hover:text-brand-600">
              View all &rarr;
            </a>
          </div>
          <div className="space-y-3">
            {overview.bankAccounts.international.map((account) => (
              <AccountRowItem key={account.id} account={account} />
            ))}
            {overview.bankAccounts.international.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">
                No international accounts yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Client revenue summary */}
      <div className={CARD_CLASS}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-normal text-gray-800 dark:text-white">Client Revenue Summary</h3>
          <a href="/accounts/clients" className="text-sm font-medium text-brand-500 hover:text-brand-600">
            View all clients &rarr;
          </a>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
              <th className="pb-2 font-normal">Client</th>
              <th className="pb-2 text-right font-normal">Sales</th>
              <th className="pb-2 text-right font-normal">Total Revenue (USD)</th>
            </tr>
          </thead>
          <tbody>
            {overview.topClients.map((client) => (
              <tr
                key={client.id}
                className="border-b border-gray-50 last:border-0 dark:border-gray-800/60"
              >
                <td className="py-3">
                  <div className="flex items-center gap-2.5">
                    <NameAvatar name={client.clientName} />
                    <span className="text-sm text-gray-800 dark:text-gray-100">
                      {client.clientName}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-right text-sm text-gray-500 dark:text-gray-400">
                  {client.salesCount}
                </td>
                {/* `totalRevenueUsd`, never `totalRevenue` — the latter is null
                    unless every one of the client's sales shares a currency,
                    and would render as "NaN" the moment one doesn't. */}
                <td className="py-3 text-right text-sm font-medium text-gray-800 dark:text-gray-100">
                  {formatMoney("USD", client.totalRevenueUsd)}
                </td>
              </tr>
            ))}
            {/* Clients with no transactions are absent rather than zero-filled,
                so this list can be short or empty. */}
            {overview.topClients.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-sm text-gray-400">
                  No client sales yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
