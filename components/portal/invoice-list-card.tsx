import Link from "next/link"
import { CalendarIcon, ChevronRightIcon, ReceiptIcon } from "lucide-react"

import { InvoiceStatusPill, plural } from "@/components/portal/lease-status"
import { Card } from "@/components/ui/card"
import { formatCurrencyFull, formatDate } from "@/lib/format"
import type { PortalLease } from "@/lib/portal"
import { cn } from "@/lib/utils"

type Invoiced = PortalLease & { invoice: NonNullable<PortalLease["invoice"]> }

/**
 * One invoice in the Payments grid — the same shape as `LeaseListCard`: icon
 * and status, what it is for, a bar (paid against the total), then a one-line
 * footer with the balance and where it leaves the tenant. The whole card opens the invoice.
 */
export function InvoiceListCard({ lease }: { lease: Invoiced }) {
  const { invoice } = lease
  const percent =
    invoice.amount > 0 ? Math.min(100, Math.round((invoice.paid / invoice.amount) * 100)) : 100
  const behind = invoice.coverage.amountBehind > 0

  return (
    <Card className="gap-0 p-0 transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
      <Link href={`/portal/payments/${invoice.id}`} className="block outline-none">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ReceiptIcon className="size-4.5" aria-hidden />
            </div>
            <InvoiceStatusPill status={invoice.status} />
          </div>

          <div className="mt-3 space-y-0.5">
            <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
              Invoice {invoice.reference}
            </p>
            <h3 className="font-semibold tracking-tight">
              {lease.propertyName} · Unit {lease.unitLabel}
            </h3>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">Due {formatDate(invoice.dueDate)}</span>
            </p>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground tabular-nums">
                {formatCurrencyFull(invoice.paid)} of {formatCurrencyFull(invoice.amount)}
              </span>
              <span className="shrink-0 font-medium tabular-nums">{percent}%</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${invoice.reference} paid`}
            >
              <div
                className="h-full rounded-full bg-stat-accent transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* One small line, like the lease card: what is left, and where that
            leaves the tenant — behind, covered until, or settled. */}
        <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs">
          <p className="min-w-0 truncate text-muted-foreground tabular-nums">
            Balance{" "}
            <span className={cn("font-medium text-foreground", behind && "text-stat-accent")}>
              {formatCurrencyFull(invoice.balance)}
            </span>
            <span className="mx-1.5">·</span>
            {behind ? (
              <span className="text-stat-accent">
                {plural(invoice.coverage.monthsBehind, "month")} behind
              </span>
            ) : invoice.balance === 0 ? (
              "Settled"
            ) : (
              `Covered until ${formatDate(invoice.coverage.coveredUntil)}`
            )}
          </p>
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
      </Link>
    </Card>
  )
}
