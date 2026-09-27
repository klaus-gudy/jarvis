import Link from "next/link"
import {
  FileTextIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  WalletIcon,
} from "lucide-react"

import { leaseProgress, LeaseStatusPill, plural } from "@/components/portal/lease-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrencyFull, formatDate } from "@/lib/format"
import { INVOICE_STATUS_VARIANT } from "@/lib/invoice-types"
import { toInternationalTzPhone } from "@/lib/phone"
import type { PortalLandlord, PortalLease } from "@/lib/portal"
import { cn } from "@/lib/utils"

/**
 * The lease detail page's cards. Main column: the lease itself (figures, then
 * the terms in plain words) and its rent. Side column: the term with its
 * actions, and who to call. Server components — nothing here changes state.
 */

function contractHref(lease: PortalLease) {
  return lease.contract ? `/api/portal/documents/${lease.contract.id}` : null
}

/** The staff detail pages' header card, tenant-side. */
export function LeaseHeaderCard({ lease }: { lease: PortalLease }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileTextIcon className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              Lease {lease.reference}
            </h2>
            <LeaseStatusPill status={lease.status} />
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {lease.propertyName} · Unit {lease.unitLabel} · {lease.home.address}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------------- main -- */

/** Figures in two ruled rows of four (two across on a phone). */
export function LeaseDetailsCard({ lease }: { lease: PortalLease }) {
  const { home, invoice } = lease
  const unit = [home.unitType, home.sizeSqm ? `${home.sizeSqm} m²` : null]
    .filter(Boolean)
    .join(" · ")

  return (
    <Card className="gap-0 p-0 shadow-sm">
      {/* The header card above already names the lease and the place. */}
      <div className="p-5 sm:p-6">
        <h3 className="text-lg font-semibold tracking-tight">Lease details</h3>
      </div>

      <FactRow>
        <Fact label="Monthly rent" value={formatCurrencyFull(lease.monthlyRent)} />
        <Fact label="Lease total" value={formatCurrencyFull(lease.leaseAmount)} />
        <Fact label="Start date" value={formatDate(lease.startDate)} />
        <Fact label="End date" value={formatDate(lease.endDate)} />
      </FactRow>
      <FactRow>
        <Fact
          label="Rent due"
          value={invoice ? formatDate(invoice.dueDate) : "Not invoiced yet"}
        />
        <Fact label="Unit" value={unit || "—"} />
        <Fact label="Term" value={plural(lease.durationMonths, "month")} />
        <Fact
          label="Renewal"
          value={
            lease.autoRenew && lease.renewalMonths
              ? `Automatic · ${plural(lease.renewalMonths, "month")}`
              : "Not automatic"
          }
        />
      </FactRow>

    </Card>
  )
}

function FactRow({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-5 border-t p-5 sm:p-6 lg:grid-cols-4">
      {children}
    </dl>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium tabular-nums sm:text-base">{value}</dd>
    </div>
  )
}

/** Paid against the total, what that means in months, and the payments. */
export function LeaseRentCard({ lease }: { lease: PortalLease }) {
  const invoice = lease.invoice

  return (
    <Card className="gap-0 p-0 shadow-sm">
      <div className="flex items-center justify-between gap-3 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <WalletIcon className="size-4 text-muted-foreground" aria-hidden />
          Rent & payments
        </h3>
        {invoice && (
          <Badge variant={INVOICE_STATUS_VARIANT[invoice.status]} className="rounded-full">
            {invoice.status}
          </Badge>
        )}
      </div>

      {!invoice ? (
        <p className="border-t p-5 text-sm text-muted-foreground sm:p-6">
          No invoice has been issued for this lease yet.
        </p>
      ) : (
        <>
          <div className="space-y-4 border-t p-5 sm:p-6">
            <RentBar paid={invoice.paid} amount={invoice.amount} />
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <SummaryPill label="Balance" value={formatCurrencyFull(invoice.balance)} />
              {invoice.coverage.amountBehind > 0 ? (
                <SummaryPill
                  label="Behind"
                  value={`${plural(invoice.coverage.monthsBehind, "month")} · ${formatCurrencyFull(invoice.coverage.amountBehind)}`}
                  warn
                />
              ) : (
                <SummaryPill
                  label="Covered until"
                  value={
                    invoice.balance === 0
                      ? "End of lease"
                      : formatDate(invoice.coverage.coveredUntil)
                  }
                />
              )}
            </div>
          </div>

          <div className="border-t">
            {invoice.payments.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground sm:px-6">
                No payments recorded yet.
              </p>
            ) : (
              <ul className="divide-y">
                {invoice.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium tabular-nums">
                        {formatDate(payment.paidAt)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {payment.method ?? "Payment"}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatCurrencyFull(payment.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

function RentBar({ paid, amount }: { paid: number; amount: number }) {
  const percent = amount > 0 ? Math.round((paid / amount) * 100) : 100
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>
          <span className="font-semibold tabular-nums">{formatCurrencyFull(paid)}</span>
          <span className="text-muted-foreground"> paid of {formatCurrencyFull(amount)}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
          {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full animate-bar-grow rounded-full bg-primary"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  )
}

function SummaryPill({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
        warn && "border-stat-accent/40 bg-stat-accent/5"
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-semibold tabular-nums", warn && "text-stat-accent")}>
        {value}
      </span>
    </div>
  )
}

/* ---------------------------------------------------------------- side -- */

/** Start → end, how much is left, and the two things to do with a lease. */
export function LeaseTermCard({ lease }: { lease: PortalLease }) {
  const progress = leaseProgress(lease)
  const contract = contractHref(lease)
  const running = lease.status === "Active" || lease.status === "Upcoming"
  const warn = lease.expiry?.tier === "urgent" && !lease.autoRenew

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-5">
        <h3 className="text-lg font-semibold tracking-tight">Lease term</h3>

        <div className="space-y-2.5">
          <div className="flex justify-between gap-3 text-sm text-muted-foreground tabular-nums">
            <span>{formatDate(lease.startDate)}</span>
            <span>{formatDate(lease.endDate)}</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Share of the lease that has passed"
          >
            <div
              className={cn(
                "h-full animate-bar-grow rounded-full",
                running ? "bg-stat-accent" : "bg-muted-foreground/40"
              )}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="text-sm">
            {progress.figure ? (
              <>
                <span className={cn("font-semibold tabular-nums", warn && "text-stat-accent")}>
                  {progress.figure}
                </span>{" "}
                <span className="text-muted-foreground">{progress.caption}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{progress.caption}</span>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {contract ? (
            <Button
              size="lg"
              className="w-full"
              nativeButton={false}
              render={<a href={contract} target="_blank" rel="noreferrer" />}
            >
              <FileTextIcon />
              View contract
            </Button>
          ) : (
            <Button size="lg" className="w-full" disabled>
              <FileTextIcon />
              Contract pending
            </Button>
          )}
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            nativeButton={false}
            render={<Link href="/portal/payments" />}
          >
            <WalletIcon />
            Payments
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** Who to call about this lease — the organization's owner. */
export function LandlordContactCard({ landlord }: { landlord: PortalLandlord }) {
  const name = landlord.name ?? landlord.organizationName
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
  const whatsapp = landlord.phone ? toInternationalTzPhone(landlord.phone) : null

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-5">
        <h3 className="text-lg font-semibold tracking-tight">Your landlord</h3>

        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
            {initials || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-sm text-muted-foreground">
              Landlord · {landlord.organizationName}
            </p>
          </div>
        </div>

        <ul className="space-y-1 text-sm">
          {landlord.phone && (
            <ContactRow href={`tel:${landlord.phone}`} icon={PhoneIcon}>
              {landlord.phone}
            </ContactRow>
          )}
          {whatsapp && (
            <ContactRow href={`https://wa.me/${whatsapp}`} icon={MessageCircleIcon} external>
              Message on WhatsApp
            </ContactRow>
          )}
          {landlord.email && (
            <ContactRow href={`mailto:${landlord.email}`} icon={MailIcon}>
              {landlord.email}
            </ContactRow>
          )}
          {!landlord.phone && !landlord.email && (
            <li className="text-muted-foreground">No contact details on file.</li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}

function ContactRow({
  href,
  icon: Icon,
  external = false,
  children,
}: {
  href: string
  icon: typeof PhoneIcon
  external?: boolean
  children: React.ReactNode
}) {
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{children}</span>
      </a>
    </li>
  )
}
