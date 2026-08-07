"use client";

import * as React from "react";

import { normalizeTzPhone } from "@/lib/phone";

const DEBOUNCE_MS = 500;

/**
 * Client-side echo of the same validation the backend enforces, surfaced
 * after a typing pause instead of only on submit. Same "answered vs. live
 * query" shape as the org-name availability check in the register form:
 * setState only happens inside the debounced callback, and the result is
 * paired with the value it answers, so a stale check can't paint an error
 * over text the user has since changed.
 */
export function usePhoneError(value: string, debounceMs = DEBOUNCE_MS) {
  const trimmed = value.trim();
  const [checked, setChecked] = React.useState<{
    value: string;
    error: string | null;
  } | null>(null);

  React.useEffect(() => {
    if (!trimmed) return;

    const timer = setTimeout(() => {
      setChecked({
        value: trimmed,
        error: normalizeTzPhone(trimmed) ? null : "Enter a valid phone number",
      });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [trimmed, debounceMs]);

  if (!trimmed || checked?.value !== trimmed) return null;
  return checked.error;
}
