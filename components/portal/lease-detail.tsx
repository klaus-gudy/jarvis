import Link from "next/link"
import {
  FileTextIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  WalletIcon,
} from "lucide-react"

import { leaseProgress, LeaseStatusPill } from "@/components/portal/lease-status"
import { PortalDocumentViewer } from "@/components/portal/portal-document-viewer"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import { toInternationalTzPhone } from "@/lib/phone"
import type { PortalLandlord, PortalLease } from "@/lib/portal"
import { cn } from "@/lib/utils"

/**
 * The tenant's lease page cards. The main column uses the landlord's shared
 * `LeaseTermsCard` and `InvoiceCard`; these are the header and the side column
 * (the term with its actions, and who to call). Server components — nothing here changes state.
 */

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
          <p className="text-sm text-muted-foreground sm:truncate">
            {lease.propertyName} · Unit {lease.unitLabel} · {lease.home.address}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------------------------------------------------------------- side -- */

/** Start → end, how much is left, and the two things to do with a lease. */
export function LeaseTermCard({ lease }: { lease: PortalLease }) {
  const progress = leaseProgress(lease)
  const running = lease.status === "Active" || lease.status === "Upcoming"
  const warn = lease.expiry?.tier === "urgent" && !lease.autoRenew

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base">Lease progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

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
          {lease.contract ? (
            <PortalDocumentViewer
              document={{ ...lease.contract, label: "Lease contract" }}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              <FileTextIcon />
              View contract
            </PortalDocumentViewer>
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
