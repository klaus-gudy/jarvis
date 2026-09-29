"use client";

import { ExpiryTag } from "@/components/leases/expiry-tag";
import { LEASE_STATUS_VARIANT } from "@/components/members/member-lease-columns";
import type { UnitLeaseRow } from "@/components/properties/unit-lease-columns";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyFull, formatDate } from "@/lib/format";

/** A lease as one card, for the mobile list on a unit's Leases tab — `MemberLeaseCard` with the tenant in place of the unit. */
export function UnitLeaseCard({ lease }: { lease: UnitLeaseRow }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium">{lease.reference}</p>
          <p className="truncate text-sm font-medium">{lease.tenantName}</p>
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
          {formatCurrencyFull(lease.monthlyRent)}
          <span className="text-xs text-muted-foreground">/mo</span>
        </span>
      </div>
    </div>
  );
}
