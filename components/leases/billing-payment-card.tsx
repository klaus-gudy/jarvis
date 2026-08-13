"use client";

import type { BillingPaymentRow } from "@/components/leases/billing-payment-columns";
import { formatCurrencyFull, formatDate } from "@/lib/format";

/**
 * A payment as one card, for the mobile ledger on a lease's Billing tab.
 *
 * Leaner than the payments page's card on purpose: every row here belongs to
 * the one invoice this lease has, so the reference and the invoice status —
 * both shown up on the Overview tab — would just repeat themselves down the
 * list. What is left is what actually differs between rows.
 */
export function BillingPaymentCard({ payment }: { payment: BillingPaymentRow }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-sm tabular-nums">
          {formatCurrencyFull(payment.amount)}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDate(new Date(payment.paidAt))}
        </span>
      </div>

      <p className="truncate text-xs text-muted-foreground">
        {payment.method ?? <span className="italic">No method</span>}
      </p>

      {payment.notes && (
        <p className="text-xs text-muted-foreground italic">{payment.notes}</p>
      )}
    </div>
  );
}
