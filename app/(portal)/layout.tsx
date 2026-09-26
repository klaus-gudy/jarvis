import { PortalHeader } from "@/components/portal/portal-header"
import { requireTenantPage } from "@/lib/authz"
import { prisma } from "@/lib/prisma"

/**
 * The tenant portal. Its own route group and layout, so nothing from the staff
 * app — sidebar, search, tours — is ever rendered for a tenant. Staff who land
 * here are sent back to `/dashboard` by `requireTenantPage`.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const access = await requireTenantPage()
  if (!access) return <main className="p-4">{children}</main>

  const memberships = await prisma.membership.findMany({
    where: { userId: access.userId },
    orderBy: { createdAt: "asc" },
    select: { organization: { select: { id: true, name: true } } },
  })

  return (
    <div className="min-h-dvh bg-background">
      <PortalHeader
        organizations={memberships.map((m) => m.organization)}
        activeOrgId={access.organizationId}
      />
      <main className="mx-auto max-w-4xl space-y-6 p-4">{children}</main>
    </div>
  )
}
