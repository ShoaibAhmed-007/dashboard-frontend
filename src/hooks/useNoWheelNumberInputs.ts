"use client";

import { useEffect } from "react";

/**
 * Stops a trackpad, mouse wheel, or arrow key from changing the value of a
 * focused `<input type="number">`.
 *
 * Browsers treat a wheel event over a focused number input as increment /
 * decrement. On a laptop trackpad that fires constantly: scrolling a long form
 * with the pointer resting over an amount field silently rewrites it, and the
 * user has no reason to look back at a field they already filled in. For money
 * amounts that is a data-integrity bug, not a papercut.
 *
 * Implemented once at the app root rather than per input: the listener is
 * non-passive (it must be able to `preventDefault`), and React's `onWheel` is
 * registered passively, so an inline handler cannot cancel the default.
 * Blurring instead of preventing would fight focus management in modals.
 *
 * The page still scrolls — cancelling the wheel event only suppresses the
 * value change, and the surrounding scroll container receives the gesture as
 * usual because the input itself is not scrollable.
 */
export function useNoWheelNumberInputs() {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement &&
        target.type === "number" &&
        // Only while focused — the browser ignores the wheel otherwise, so
        // cancelling then would needlessly block scrolling over the field.
        document.activeElement === target
      ) {
        event.preventDefault();
      }
    };

    // Arrow keys nudge the value by `step` for the same reason the wheel does.
    // Less dangerous than the trackpad (it needs a deliberate keypress in a
    // focused field), but with the spinners hidden there is no longer any
    // visual affordance suggesting the field steps at all, so allowing it
    // would just be a surprise.
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement &&
        target.type === "number" &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
