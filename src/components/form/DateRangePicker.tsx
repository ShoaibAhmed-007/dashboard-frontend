"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import { LuCalendar } from "react-icons/lu";

/**
 * A single flatpickr calendar in range mode — click a start day, then an
 * end day, same widget for both rather than two separate pickers.
 *
 * Unlike `ControlledDatePicker`, this mounts flatpickr exactly once (empty
 * effect deps) instead of destroying/recreating the instance on every value
 * change. That distinction matters here specifically: this field lives
 * inside a popover that a document-level "click outside closes it" listener
 * manages, and flatpickr's own calendar renders as a sibling of <body>
 * (`appendTo`), outside that popover's DOM. Recreating the instance on each
 * date picked (as `ControlledDatePicker` does, fine for a static drawer
 * field with nothing else contending for the DOM) tore the calendar down
 * mid-selection there. Mounting once and only ever reading the instance via
 * a ref sidesteps that entirely — the calendar simply stays alive across
 * both clicks, and the popover only closes when the range is actually
 * finished (flatpickr's own `closeOnSelect` behavior) or the user genuinely
 * clicks elsewhere.
 */
export default function DateRangePicker({
  id,
  from,
  to,
  onChange,
  placeholder = "Select date range",
  className,
}: {
  id: string;
  /** "YYYY-MM-DD", or "" for unset. */
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const fpRef = useRef<ReturnType<typeof flatpickr> | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const instance = flatpickr(`#${id}`, {
      mode: "range",
      appendTo: document.body,
      monthSelectorType: "static",
      dateFormat: "Y-m-d",
      defaultDate: [from, to].filter(Boolean),
      onChange: (dates) => {
        const fmt = (d?: Date) => (d ? flatpickr.formatDate(d, "Y-m-d") : "");
        onChangeRef.current(fmt(dates[0]), fmt(dates[1]));
      },
    });
    fpRef.current = instance;

    return () => {
      if (!Array.isArray(instance)) instance.destroy();
      fpRef.current = null;
    };
    // Mounted once — `from`/`to` afterward are read only to clear the
    // widget below, not to rebuild it (see the doc comment above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Sync an external reset (e.g. the filter row's "Reset"/"Clear dates"
  // button) into the still-alive instance instead of rebuilding it.
  useEffect(() => {
    const instance = fpRef.current;
    if (!instance || Array.isArray(instance)) return;
    if (!from && !to) instance.clear();
  }, [from, to]);

  return (
    <div className="relative">
      <input id={id} readOnly placeholder={placeholder} className={className} />
      <LuCalendar
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
      />
    </div>
  );
}
