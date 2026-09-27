import { Building2Icon, CalendarClockIcon, WalletIcon } from "lucide-react"

import { MetricCard } from "@/components/dashboard/metric-card"
import { calendarDaysBetween, startOfTodayUtc } from "@/lib/dates"
import { formatCurrencyFull, formatDate } from "@/lib/format"
import type { PortalLandlord, PortalLease } from "@/lib/portal"

function months(n: number) {
  return `${n} month${n === 1 ? "" : "s"}`
}

/**
 * The first three cards of the tenant Home's top row, all about the current
 * lease — the fourth, how to pay, is interactive and lives in
 * `PayAccountsCard`. Built from the landlord dashboard's `MetricCard` so both
 * apps share one look; the money card is the filled lead.
 */

/** What's still owed on the current lease, with its Paid / Partial / Unpaid state. */
export function OutstandingCard({ lease }: { lease: PortalLease | null }) {
  if (!lease?.invoice) {
    return (
      <MetricCard
        icon={WalletIcon}
        variant="filled"
        value="No invoice yet"
        label="Outstanding rent"
        href="/portal/payments"
      />
    )
  }

  const { invoice } = lease
  const { coverage } = invoice
  const footer =
    coverage.amountBehind > 0
      ? `${months(coverage.monthsBehind)} behind · ${formatCurrencyFull(coverage.amountBehind)}`
      : invoice.balance === 0
        ? "The whole lease is paid"
        : `Rent covered until ${formatDate(coverage.coveredUntil)}`

  return (
    <MetricCard
      icon={WalletIcon}
      variant="filled"
      value={formatCurrencyFull(invoice.balance)}
      label={`Outstanding · ${invoice.reference}`}
      href="/portal/payments"
      badge={invoice.status}
      progress={invoice.amount > 0 ? Math.round((invoice.paid / invoice.amount) * 100) : 100}
      footer={footer}
      stats={[
        { label: "Lease started", value: formatDate(lease.startDate) },
        { label: "Lease ends", value: formatDate(lease.endDate) },
      ]}
    />
  )
}

/** Where the tenant lives and who owns it — a summary, details on My lease. */
export function PropertyCard({
  lease,
  landlord,
}: {
  lease: PortalLease | null
  landlord: PortalLandlord
}) {
  if (!lease) {
    return <MetricCard icon={Building2Icon} value="No property" label="Your home" />
  }

  return (
    <MetricCard
      icon={Building2Icon}
      value={lease.propertyName}
      label={[`Unit ${lease.unitLabel}`, lease.home.unitType].filter(Boolean).join(" · ")}
      href="/portal/lease"
      stats={[
        { label: "Owner", value: landlord.name ?? landlord.organizationName },
        { label: "Location", value: lease.home.address },
      ]}
    />
  )
}

/** The countdown: to the end of a running lease, or to the start of one ahead. */
export function DaysLeftCard({ lease }: { lease: PortalLease | null }) {
  if (!lease) {
    return <MetricCard icon={CalendarClockIcon} value="No lease" label="Lease countdown" />
  }

  const today = startOfTodayUtc()
  const renewal = {
    label: "Renewal",
    value:
      lease.autoRenew && lease.renewalMonths
        ? `Automatic · ${months(lease.renewalMonths)}`
        : "Not automatic",
  }

  if (lease.status === "Upcoming") {
    const days = Math.max(0, calendarDaysBetween(today, lease.startDate))
    return (
      <MetricCard
        icon={CalendarClockIcon}
        value={days}
        label={`day${days === 1 ? "" : "s"} until your lease starts`}
        href="/portal/lease"
        stats={[{ label: "Starts on", value: formatDate(lease.startDate) }, renewal]}
      />
    )
  }

  if (lease.status !== "Active" || lease.daysLeft === null) {
    return (
      <MetricCard
        icon={CalendarClockIcon}
        value={lease.status}
        label="This lease is no longer running"
        href="/portal/lease"
        stats={[{ label: "Ended on", value: formatDate(lease.endDate) }, renewal]}
      />
    )
  }

  const total = Math.max(1, calendarDaysBetween(lease.startDate, lease.endDate))
  const elapsed = Math.round(((total - lease.daysLeft) / total) * 100)
  // Ending soon with nobody renewing it is the one case worth the gold.
  const warn = lease.expiry?.tier === "urgent" && !lease.autoRenew

  return (
    <MetricCard
      icon={CalendarClockIcon}
      value={lease.daysLeft}
      label={`day${lease.daysLeft === 1 ? "" : "s"} until your lease ends`}
      href="/portal/lease"
      badge={lease.expiry ? "Ending soon" : undefined}
      progress={elapsed}
      footer={`${elapsed}% of the lease has passed`}
      stats={[
        {
          label: "Ends on",
          value: formatDate(lease.endDate),
          tone: warn ? "accent" : "default",
        },
        renewal,
      ]}
    />
  )
}
