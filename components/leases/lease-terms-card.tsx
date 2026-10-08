import type { ReactNode } from "react";

import { DetailRow } from "@/components/detail-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { lastDayOf } from "@/lib/dates";

export type LeaseTermsCardData = {
  startDate: Date;
  endDate: Date;
  durationMonths: number;
  /** The rate this lease was agreed at — not the unit's asking rent. */
  monthlyRent: number;
  leaseAmount: number;
  /** Auto-renew lives on the unit; `renewalMonths` is its minimum tenure. */
  autoRenew: boolean;
  renewalMonths: number | null;
};

/**
 * The lease this one renewed, and the lease that renewed it. Each side is
 * already rendered (a link, or plain text) because the landlord and tenant
 * pages link to different routes.
 */
export type LeaseRenewalChain = {
  renewedFrom?: ReactNode;
  renewedTo?: ReactNode;
};

function months(n: number) {
  return `${n} month${n === 1 ? "" : "s"}`;
}

/**
 * What the lease says: dates, length, rent and whether it renews. One card for
 * the landlord's lease Overview and the tenant's lease page, like `InvoiceCard`.
 */
export function LeaseTermsCard({
  lease,
  renewal,
  className,
}: {
  lease: LeaseTermsCardData;
  renewal?: LeaseRenewalChain;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle className="text-base">Lease terms</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <dl>
          {renewal?.renewedFrom && (
            <DetailRow label="Renewed from" value={renewal.renewedFrom} />
          )}
          {renewal?.renewedTo && (
            <DetailRow label="Renewed as" value={renewal.renewedTo} />
          )}
          <DetailRow label="Start date" value={formatDate(lease.startDate)} />
          <DetailRow label="End date" value={formatDate(lastDayOf(lease.endDate))} />
          <DetailRow label="Duration" value={months(lease.durationMonths)} />
          <DetailRow label="Payment frequency" value="Monthly" />
          <DetailRow
            label="Renewal"
            value={
              lease.autoRenew && lease.renewalMonths
                ? `Automatic · ${months(lease.renewalMonths)}`
                : "Not automatic"
            }
          />
          <DetailRow
            label="Monthly rent"
            value={
              <span className="font-mono tabular-nums">
                {formatCurrencyFull(lease.monthlyRent)}
              </span>
            }
          />
          <DetailRow
            label="Total lease amount"
            value={
              <span className="font-mono tabular-nums">
                {formatCurrencyFull(lease.leaseAmount)}
              </span>
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}
