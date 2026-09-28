import Link from "next/link"
import { FileTextIcon, ReceiptIcon } from "lucide-react"

import { AddPaymentButton } from "@/components/portal/add-payment-button"
import { InvoiceStatusPill } from "@/components/portal/lease-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrencyFull, formatDate } from "@/lib/format"
import type { PortalLease } from "@/lib/portal"
import { cn } from "@/lib/utils"

/**
 * The tenant's invoice page. Same layout as the lease page: header card, then
 * the shared invoice card in the main column, with the balance and how to pay
 * beside it. Server components.
 */

type Invoiced = PortalLease & { invoice: NonNullable<PortalLease["invoice"]> }

export function InvoiceHeaderCard({ lease }: { lease: Invoiced }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ReceiptIcon className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              Invoice {lease.invoice.reference}
            </h2>
            <InvoiceStatusPill status={lease.invoice.status} />
          </div>
          <p className="truncate text-sm text-muted-foreground">
            Rent for {lease.propertyName} · Unit {lease.unitLabel} · Lease {lease.reference}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------------- side -- */

/**
 * What is left to pay, and what to do about it. No bar and no due date here:
 * the Invoice card beside it already carries both.
 */
export function InvoiceBalanceCard({ lease }: { lease: Invoiced }) {
  const { invoice } = lease
  const behind = invoice.coverage.amountBehind > 0

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">Balance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <p
            className={cn(
              "text-3xl font-bold tracking-tight tabular-nums",
              behind && "text-stat-accent"
            )}
          >
            {formatCurrencyFull(invoice.balance)}
          </p>
          <p className="text-sm text-muted-foreground">
            {invoice.balance === 0 ? "Nothing left to pay" : "left to pay on this invoice"}
          </p>
        </div>

        {invoice.pendingClaims.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Awaiting confirmation</p>
            <ul className="divide-y rounded-lg border text-sm">
              {invoice.pendingClaims.map((claim) => (
                <li key={claim.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {formatDate(claim.paidAt)}
                    {claim.method ? ` · ${claim.method}` : ""}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCurrencyFull(claim.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Your landlord confirms these before they count toward the balance.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {invoice.balance > 0 && (
            <AddPaymentButton
              invoice={{ id: invoice.id, amount: invoice.amount, paid: invoice.paid, balance: invoice.balance }}
            />
          )}
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            nativeButton={false}
            render={<Link href={`/portal/lease/${lease.id}`} />}
          >
            <FileTextIcon />
            View lease {lease.reference}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
