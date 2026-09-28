import { DaysLeftCard, OutstandingCard, PropertyCard } from "@/components/portal/home-metrics"
import { BillsPanel, QuickActions, RecentPaymentsPanel } from "@/components/portal/home-panels"
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

      {/* Every card fills its share of the row, like the landlord dashboard's
          panels: the stacked lists split the column's height, and Quick
          actions stretches to match them — so the row's bottom edges line up
          whichever side has more in it. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <BillsPanel leases={leases} className="flex-1" />
          <RecentPaymentsPanel leases={leases} className="flex-1" />
        </div>
        <div className="flex flex-col">
          <QuickActions
            member={member}
            lease={lease}
            leases={leases}
            className="flex-1"
          />
        </div>
      </div>
    </>
  )
}
