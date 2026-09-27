import { LeaseListCard } from "@/components/portal/lease-list-card"
import { PortalNoLeases, PortalNoOrganization } from "@/components/portal/portal-states"
import { requireTenantPage } from "@/lib/authz"
import type { LeaseStatus } from "@/lib/leases"
import { getPortalLeases } from "@/lib/portal"

export const metadata = { title: "My lease" }

/** Running first, then the next to start, then the finished ones. */
const STATUS_ORDER: Record<LeaseStatus, number> = {
  Active: 0,
  Upcoming: 1,
  Renewed: 2,
  Ended: 2,
}

/**
 * Every lease the tenant holds here, as a grid of cards like the landlord's
 * Properties page. Each opens its own detail page.
 */
export default async function PortalLeasesPage() {
  const access = await requireTenantPage()
  if (!access) return <PortalNoOrganization />

  const leases = await getPortalLeases(access)
  if (leases.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <PortalNoLeases />
      </div>
    )
  }

  // Stable sort over the newest-first list, so each group stays newest first.
  const sorted = [...leases].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  )
  const running = leases.filter(
    (l) => l.status === "Active" || l.status === "Upcoming"
  ).length

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Your leases</h2>
        <p className="text-sm text-muted-foreground">
          {running > 0
            ? `${running} running · ${leases.length - running} past`
            : `${leases.length} past ${leases.length === 1 ? "lease" : "leases"}`}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((lease) => (
          <LeaseListCard key={lease.id} lease={lease} />
        ))}
      </div>
    </div>
  )
}
