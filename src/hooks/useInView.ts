"use client";

import { useEffect, useState } from "react";

/** Walks up to the element that actually scrolls, so the observer uses it as
 *  root. The accounting pages scroll inside their own `overflow-y-auto`
 *  container and every ancestor is `overflow-hidden`, so a viewport-rooted
 *  observer never fires. */
export function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll") return current;
    current = current.parentElement;
  }
  return null;
}

/**
 * Flips to true once, the first time the returned ref's element scrolls into
 * view — used to gate one-shot "animate in on scroll" effects (chart entrance
 * animations, bar-width transitions) so they play on first visibility rather
 * than immediately on mount regardless of scroll position.
 *
 * Default threshold 0.25 = a quarter of the card must be inside the scroll
 * container before the animation plays, so it triggers on arriving at the
 * section rather than the moment its top edge peeks into view.
 */
export function useInView<T extends HTMLElement>(threshold = 0.25) {
  // Callback ref rather than useRef: these cards render only after the data
  // arrives (the component returns a skeleton before that), so a plain ref
  // would still be null when the effect first ran and — since assigning a ref
  // doesn't re-render — the effect would never retry and no observer would ever
  // be created. Storing the node in state re-runs the effect the moment it mounts.
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView || !node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      // `root: null` would watch the viewport, but these pages scroll inside
      // their own overflow-y-auto container, so the viewport never intersects.
      // IntersectionObserver fires once on observe() with the current state, so
      // a card that starts on screen still reveals without needing a scroll —
      // no manual geometry check required.
      { threshold, root: findScrollParent(node) }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, inView, threshold]);

  return [setNode, inView] as const;
}
