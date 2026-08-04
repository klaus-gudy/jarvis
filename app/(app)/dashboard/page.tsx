import { redirect } from "next/navigation"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const orgId = user.activeOrgId

  const [properties, units, leases, members] = orgId
    ? await Promise.all([
        prisma.property.count({ where: { organizationId: orgId } }),
        prisma.unit.count({ where: { property: { organizationId: orgId } } }),
        prisma.lease.count({
          // "Active" is a date range now that every lease is fixed-term; the
          // old `endDate: null` proxy would count nothing.
          where: {
            membership: { organizationId: orgId },
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
        }),
        prisma.membership.count({ where: { organizationId: orgId } }),
      ])
    : [0, 0, 0, 0]

  const stats = [
    { label: "Properties", value: properties },
    { label: "Units", value: units },
    { label: "Active leases", value: leases },
    { label: "Members", value: members },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader>
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{stat.value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
