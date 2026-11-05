"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Cell, Pie, PieChart, Sector } from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { currencyColor } from "@/components/accounts/currencyColors";
import { formatMoney } from "@/components/accounts/platformMeta";
import type { Currency } from "@/services/accounting.service";

const ACTIVE_SECTOR_GROW = 8;
const ACTIVE_SECTOR_DURATION = 550;

// Shares the hovered slice's code with AnimatedSector instances without
// recreating Pie's `shape` render function on every render (see note below).
const ActiveCurrencyContext = createContext<string | undefined>(undefined);

// Recharts has no built-in tween for a Pie slice's outerRadius on hover, and
// `activeShape` unmounts on mouse-leave (so it can only grow, never shrink
// back smoothly). Rendering every slice through this `shape`, always
// mounted, and ramping outerRadius with rAF based on whether its code is the
// hovered one gives a symmetric grow/shrink transition.
//
// Must stay a stable, named component reference (not an inline arrow
// function passed to Pie's `shape` prop) — an inline function is a new
// component type on every render, which would remount this on every parent
// re-render and reset the animation instead of tweening from where it left off.
// Reads the active code from context (rather than a prop) so the `shape`
// callback itself never needs to change identity when hover state updates.
function AnimatedSector(props: PieSectorDataItem) {
  const activeCode = useContext(ActiveCurrencyContext);
  const code = (props.payload as { code?: string } | undefined)?.code;
  const isActive = code !== undefined && code === activeCode;
  const baseOuterRadius = Number(props.outerRadius) || 90;
  const target = isActive ? baseOuterRadius + ACTIVE_SECTOR_GROW : baseOuterRadius;
  const [radius, setRadius] = useState(baseOuterRadius);
  const radiusRef = useRef(radius);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = radiusRef.current;
    const to = target;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = Math.min((now - start) / ACTIVE_SECTOR_DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      radiusRef.current = next;
      setRadius(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return <Sector {...props} outerRadius={radius} />;
}

/** The per-currency shape both Overview and Reports feed this component. */
export interface CurrencyDonutRow {
  currency: Currency;
  total: number;
  totalUsd: number;
  percent: number;
}

/**
 * Donut + legend for a per-currency revenue split, shared by the Overview and
 * Reports screens. Owns its own hover state and empty state; the caller only
 * supplies the rows and whether the card has scrolled into view.
 *
 * `showAmounts` adds the native-currency figure to each legend row — Reports
 * has the horizontal room and a report reader wants the amount, not just the
 * share; Overview's narrower card does not.
 */
export default function CurrencyDonut({
  rows,
  inView,
  emptyLabel = "No sales recorded yet.",
  showAmounts = false,
}: {
  rows: CurrencyDonutRow[];
  inView: boolean;
  emptyLabel?: string;
  showAmounts?: boolean;
}) {
  const [activeCurrencyCode, setActiveCurrencyCode] = useState<string | undefined>(
    undefined
  );

  const chartData = useMemo(
    () =>
      rows.map((entry) => ({
        code: entry.currency,
        percent: entry.percent,
        fill: currencyColor(entry.currency),
      })),
    [rows]
  );

  const chartConfig = useMemo(
    () =>
      rows.reduce((config, entry) => {
        config[entry.currency] = {
          label: entry.currency,
          color: currencyColor(entry.currency),
        };
        return config;
      }, {} as ChartConfig),
    [rows]
  );

  return (
    <div className="flex h-[300px] items-center justify-center gap-6">
      <ActiveCurrencyContext.Provider value={activeCurrencyCode}>
        {inView && chartData.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-square h-[220px] w-[220px] shrink-0"
          >
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="code"
                    formatter={(value) => `${value}%`}
                    hideLabel
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="percent"
                nameKey="code"
                innerRadius={55}
                outerRadius={90}
                cornerRadius={5}
                strokeWidth={2}
                isAnimationActive
                animationBegin={0}
                animationDuration={1500}
                animationEasing="ease-out"
                shape={AnimatedSector}
                onMouseEnter={(data: PieSectorDataItem) =>
                  setActiveCurrencyCode(
                    (data.payload as { code?: string } | undefined)?.code
                  )
                }
                onMouseLeave={() => setActiveCurrencyCode(undefined)}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.code} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        ) : chartData.length === 0 ? (
          /* Empty state: a grey ring standing in for the donut, so the
             card shows what kind of visual appears once sales exist
             rather than reading as a broken/blank panel. */
          <div
            aria-hidden="true"
            className="flex h-[220px] w-[220px] shrink-0 items-center justify-center"
          >
            <div className="h-[180px] w-[180px] rounded-full border-25 border-gray-100 dark:border-gray-800" />
          </div>
        ) : (
          /* Pre-scroll spacer — data exists but the card isn't in view
             yet, so the donut holds its layout until the animation runs. */
          <div aria-hidden="true" className="h-[220px] w-[220px] shrink-0" />
        )}
      </ActiveCurrencyContext.Provider>
      {/* Shrink-to-fit rather than `flex-1` — the percentages are
          right-aligned so they line up as a column, which with a wide
          legend strands the number at the far edge of the card. */}
      <div className="no-scrollbar max-h-full min-w-0 space-y-2.5 overflow-y-auto pr-1">
        {rows.map((entry) => (
          <div key={entry.currency} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: currencyColor(entry.currency) }}
            />
            <span className="w-12 text-sm text-gray-600 dark:text-gray-300">
              {entry.currency}
            </span>
            {showAmounts && (
              <span className="w-28 truncate text-right text-sm text-gray-500 dark:text-gray-400">
                {formatMoney(entry.currency, entry.total)}
              </span>
            )}
            {/* Fixed width + right-align keeps percentages in a tidy column
                across rows without stretching the legend to fill the card. */}
            <span className="w-14 text-right text-sm font-medium text-gray-800 dark:text-gray-100">
              {entry.percent.toFixed(1)}%
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-gray-400">{emptyLabel}</p>}
      </div>
    </div>
  );
}
