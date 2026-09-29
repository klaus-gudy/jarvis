"use client";

import Link from "next/link";

import { ExpiryTag } from "@/components/leases/expiry-tag";
import { LEASE_STATUS_VARIANT } from "@/components/members/member-lease-columns";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import type { LeaseExpiry, LeaseStatus } from "@/lib/leases";

export type LeasePreview = {
  reference: string;
  status: LeaseStatus;
  /** ISO strings — they cross the server/client boundary. */
  startDate: string;
  endDate: string;
  durationMonths: number;
  monthlyRent: number;
  expiry?: LeaseExpiry | null;
  /** Whoever the surrounding page isn't about, e.g. the tenant on a unit page. */
  subtitle?: string | null;
};

/**
 * A lease reference that previews the term on hover — status, dates and rent —
 * and opens the lease on click. As with `TenantHoverCard`, pass `href` only
 * when the viewer can open the lease; otherwise it renders the bare reference.
 */
export function LeaseHoverCard({
  lease,
  href,
  className,
  align = "end",
}: {
  lease: LeasePreview;
  href: string | null;
  className?: string;
  /** `end` suits a right-aligned detail row, `start` a table cell. */
  align?: "start" | "center" | "end";
}) {
  if (!href) return <span className={className}>{lease.reference}</span>;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={300}
        render={<Link href={href} className={className} />}
      >
        {lease.reference}
      </HoverCardTrigger>
      <HoverCardContent align={align} className="w-72 space-y-3 p-3 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-medium">Lease {lease.reference}</p>
            {lease.subtitle && (
              <p className="truncate text-sm font-medium">{lease.subtitle}</p>
            )}
          </div>
          <Badge
            variant={LEASE_STATUS_VARIANT[lease.status]}
            className="shrink-0 rounded-full font-normal"
          >
            {lease.status}
          </Badge>
        </div>
        <dl className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Term</dt>
            <dd className="flex items-center gap-1.5">
              {formatDate(new Date(lease.startDate))} →{" "}
              {formatDate(new Date(lease.endDate))}
              <ExpiryTag expiry={lease.expiry ?? null} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Duration</dt>
            <dd>
              {lease.durationMonths} month{lease.durationMonths === 1 ? "" : "s"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Rent</dt>
            <dd className="font-mono tabular-nums">
              {formatCurrencyFull(lease.monthlyRent)}/mo
            </dd>
          </div>
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}
