"use client";

import { RefObject, useCallback, useEffect, useState } from "react";

interface Options {
  /** Preferred horizontal alignment of the dropdown relative to the trigger */
  align?: "left" | "right";
  /** Distance in px between the trigger and the dropdown */
  gap?: number;
  /** Minimum margin from the viewport edge */
  edgeMargin?: number;
}

interface Position {
  top: number;
  left: number;
  /** Maximum height the dropdown can take (used to clamp to viewport) */
  maxHeight: number;
}

/**
 * Anchors a portalled dropdown to a trigger button.
 *
 * - Always positioned within `gap` px of the trigger (default 5).
 * - Flips above the trigger if there's not enough space below.
 * - Aligns left/right based on space and the `align` preference.
 * - Recomputes on scroll, resize, and after the dropdown's actual size is measured.
 */
export function useDropdownPosition(
  triggerRef: RefObject<HTMLElement | null>,
  dropdownRef: RefObject<HTMLElement | null>,
  open: boolean,
  options: Options = {}
): Position {
  const { align = "left", gap = 5, edgeMargin = 8 } = options;
  const [pos, setPos] = useState<Position>({ top: 0, left: 0, maxHeight: 0 });

  const compute = useCallback(() => {
    const trigger = triggerRef.current;
    const dropdown = dropdownRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    // Use measured dimensions if available, otherwise fall back to sane defaults
    const dropW = dropdown?.offsetWidth || 240;
    const dropH = dropdown?.offsetHeight || 280;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - triggerRect.bottom - gap - edgeMargin;
    const spaceAbove = triggerRect.top - gap - edgeMargin;

    // Flip above if not enough room below AND there's more room above
    const placeAbove = spaceBelow < Math.min(dropH, 200) && spaceAbove > spaceBelow;

    let top: number;
    let maxHeight: number;
    if (placeAbove) {
      maxHeight = Math.max(120, spaceAbove);
      top = Math.max(edgeMargin, triggerRect.top - gap - Math.min(dropH, maxHeight));
    } else {
      maxHeight = Math.max(120, spaceBelow);
      top = triggerRect.bottom + gap;
    }

    // Horizontal: prefer requested alignment, then flip if it overflows
    let left: number;
    if (align === "right") {
      left = triggerRect.right - dropW;
      if (left < edgeMargin) left = triggerRect.left;
    } else {
      left = triggerRect.left;
      if (left + dropW > vw - edgeMargin) left = triggerRect.right - dropW;
    }
    left = Math.max(edgeMargin, Math.min(left, vw - dropW - edgeMargin));

    setPos({ top, left, maxHeight });
  }, [triggerRef, dropdownRef, align, gap, edgeMargin]);

  // Recompute when opened, on scroll, on resize, and when dropdown size settles
  useEffect(() => {
    if (!open) return;

    compute();
    // After the dropdown has rendered with content, measure again
    const raf = requestAnimationFrame(compute);

    const handler = () => compute();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);

    // Watch the dropdown for size changes (e.g. async-loaded list grows)
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && dropdownRef.current) {
      observer = new ResizeObserver(handler);
      observer.observe(dropdownRef.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
      observer?.disconnect();
    };
  }, [open, compute, dropdownRef]);

  return pos;
}
