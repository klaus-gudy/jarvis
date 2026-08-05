import { redirect } from "next/navigation"
import {
  BuildingIcon,
  FileTextIcon,
  TrendingDownIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import { MetricCard } from "@/components/dashboard/metric-card"
import {
  ActivityPanel,
  MoveInsPanel,
  NeedsInvitePanel,
  OccupancyPanel,
  RenewalsPanel,
  VacantUnitsPanel,
} from "@/components/dashboard/panels"
import { getCurrentUser } from "@/lib/auth/session"
import { getDashboardStats, getDashboardPanels } from "@/lib/dashboard"
import { formatCurrency, formatCurrencyFull } from "@/lib/format"
import { getProperties } from "@/lib/properties"

/** "Good morning" until noon, "Good afternoon" until 17:00, then "Good evening". */
function greeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const orgId = user.activeOrgId ?? null
  const [stats, panels, properties] = await Promise.all([
    getDashboardStats(orgId),
    getDashboardPanels(orgId),
    orgId ? getProperties(orgId) : Promise.resolve([]),
  ])

  // Worst first: the point of the breakdown is to find what drags the average.
  const byOccupancy = [...properties].sort(
    (a, b) => a.occupancyRate - b.occupancyRate
  )

  const now = new Date()
  // First name only — the greeting reads as an address, not a record.
  const firstName = user.name?.trim().split(/\s+/)[0] ?? null

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(now)}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting(now.getHours())}
          {firstName ? `, ${firstName}` : ""}
        </h2>
        <p className="text-sm text-muted-foreground">
          Here&apos;s how your portfolio is performing this month.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          variant="filled"
          href="/leases"
          icon={WalletIcon}
          value={formatCurrencyFull(stats.rent.collected)}
          label={`Rent collected · est. ${formatCurrency(stats.rent.expectedYear)}/yr`}
          badge={`${stats.rent.collectedPercent}%`}
          progress={stats.rent.collectedPercent}
          // Spells out where the yearly expectation comes from, so the
          // percentage isn't a number without a basis.
          footer={`${formatCurrency(stats.rent.expectedMonthly)}/mo across ${
            stats.properties.totalUnits
          } ${stats.properties.totalUnits === 1 ? "unit" : "units"}`}
        />

        <MetricCard
          href="/properties"
          icon={BuildingIcon}
          value={stats.properties.total}
          label={`Properties · ${stats.properties.occupancyRate}% occupied`}
          stats={[
            { label: "Occupied units", value: stats.properties.occupiedUnits },
            {
              label: "Vacant units",
              value: stats.properties.vacantUnits,
              tone: "accent",
            },
          ]}
        />

        <MetricCard
          href="/tenants"
          icon={UsersIcon}
          value={stats.tenants.total}
          label="Tenants"
          stats={[
            {
              label: "Prospective",
              value: stats.tenants.prospect,
              tone: "accent",
            },
            { label: "Active", value: stats.tenants.active },
          ]}
        />

        <MetricCard
          href="/leases"
          icon={FileTextIcon}
          value={stats.leases.total}
          label="Leases"
          stats={[
            { label: "Active", value: stats.leases.active },
            {
              // The 60-day window is a detail of getDashboardStats, not
              // something the card needs to spell out.
              label: "Expiring soon",
              value: stats.leases.expiringSoon,
              tone: "accent",
            },
          ]}
        />

        <MetricCard
          href="/properties"
          icon={TrendingDownIcon}
          value={formatCurrencyFull(stats.vacancy.lossMonthly)}
          label={`Vacancy loss · ${formatCurrency(stats.vacancy.lossYear)}/yr`}
          stats={[
            {
              label: "Empty units",
              value: stats.properties.vacantUnits,
              tone: "accent",
            },
            { label: "of asking rent", value: `${stats.vacancy.lossPercent}%` },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <RenewalsPanel renewals={panels.renewals} />
        <OccupancyPanel properties={byOccupancy} />
        <VacantUnitsPanel units={panels.vacantUnits} />
        <MoveInsPanel moveIns={panels.moveIns} />
        <NeedsInvitePanel members={panels.needsInvite} />
        <ActivityPanel activity={panels.activity} />
      </div>
    </div>
  )
}
