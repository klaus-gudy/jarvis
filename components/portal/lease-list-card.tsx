import Link from "next/link"
import { ChevronRightIcon, FileTextIcon, MapPinIcon } from "lucide-react"

import { leaseProgress, LeaseStatusPill, plural } from "@/components/portal/lease-status"
import { Card } from "@/components/ui/card"
import { formatCurrencyFull, formatDate } from "@/lib/format"
import type { PortalLease } from "@/lib/portal"
import { cn } from "@/lib/utils"

/**
 * One lease in the My lease grid — the same card shape as a property on the
 * landlord's Properties page: icon and status on top, name and place, a bar,
 * then a one-line footer with the term, rate and total. The whole card opens the lease.
 */
export function LeaseListCard({ lease }: { lease: PortalLease }) {
  const progress = leaseProgress(lease)
  const running = lease.status === "Active" || lease.status === "Upcoming"
  const warn = lease.expiry?.tier === "urgent" && !lease.autoRenew

  return (
    <Card
      className={cn(
        "gap-0 p-0 transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring",
        !running && "opacity-90"
      )}
    >
      <Link href={`/portal/lease/${lease.id}`} className="block outline-none">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileTextIcon className="size-4.5" aria-hidden />
            </div>
            <LeaseStatusPill status={lease.status} />
          </div>

          <div className="mt-3 space-y-0.5">
            <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
              Lease {lease.reference}
            </p>
            <h3 className="font-semibold tracking-tight">
              {lease.propertyName} · Unit {lease.unitLabel}
            </h3>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{lease.home.address}</span>
            </p>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground tabular-nums">
                {formatDate(lease.startDate)} – {formatDate(lease.endDate)}
              </span>
              <span
                className={cn(
                  "shrink-0 font-medium tabular-nums",
                  warn ? "text-stat-accent" : "text-foreground"
                )}
              >
                {progress.figure ? `${progress.figure} ${progress.caption}` : progress.caption}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${lease.reference} progress`}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  running ? "bg-stat-accent" : "bg-muted-foreground/40"
                )}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* One small line: the term at its rate, and what that comes to. The
            balance lives on the invoice, not here. */}
        <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs">
          <p className="min-w-0 truncate text-muted-foreground tabular-nums">
            {plural(lease.durationMonths, "month")} @ {formatCurrencyFull(lease.monthlyRent)}
            <span className="mx-1.5">·</span>
            Total{" "}
            <span className="font-medium text-foreground">
              {formatCurrencyFull(lease.leaseAmount)}
            </span>
          </p>
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
      </Link>
    </Card>
  )
}
