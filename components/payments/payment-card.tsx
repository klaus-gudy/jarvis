"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { INVOICE_STATUS_VARIANT } from "@/lib/invoice-types";
import type { PaymentRow } from "@/lib/payments";

/**
 * A payment as one card, for the mobile list on the payments page.
 *
 * The badge is the *invoice's* status, not the payment's — a payment has no
 * status of its own. It sits beside the reference it describes rather than
 * beside the tenant, so it can't be read as saying something about the person.
 */
export function PaymentCard({ payment }: { payment: PaymentRow }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{payment.tenantName}</p>
        <span className="shrink-0 font-mono text-sm tabular-nums">
          {formatCurrencyFull(payment.amount)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-mono">{payment.invoiceReference}</span>
        <Badge
          variant={INVOICE_STATUS_VARIANT[payment.invoiceStatus]}
          className="rounded-full font-normal"
        >
          {payment.invoiceStatus}
        </Badge>
      </div>

      <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">
          {payment.method ?? <span className="italic">No method</span>}
        </span>
        <span className="shrink-0">
          {formatDate(new Date(payment.paidAt))}
        </span>
      </div>
    </div>
  );
}
