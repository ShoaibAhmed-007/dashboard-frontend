"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import { LuCalendar } from "react-icons/lu";

/**
 * Controlled single-date field, backed by flatpickr — same library as
 * `form/date-picker.tsx`, adapted to a plain `value`/`onChange` string
 * contract instead of that component's uncontrolled `defaultDate`/`Hook`
 * API, so it can be swapped in wherever a native `<input type="date">` was
 * driving `useState` directly.
 *
 * flatpickr only reads its options once, at construction — there is no
 * `setDate`-on-prop-change built into a plain options object, so staying in
 * sync with an externally changing `value` (e.g. opening a different row to
 * edit) means destroying and recreating the instance whenever `value`
 * changes, the same trick `form/date-picker.tsx` already relies on via its
 * `defaultDate` effect dependency.
 */
export default function ControlledDatePicker({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id: string;
  /** "YYYY-MM-DD", or "" for no date selected. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  // Read via a ref inside the effect so a new `onChange` identity each
  // render doesn't force a pointless destroy/recreate of the calendar. Set
  // in its own effect, not during render — mutating a ref while rendering
  // is what React's rules-of-hooks lint (react-hooks/refs) flags.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const instance = flatpickr(`#${id}`, {
      // No `static: true` — that positions the calendar as a normal in-flow
      // sibling of the input, which only works correctly when every
      // ancestor is normally positioned. This field lives inside a
      // `position: fixed` drawer, so static positioning miscalculates the
      // offset and the calendar renders partly off-screen. Appending to
      // `document.body` (flatpickr's default target, made explicit here)
      // lets it position itself from the input's actual viewport
      // coordinates instead, which is fixed-ancestor-safe.
      appendTo: document.body,
      monthSelectorType: "static",
      dateFormat: "Y-m-d",
      defaultDate: value || undefined,
      onChange: (_dates, dateStr) => onChangeRef.current(dateStr),
    });

    return () => {
      if (!Array.isArray(instance)) instance.destroy();
    };
  }, [id, value]);

  return (
    <div className="relative">
      <input id={id} placeholder={placeholder} className={className} />
      <LuCalendar
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
      />
    </div>
  );
}
