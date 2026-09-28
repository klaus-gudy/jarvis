import { DaysLeftCard, OutstandingCard, PropertyCard } from "@/components/portal/home-metrics"
import { BillsPanel, QuickActions } from "@/components/portal/home-panels"
import { PayAccountsCard } from "@/components/portal/pay-accounts-card"
import { PortalNoOrganization, PortalNotFound } from "@/components/portal/portal-states"
import { requireTenantPage } from "@/lib/authz"
import { getPortalLandlord, getPortalLeases, getPortalMember, liveLeases } from "@/lib/portal"

export const metadata = { title: "My tenancy" }

/**
 * The tenant's dashboard. Same shape as the landlord's: a row of four cards
 * about the current lease (what's owed, where, how long, how to pay), then the
 * lists — bills and payments — beside quick actions ordered by what needs
 * doing.
 */
export default async function PortalHomePage() {
  const access = await requireTenantPage()
  if (!access) return <PortalNoOrganization />

  const [member, leases, landlord] = await Promise.all([
    getPortalMember(access),
    getPortalLeases(access),
    getPortalLandlord(access),
  ])
  if (!member) return <PortalNotFound />

  const firstName = member.name?.trim().split(/\s+/)[0] ?? null
  // The running lease leads; failing that the next to start, then the latest.
  const live = liveLeases(leases)
  const lease = live.find((l) => l.status === "Active") ?? live[0] ?? null

  return (
    <>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Hello, ${firstName}` : "Welcome"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {lease
            ? `Your home at ${lease.propertyName} · ${lease.unitLabel}, with ${member.organizationName}.`
            : `Your tenancy with ${member.organizationName}. Your lease will appear here once your landlord adds it.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OutstandingCard lease={lease} />
        <PropertyCard lease={lease} landlord={landlord} />
        <DaysLeftCard lease={lease} />
        <PayAccountsCard
          accounts={landlord.paymentAccounts}
          reference={lease?.reference ?? null}
        />
      </div>

      {/* Quick actions comes first in the markup so it leads on a phone, like
          the landlord dashboard; from `lg` it moves to the right-hand column.
          Both are direct grid items, so the grid stretches them to one height
          and their bottom edges line up. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <QuickActions
          member={member}
          lease={lease}
          leases={leases}
          className="lg:order-last"
        />
        <BillsPanel leases={leases} className="lg:col-span-2" />
      </div>
    </>
  )
}
