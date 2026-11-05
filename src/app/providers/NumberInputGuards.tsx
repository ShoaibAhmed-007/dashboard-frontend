"use client";

import { useNoWheelNumberInputs } from "@/hooks/useNoWheelNumberInputs";

/**
 * Mount point for app-wide input behaviour that has to run in the browser.
 * Renders nothing — it exists only so the root layout can stay a server
 * component while still installing the listener.
 */
export function NumberInputGuards() {
  useNoWheelNumberInputs();
  return null;
}
