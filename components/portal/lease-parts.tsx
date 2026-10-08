import { Badge } from "@/components/ui/badge"
import { formatCurrencyFull, formatDate } from "@/lib/format"
import { INVOICE_STATUS_VARIANT } from "@/lib/invoice-types"
import type { PortalLease, PortalPayment } from "@/lib/portal"
import { lastDayOf } from "@/lib/dates"

/**
 * The pieces the portal's pages build their lease views from. Server
 * components — everything here is display.
 */

export function LeaseTitle({ lease }: { lease: PortalLease }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {lease.propertyName} · {lease.unitLabel}
      <Badge variant="outline" className="rounded-full font-normal">
        {lease.status}
      </Badge>
      <DaysLeftBadge lease={lease} />
    </span>
  )
}

/** Only while the lease runs; escalates like the staff tables' expiry tags. */
export function DaysLeftBadge({ lease }: { lease: PortalLease }) {
  if (lease.daysLeft === null) return null
  const label =
    lease.daysLeft === 0
      ? "Ends today"
      : `${lease.daysLeft} day${lease.daysLeft === 1 ? "" : "s"} left`
  return (
    <Badge
      variant={lease.expiry?.tier === "urgent" ? "destructive" : "outline"}
      className="rounded-full font-normal"
    >
      {label}
    </Badge>
  )
}

export function LeasePeriod({ lease }: { lease: PortalLease }) {
  return (
    <>
      {lease.reference} · {formatDate(lease.startDate)} – {formatDate(lastDayOf(lease.endDate))} ·{" "}
      {formatCurrencyFull(lease.monthlyRent)} a month
    </>
  )
}

export function InvoiceFigures({ invoice }: { invoice: NonNullable<PortalLease["invoice"]> }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <Figure label="Total" value={formatCurrencyFull(invoice.amount)} />
      <Figure label="Paid" value={formatCurrencyFull(invoice.paid)} />
      <div>
        <p className="text-muted-foreground">Balance</p>
        <p className="flex flex-wrap items-center gap-2 font-medium tabular-nums">
          {formatCurrencyFull(invoice.balance)}
          <Badge
            variant={INVOICE_STATUS_VARIANT[invoice.status]}
            className="rounded-full font-normal"
          >
            {invoice.status}
          </Badge>
        </p>
      </div>
    </div>
  )
}

export function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  )
}

export function PaymentList({ payments }: { payments: PortalPayment[] }) {
  return (
    <ul className="divide-y rounded-md border text-sm">
      {payments.map((payment) => (
        <li key={payment.id} className="flex justify-between gap-3 px-3 py-2">
          <span className="text-muted-foreground">
            {formatDate(payment.paidAt)}
            {payment.method ? ` · ${payment.method}` : ""}
          </span>
          <span className="tabular-nums">{formatCurrencyFull(payment.amount)}</span>
        </li>
      ))}
    </ul>
  )
}
