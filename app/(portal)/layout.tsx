import { ViewTransition } from "react"
import { cookies } from "next/headers"

import { PermissionsProvider } from "@/components/permissions-provider"
import { PortalHeader } from "@/components/portal/portal-header"
import { PortalSidebar } from "@/components/portal/portal-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireTenantPage } from "@/lib/authz"
import { getProfilePhotoIds } from "@/lib/documents"
import { firstAllowedPath } from "@/lib/nav"
import { prisma } from "@/lib/prisma"
import { displayName, primaryContact } from "@/lib/user-display"

/**
 * The tenant portal. Its own route group and layout, so nothing from the staff
 * app — search, tours, staff navigation — is ever rendered for a tenant. It
 * borrows the staff app's sidebar shell with the portal's own menu. Staff who
 * land here are sent back to `/dashboard` by `requireTenantPage`.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const access = await requireTenantPage()
  if (!access) return <main className="p-4">{children}</main>

  const [memberships, user, photoIds] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: access.userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        organization: { select: { id: true, name: true } },
        role: { select: { name: true } },
      },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: access.userId },
      select: { name: true, email: true, phone: true },
    }),
    getProfilePhotoIds(access.organizationId, [access.membershipId]),
  ])

  const active = memberships.find((m) => m.id === access.membershipId)
  // Restore the sidebar's collapsed state on the server so it doesn't flash
  // open before the client reads the cookie (same cookie as the staff app).
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    // `NavUser` reads the viewer from here; nothing in the portal is gated on it.
    <PermissionsProvider kind={access.kind} permissions={[...access.permissions]}>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <PortalSidebar
          organizations={memberships.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            roleName: m.role.name,
          }))}
          activeOrgId={access.organizationId}
          user={{
            name: displayName(user),
            email: primaryContact(user) ?? "",
            role: active?.role.name ?? null,
            photoId: photoIds.get(access.membershipId) ?? null,
          }}
          staffHref={firstAllowedPath(access)}
        />
        <SidebarInset className="min-w-0">
          <PortalHeader />
          <ViewTransition default="page">
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
              {children}
            </div>
          </ViewTransition>
        </SidebarInset>
      </SidebarProvider>
    </PermissionsProvider>
  )
}
