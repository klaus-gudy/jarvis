"use client";

import { ExpiryTag } from "@/components/leases/expiry-tag";
import {
  LEASE_STATUS_VARIANT,
  type MemberLeaseRow,
} from "@/components/members/member-lease-columns";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyFull, formatDate } from "@/lib/format";

/**
 * A lease as one card, for the mobile list on a member's Leases tab.
 *
 * The term is written as a single range rather than the table's separate Start
 * and End columns — on one line "10 Aug 2026 → 10 Oct 2026" is what a term
 * actually is, where two stacked labelled dates is the table's shape imposed on
 * a card. `ExpiryTag` stays with the end date, which is the date it qualifies.
 */
export function MemberLeaseCard({ lease }: { lease: MemberLeaseRow }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium">{lease.reference}</p>
          <p className="truncate text-sm font-medium">
            {lease.propertyName} / {lease.unitLabel}
          </p>
        </div>
        <Badge
          variant={LEASE_STATUS_VARIANT[lease.status]}
          className="shrink-0 rounded-full font-normal"
        >
          {lease.status}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>
          {formatDate(new Date(lease.startDate))} →{" "}
          {formatDate(new Date(lease.endDate))}
        </span>
        <ExpiryTag expiry={lease.expiry} />
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {lease.durationMonths} months
        </span>
        <span className="font-mono text-sm tabular-nums">
          {formatCurrencyFull(lease.leaseAmount)}
        </span>
      </div>
    </div>
  );
}
