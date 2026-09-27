import { FileTextIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { FilterPills, parseFilter } from "@/components/portal/filter-pills"
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

const FILTERS = [
  { label: "All leases", value: undefined },
  { label: "Active", value: "active" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Past", value: "past" },
] as const

function matches(status: LeaseStatus, filter: string | undefined) {
  if (filter === "active") return status === "Active"
  if (filter === "upcoming") return status === "Upcoming"
  if (filter === "past") return status === "Ended" || status === "Renewed"
  return true
}

/**
 * Every lease the tenant holds here, as a grid of cards under the same filter
 * pills as the landlord's Properties page. Each opens its own detail page.
 */
export default async function PortalLeasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
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

  const active = parseFilter(FILTERS, (await searchParams).status)
  // Stable sort over the newest-first list, so each group stays newest first.
  const sorted = leases
    .filter((l) => matches(l.status, active))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

  return (
    <div className="flex flex-col gap-6">
      <FilterPills basePath="/portal/lease" filters={FILTERS} active={active} />
      {sorted.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="No matching leases"
          description="No leases with this status. Try a different filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((lease) => (
            <LeaseListCard key={lease.id} lease={lease} />
          ))}
        </div>
      )}
    </div>
  )
}
