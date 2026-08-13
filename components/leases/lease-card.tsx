"use client";

import { ExpiryTag } from "@/components/leases/expiry-tag";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { INVOICE_STATUS_VARIANT } from "@/lib/invoice-types";
import type { LeaseRow, LeaseStatus } from "@/lib/leases";

const STATUS_VARIANT: Record<LeaseStatus, "secondary" | "outline" | "destructive"> =
  {
    Active: "secondary",
    Upcoming: "outline",
    Ended: "outline",
  };

/**
 * A lease as one card, for the mobile list on the org-wide leases page.
 *
 * The member page's version of this card leads with the reference, because
 * every row there already belongs to one person. Here the tenant is the point
 * of the row, so it leads and the reference drops to a caption.
 */
export function LeaseCard({ lease }: { lease: LeaseRow }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{lease.tenantName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {lease.propertyName} / {lease.unitLabel}
          </p>
        </div>
        <Badge
          variant={STATUS_VARIANT[lease.status]}
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
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {lease.durationMonths} months
          {lease.invoice && (
            <Badge
              variant={INVOICE_STATUS_VARIANT[lease.invoice.status]}
              className="rounded-full font-normal"
            >
              {lease.invoice.status}
            </Badge>
          )}
        </span>
        <span className="shrink-0 font-mono text-sm tabular-nums">
          {formatCurrencyFull(lease.leaseAmount)}
        </span>
      </div>
    </div>
  );
}
