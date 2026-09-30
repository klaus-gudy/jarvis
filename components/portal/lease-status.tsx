import { calendarDaysBetween, startOfTodayUtc } from "@/lib/dates"
import type { InvoiceStatus } from "@/lib/invoice-types"
import type { LeaseStatus } from "@/lib/leases"
import type { PortalLease } from "@/lib/portal"
import { cn } from "@/lib/utils"

/** The same tones the landlord's lease page uses, so a status reads alike in both apps. */
const STATUS_TONE: Record<LeaseStatus, string> = {
  Active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Upcoming: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Ended: "bg-muted text-muted-foreground",
  Renewed: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
}

export function LeaseStatusPill({
  status,
  className,
}: {
  status: LeaseStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_TONE[status],
        className
      )}
    >
      {status}
    </span>
  )
}

const INVOICE_TONE: Record<InvoiceStatus, string> = {
  Paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Partial: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Unpaid: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
}

/** The invoice counterpart of `LeaseStatusPill`, same shape. */
export function InvoiceStatusPill({
  status,
  className,
}: {
  status: InvoiceStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        INVOICE_TONE[status],
        className
      )}
    >
      {status}
    </span>
  )
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

/**
 * Where today sits in a lease: how far along (0–100) and how to say it —
 * "**34 days** remaining", "**3 days** until it starts", or just "Ended".
 * Worked out on the server, like every other day count in the app.
 */
export function leaseProgress(lease: PortalLease): {
  percent: number
  /** The count with its unit ("34 days") — null once the lease is over. */
  figure: string | null
  /** The words after the figure, or the whole phrase when there is none. */
  caption: string
} {
  const today = startOfTodayUtc()
  if (lease.status === "Upcoming") {
    const days = Math.max(0, calendarDaysBetween(today, lease.startDate))
    return { percent: 0, figure: plural(days, "day"), caption: "until it starts" }
  }
  if (lease.status === "Active" && lease.daysLeft !== null) {
    const total = Math.max(1, calendarDaysBetween(lease.startDate, lease.endDate))
    const percent = Math.round(((total - lease.daysLeft) / total) * 100)
    return {
      percent: Math.min(100, Math.max(0, percent)),
      figure: plural(lease.daysLeft, "day"),
      caption: "remaining",
    }
  }
  return {
    percent: 100,
    figure: null,
    caption: lease.status === "Renewed" ? "Ended and renewed" : "Ended",
  }
}
