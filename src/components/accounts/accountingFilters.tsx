"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  LuCalendarDays,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronUp,
  LuX,
} from "react-icons/lu";

// Shared filter controls for the accounting screens. Extracted from
// TransactionsView so the Reports screen uses the same implementation rather
// than a copy that drifts — both drive the identical `GET /transactions`
// query params.

/**
 * `all` means genuinely unfiltered — no date params at all. Screens that own
 * an export must not offer it: the export API reads "no dates" as *today*,
 * so an all-time table beside a one-day file is the exact mismatch this
 * module exists to avoid. Reports therefore offers {@link REPORT_DATE_PRESETS}
 * instead, which starts at `today`.
 */
export type DatePreset =
  | "all"
  | "today"
  | "week"
  | "month"
  | "7"
  | "30"
  | "custom";

/** Every label states the span it actually sends — a picker that reads
 *  "Date Range" while sending 400 days was the original defect here. */
export const DATE_LABELS: Record<DatePreset, string> = {
  all: "All time",
  today: "Today",
  week: "This week",
  month: "This month",
  "7": "Last 7 days",
  "30": "Last 30 days",
  custom: "Custom range",
};

/** Rows offered by the Transactions filter, which has no export to match. */
export const TRANSACTION_DATE_PRESETS: DatePreset[] = ["all", "7", "30"];

/** Rows offered by Reports. No "all time": the export would silently narrow
 *  it to today, so the option cannot be honoured. */
