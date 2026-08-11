"use client";

import { ClockAlertIcon, ClockIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { LeaseExpiry } from "@/lib/leases";

/**
 * Flags a running lease that is close to its end date, escalating as the date
 * nears — the same direction the dashboard's renewals panel already goes, where
 * anything under 30 days turns gold.
 *
 * Inside 60 days is an outline clock, a note to self. Inside 30 it turns
 * destructive with an alert clock: at that point the tenant needs an answer
 * about renewing. The day count is on the badge because "soon" is not
 * actionable on its own.
 */
export function ExpiryTag({ expiry }: { expiry: LeaseExpiry | null }) {
  if (!expiry) return null;

  const urgent = expiry.tier === "urgent";
  const Icon = urgent ? ClockAlertIcon : ClockIcon;

  return (
    <Badge
      variant={urgent ? "destructive" : "outline"}
      className="gap-0.5 rounded-full px-1 py-0.5 text-[10px] font-normal leading-none tabular-nums"
      // The badge is a glance; the full sentence is for anyone hovering or
      // using a screen reader.
      title={
        expiry.daysLeft <= 0
          ? "This lease ends today"
          : `This lease ends in ${expiry.daysLeft} day${expiry.daysLeft === 1 ? "" : "s"}`
      }
    >
      <Icon className="size-1 shrink-0" aria-hidden />
      {expiry.daysLeft <= 0 ? "today" : `${expiry.daysLeft}d`}
    </Badge>
  );
}
