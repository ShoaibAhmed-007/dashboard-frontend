"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

export interface AnchoredStyle {
  position: "fixed";
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Positions a dropdown against its trigger in *viewport* coordinates, so the
 * list can be rendered through a portal instead of inside the field.
 *
 * The pickers live inside a modal whose body is `overflow-y-auto`. An
 * absolutely-positioned panel in that body counts toward its scroll height, so
 * opening a dropdown near the bottom grew the modal's scrollbar and let the
 * list be clipped by the modal edge. Rendering to `document.body` takes the
 * panel out of that flow entirely — at the cost of having to place it by hand,
 * which is what this returns.
 *
 * Flips above the trigger when there isn't room below, and caps `maxHeight` to
 * whatever space is actually available so a long list scrolls internally
 * rather than running off-screen.
 */
export function useAnchoredDropdown(
  triggerRef: RefObject<HTMLElement | null>,
  open: boolean,
  { gap = 4, preferredMaxHeight = 240, margin = 8 } = {}
): AnchoredStyle | null {
  const [style, setStyle] = useState<AnchoredStyle | null>(null);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - gap - margin;
    const above = rect.top - gap - margin;
    // Flip up only when below is genuinely too tight *and* above has more room.
    const flip = below < 140 && above > below;
    const maxHeight = Math.max(
      120,
      Math.min(preferredMaxHeight, flip ? above : below)
    );
    setStyle({
      position: "fixed",
      top: flip ? rect.top - gap - maxHeight : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, [triggerRef, gap, preferredMaxHeight, margin]);

  // Before paint, so the panel never flashes at a stale position. Only
  // measures on open; the closed case is handled by returning null below
  // rather than by clearing state from inside the effect.
  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    // `true` catches scrolls in the modal body, not just the window.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  // Derived, not stored: a stale measurement from the previous open must never
  // be handed back while closed.
  return open ? style : null;
}