export const REPORT_DATE_PRESETS: DatePreset[] = ["today", "week", "month"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** `yyyy-mm-dd` for a local calendar cell — never `toISOString()`, which
 *  shifts the day for anyone east/west of UTC. */
function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplay(iso: string): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Weeks of the month as day numbers, padded with nulls so each row is 7 wide. */
function buildCalendar(year: number, month: number): (number | null)[][] {
  const leading = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(leading).fill(null);
  for (let day = 1; day <= total; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Inline two-tap range calendar. Replaces the pair of `<input type="date">`
 * fields, which rendered as an OS-specific `dd/mm/yyyy` stub that gave no
 * feedback about the range being built. Taps alternate from → to, and a tap
 * before the current `from` restarts the range rather than producing an
 * inverted one the API would reject.
 */
function RangeCalendar({
  from,
  to,
  onChange,
  onComplete,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** Fired once the end date lands, so the owner can dismiss the panel. */
  onComplete?: () => void;
}) {
  const today = new Date();
  // Open on the month already selected so an existing range is visible.
  const [view, setView] = useState(() => {
    const anchor = from || to;
    if (anchor) {
      const [year, month] = anchor.split("-").map(Number);
      return { year, month: month - 1 };
    }
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  // While the month/year grid is open the header chevrons step years instead
  // of months — stepping months there would be redundant with the grid.
  const [picking, setPicking] = useState(false);

  const weeks = useMemo(() => buildCalendar(view.year, view.month), [view]);
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

  const shiftMonth = (delta: number) => {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };

  const shiftYear = (delta: number) =>
    setView((current) => ({ ...current, year: current.year + delta }));

  const handleDayClick = (day: number) => {
    const iso = toIso(view.year, view.month, day);
    // A sale cannot be dated in the future, so a range reaching past today
    // could only ever return zero extra rows.
    if (iso > todayIso) return;
    // A complete range, or a tap before the start, begins a new range.
    if (!from || to || iso < from) {
      onChange(iso, "");
      return;
    }
    onChange(from, iso);
    onComplete?.();
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905 dark:hover:text-gray-200"
        >
          <LuChevronLeft className="h-4 w-4" />
        </button>
        {/* The label doubles as the month-grid toggle; the arrows beside it
            step the year it already displays, so there is no second year
            readout to keep in sync. */}
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-expanded={picking}
            onClick={() => setPicking((value) => !value)}
            className="rounded-lg px-2 py-1 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-905"
          >
            {MONTHS[view.month]} {view.year}
          </button>
          <span className="flex flex-col">
            <button
              type="button"
              aria-label="Next year"
              onClick={() => shiftYear(1)}
              className="rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905 dark:hover:text-gray-200"
            >
              <LuChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => shiftYear(-1)}
              className="rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905 dark:hover:text-gray-200"
            >
              <LuChevronDown className="h-3.5 w-3.5" />
            </button>
          </span>
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905 dark:hover:text-gray-200"
        >
          <LuChevronRight className="h-4 w-4" />
        </button>
      </div>

      {picking ? (
        <div className="grid grid-cols-3 gap-1 py-1">
          {MONTHS.map((name, index) => (
            <button
              key={name}
              type="button"
              aria-pressed={index === view.month}
              onClick={() => {
                setView((current) => ({ ...current, month: index }));
                setPicking(false);
              }}
              className={`rounded-lg py-2 text-xs transition-colors ${
                index === view.month
                  ? "bg-brand-500 font-medium text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"
              }`}
            >
              {name.slice(0, 3)}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              className="py-1 text-[10px] font-medium text-gray-400 dark:text-gray-500"
            >
              {day}
            </span>
          ))}
          {weeks.map((week, weekIndex) =>
            week.map((day, dayIndex) => {
              if (!day) return <span key={`${weekIndex}-${dayIndex}`} />;
              const iso = toIso(view.year, view.month, day);
              const isEdge = iso === from || (Boolean(to) && iso === to);
              const inRange = Boolean(from && to) && iso > from && iso < to;
              const isFuture = iso > todayIso;
              return (
                <button
                  key={`${weekIndex}-${dayIndex}`}
                  type="button"
                  disabled={isFuture}
                  aria-pressed={isEdge}
                  onClick={() => handleDayClick(day)}
                  className={`rounded-lg py-1.5 text-xs transition-colors ${
                    isEdge
                      ? "bg-brand-500 font-medium text-white"
                      : inRange
                        ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                        : isFuture
                          ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                          : `text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905 ${
                              iso === todayIso
                                ? "font-semibold text-brand-500 ring-1 ring-inset ring-brand-500 dark:text-brand-400"
                                : ""
                            }`
                  }`}
                >
                  {day}
                </button>
              );
            })
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-gray-500 dark:text-gray-400">
          {from
            ? to
              ? `${formatDisplay(from)} — ${formatDisplay(to)}`
              : `${formatDisplay(from)} — pick end date`
            : "Pick a start date"}
        </span>
        {(from || to) && (
          <button
            type="button"
            onClick={() => onChange("", "")}
            className="flex shrink-0 items-center gap-1 text-gray-400 hover:text-red-500"
          >
            <LuX className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Single-date calendar. Same month/year navigation as {@link RangeCalendar},
 * but one tap commits the date instead of building a range — the two share the
 * grid helpers rather than each carrying their own copy.
 */
function SingleCalendar({
  value,
  min,
  max,
  onChange,
}: {
  value: string;
  /** `yyyy-mm-dd`; earlier days render disabled. */
  min?: string;
  /** `yyyy-mm-dd`; later days render disabled. */
  max?: string;
  onChange: (iso: string) => void;
}) {
  const today = new Date();
  const [view, setView] = useState(() => {
    if (value) {
      const [year, month] = value.split("-").map(Number);
      return { year, month: month - 1 };
    }
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const [picking, setPicking] = useState(false);

  const weeks = useMemo(() => buildCalendar(view.year, view.month), [view]);
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

  const shiftMonth = (delta: number) => {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };
  const shiftYear = (delta: number) =>
    setView((current) => ({ ...current, year: current.year + delta }));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905 dark:hover:text-gray-200"
        >
          <LuChevronLeft className="h-4 w-4" />
        </button>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-expanded={picking}
            onClick={() => setPicking((open) => !open)}
            className="rounded-lg px-2 py-1 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-905"
          >
            {MONTHS[view.month]} {view.year}
          </button>
          <span className="flex flex-col">
            <button
              type="button"
              aria-label="Next year"
              onClick={() => shiftYear(1)}
              className="rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905 dark:hover:text-gray-200"
            >
              <LuChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => shiftYear(-1)}
              className="rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905 dark:hover:text-gray-200"
            >
              <LuChevronDown className="h-3.5 w-3.5" />
            </button>
          </span>
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905 dark:hover:text-gray-200"
        >
          <LuChevronRight className="h-4 w-4" />
        </button>
      </div>

      {picking ? (
        <div className="grid grid-cols-3 gap-1 py-1">
          {MONTHS.map((name, index) => (
            <button
              key={name}
              type="button"
              aria-pressed={index === view.month}
              onClick={() => {
                setView((current) => ({ ...current, month: index }));
                setPicking(false);
              }}
              className={`rounded-lg py-2 text-xs transition-colors ${
                index === view.month
                  ? "bg-brand-500 font-medium text-white"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"
              }`}
            >
              {name.slice(0, 3)}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              className="py-1 text-[10px] font-medium text-gray-400 dark:text-gray-500"
            >
              {day}
            </span>
          ))}
          {weeks.map((week, weekIndex) =>
            week.map((day, dayIndex) => {
              if (!day) return <span key={`${weekIndex}-${dayIndex}`} />;
              const iso = toIso(view.year, view.month, day);
              const disabled = (Boolean(max) && iso > max!) || (Boolean(min) && iso < min!);
              const selected = iso === value;
              return (
                <button
                  key={`${weekIndex}-${dayIndex}`}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => onChange(iso)}
                  className={`rounded-lg py-1.5 text-xs transition-colors ${
                    selected
                      ? "bg-brand-500 font-medium text-white"
                      : disabled
                        ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                        : `text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905 ${
                            iso === todayIso
                              ? "font-semibold text-brand-500 ring-1 ring-inset ring-brand-500 dark:text-brand-400"
                              : ""
                          }`
                  }`}
                >
                  {day}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Form field that opens {@link SingleCalendar} in a dropdown. Replaces
 * `<input type="date">` so the picker matches the range filter on the
 * Transactions and Reports screens instead of the OS date stub.
 */
export function SingleDateField({
  value,
  min,
  max,
  onChange,
  placeholder = "Pick a date",
  clearable = false,
}: {
  value: string;
  /** `yyyy-mm-dd`; days before this can't be picked. */
  min?: string;
  max?: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  /** Shows an inline clear button once a date is set. Off by default — a sale
   *  date is required, but an optional field like a vendor's due date needs a
   *  way back to "none". */
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative mt-1.5">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-left text-sm font-normal text-gray-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      >
        <span className={`flex-1 truncate ${value ? "" : "text-gray-400"}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <LuCalendarDays className="h-4 w-4 shrink-0 text-gray-600 dark:text-gray-400" />
      </button>
      {clearable && value && (
        <button
          type="button"
          aria-label="Clear date"
          onClick={() => onChange("")}
          className="absolute right-9 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-905"
        >
          <LuX className="h-3.5 w-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[290px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-901">
          <SingleCalendar
            value={value}
            min={min}
            max={max}
            onChange={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Date-range filter. Unlike the mock version this drives the server-side
 * `dateFrom`/`dateTo` params, which filter on `saleDate` — so a preset now
 * narrows the whole result set rather than just the current page.
 */
export function DateDropdown({
  preset,
  from,
  to,
  onChange,
  align = "right",
  presets = TRANSACTION_DATE_PRESETS,
  clearPreset = "all",
}: {
  preset: DatePreset;
  from: string;
  to: string;
  onChange: (preset: DatePreset, from?: string, to?: string) => void;
  /** Which quick-pick rows to offer. Screens with an export pass
   *  {@link REPORT_DATE_PRESETS}, which omits the unfilterable "all time". */
  presets?: DatePreset[];
  /** Where clearing a custom range lands. Reports has no "all time" to fall
   *  back to, so it returns to `today` rather than an option it cannot honour. */
  clearPreset?: DatePreset;
  /** Which edge the panel hangs from. The panel is wider than its button, so
   *  a left-positioned control needs `left` or the panel runs off-screen —
   *  and vice versa for a right-aligned filter bar. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-10 min-w-[170px] items-center gap-2 rounded-xl border bg-white px-3 text-sm shadow-sm dark:bg-gray-901 ${
          preset !== "all"
            ? "border-brand-500 text-gray-900 dark:text-gray-100"
            : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300"
        }`}
      >
        <LuCalendarDays className="h-5 w-5" />
        <span className="flex-1 text-left">{DATE_LABELS[preset]}</span>
        <LuChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} z-30 mt-2 w-[290px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-901`}
        >
          {presets.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                onChange(value);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                preset === value
                  ? "bg-brand-500/10 text-brand-500"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"
              }`}
            >
              {DATE_LABELS[value]}
            </button>
          ))}
          <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
          <p className="mb-2 px-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            Custom range
          </p>
          <RangeCalendar
            from={from}
            to={to}
            onComplete={() => setOpen(false)}
            onChange={(nextFrom, nextTo) =>
              // Clearing the range drops back to the screen's default preset
              // so the button stops reading "Custom range" with nothing
              // selected.
              nextFrom || nextTo
                ? onChange("custom", nextFrom, nextTo)
                : onChange(clearPreset, "", "")
            }
          />
        </div>
      )}
    </div>
  );
}

/**
 * Multi-select checkbox dropdown; selections are sent comma-separated. Generic
 * over the option type so enum unions survive instead of widening to `string`.
 */
export function FilterDropdown<T extends string>({
  label,
  icon,
  values,
  selected,
  onChange,
  formatValue = (value: T) => value,
  align = "right",
}: {
  label: string;
  icon: ReactNode;
  values: readonly T[];
  selected: T[];
  onChange: (values: T[]) => void;
  formatValue?: (value: T) => string;
  /** See `DateDropdown` — the panel is wider than its button. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const buttonLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? formatValue(selected[0])
        : `${label} (${selected.length})`;

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-10 min-w-[165px] max-w-[230px] items-center gap-2 rounded-xl border bg-white px-3 text-sm shadow-sm transition-colors dark:bg-gray-901 ${
          selected.length
            ? "border-brand-500 text-gray-900 dark:text-gray-100"
            : "border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300"
        }`}
      >
        <span className="text-lg">{icon}</span>
        <span className="flex-1 truncate text-left">{buttonLabel}</span>
        <LuChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} z-30 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-901`}
        >
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {label}
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-brand-500 hover:text-brand-600"
              >
                Clear
              </button>
            )}
          </div>
          <div role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto">
            {values.map((value) => {
              const checked = selected.includes(value);
              return (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange(
                        checked
                          ? selected.filter((item) => item !== value)
                          : [...selected, value]
                      )
                    }
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="truncate">{formatValue(value)}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

