"use client";

import { useCallback, useState } from "react";

/**
 * Header-side state for in-conversation search.
 *
 * The query and cursor live here, in the panel that renders the header input;
 * the *matching* stays in the thread, which is the only place that holds the
 * loaded messages. The thread reports its count back through
 * `setMatchCount`, which is what lets the header show "3/12" without
 * knowing anything about messages.
 *
 * Shared by the DM and channel panels so both headers behave identically.
 */
export function useThreadSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((open) => {
      if (open) {
        // Closing clears, so reopening never resumes a stale search.
        setQuery("");
        setActiveIndex(0);
      }
      return !open;
    });
  }, []);

  const changeQuery = useCallback((next: string) => {
    setQuery(next);
    // A new query invalidates the old cursor.
    setActiveIndex(0);
  }, []);

  /** Wraps in both directions, so Next past the last match returns to the first. */
  const step = useCallback(
    (delta: number) =>
      setActiveIndex((current) =>
        matchCount === 0 ? 0 : (current + delta + matchCount) % matchCount
      ),
    [matchCount]
  );

  return {
    isOpen,
    query,
    activeIndex,
    matchCount,
    toggle,
    close,
    changeQuery,
    setMatchCount,
    prev: useCallback(() => step(-1), [step]),
    next: useCallback(() => step(1), [step]),
  };
}
