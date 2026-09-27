import Link from "next/link"
import { FileTextIcon, ReceiptIcon } from "lucide-react"

import { InvoiceStatusPill, plural } from "@/components/portal/lease-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrencyFull, formatDate } from "@/lib/format"
import type { PortalLease } from "@/lib/portal"
import { rentSchedule, type ScheduledMonth } from "@/lib/rent-coverage"
import { cn } from "@/lib/utils"

/**
 * The tenant's invoice page. Same layout as the lease page: header card, then
 * the invoice, its month-by-month schedule and its payments in the main
 * column, with the balance and how to pay beside them. Server components.
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

/** What is left to pay, what that means in months, and the way to the lease. */
export function InvoiceBalanceCard({ lease }: { lease: Invoiced }) {
  const { invoice } = lease
  const { coverage } = invoice
  const behind = coverage.amountBehind > 0
  const percent =
    invoice.amount > 0 ? Math.min(100, Math.round((invoice.paid / invoice.amount) * 100)) : 100

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

        <div className="space-y-2">
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Share of the invoice paid"
          >
            <div
              className="h-full animate-bar-grow rounded-full bg-stat-accent"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{percent}%</span>{" "}
            <span className="text-muted-foreground">
              paid · {formatCurrencyFull(invoice.paid)} of {formatCurrencyFull(invoice.amount)}
            </span>
          </p>
        </div>

        <div
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm",
            behind && "border-stat-accent/40 bg-stat-accent/5"
          )}
        >
          {behind ? (
            <>
              <span className="font-semibold text-stat-accent">
                {plural(coverage.monthsBehind, "month")} behind
              </span>{" "}
              <span className="text-muted-foreground">
                · {formatCurrencyFull(coverage.amountBehind)} due now
              </span>
            </>
          ) : invoice.balance === 0 ? (
            <span className="text-muted-foreground">The whole term is paid.</span>
          ) : (
            <>
              <span className="text-muted-foreground">Rent covered until </span>
              <span className="font-semibold tabular-nums">
                {formatDate(coverage.coveredUntil)}
              </span>
            </>
          )}
        </div>

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
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------------- main -- */

const MONTH_TONE: Record<ScheduledMonth["status"], string> = {
  Paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Partial: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Due: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  Upcoming: "bg-muted text-muted-foreground",
}

/**
 * The term month by month, payments applied to the oldest month first — so a
 * tenant can see exactly which months are settled, part-paid or owed.
 */
export function RentScheduleCard({ lease }: { lease: Invoiced }) {
  const months = rentSchedule(lease, lease.invoice.paid)
  const settled = months.filter((m) => m.status === "Paid").length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
        <CardTitle className="text-base">Monthly breakdown</CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">
          {settled} of {months.length} paid
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <ul>
          {months.map((month) => (
            <li
              key={month.index}
              className="relative flex items-center gap-3 px-6 py-3 text-sm after:pointer-events-none after:absolute after:inset-x-6 after:bottom-0 after:h-px after:bg-border last:after:hidden"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                {month.index}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium tabular-nums">{formatDate(month.start)}</p>
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  to {formatDate(month.end)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium tabular-nums">
                  {month.status === "Partial"
                    ? `${formatCurrencyFull(month.paid)} / ${formatCurrencyFull(lease.monthlyRent)}`
                    : formatCurrencyFull(lease.monthlyRent)}
                </p>
                <span
                  className={cn(
                    "mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                    MONTH_TONE[month.status]
                  )}
                >
                  {month.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/** Every payment recorded against the invoice, newest first, with the total. */
export function PaymentHistoryCard({ lease }: { lease: Invoiced }) {
  const { payments, paid } = lease.invoice

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
        <CardTitle className="text-base">Payment history</CardTitle>
        {payments.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {plural(payments.length, "payment")}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {payments.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No payments recorded yet. Payments your landlord records will appear here.
          </p>
        ) : (
          <>
            <ul>
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="relative flex items-center gap-3 px-6 py-3 text-sm after:pointer-events-none after:absolute after:inset-x-6 after:bottom-0 after:h-px after:bg-border last:after:hidden"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    <ReceiptIcon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums">{formatDate(payment.paidAt)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {payment.method ?? "Payment"}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatCurrencyFull(payment.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-3 text-sm">
              <span className="text-muted-foreground">Total paid</span>
              <span className="font-semibold tabular-nums">{formatCurrencyFull(paid)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
