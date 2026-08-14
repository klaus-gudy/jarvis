"use client";

import { formatCurrencyFull } from "@/lib/format";

/**
 * What an invoice stands at, above the amount field.
 *
 * Shared by both payment dialogs. The payments page picks its invoice, the
 * lease's Billing tab has exactly one and shows it fixed — but what you need to
 * see before typing a figure is the same either way, so the breakdown is
 * defined once rather than copied into the second dialog.
 *
 * `reference` is shown only where the invoice was chosen from a list, since on
 * a lease there is nothing to distinguish it from.
 */
export function InvoiceSummaryCard({
  reference,
  amount,
  paid,
  balance,
}: {
  reference?: string;
  amount: number;
  paid: number;
  balance: number;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
      {reference && (
        <div className="mb-1 flex items-center justify-between gap-3 border-b pb-1.5">
          <span className="text-muted-foreground">Invoice</span>
          <span className="font-mono text-xs font-medium">{reference}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Invoice total</span>
        <span className="font-mono tabular-nums">
          {formatCurrencyFull(amount)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Paid so far</span>
        <span className="font-mono tabular-nums">
          {formatCurrencyFull(paid)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 border-t pt-1.5 font-medium">
        <span>Balance</span>
        <span className="font-mono tabular-nums">
          {formatCurrencyFull(balance)}
        </span>
      </div>
    </div>
  );
}
