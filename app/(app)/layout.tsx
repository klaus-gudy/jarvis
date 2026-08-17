import { ViewTransition } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppHeader } from "@/components/app-header"
import { CreateOrganizationDialog } from "@/components/create-organization-dialog"
import { AppSidebar } from "@/components/app-sidebar"
import { TourProvider } from "@/components/tour/tour-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getCurrentUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { displayName, primaryContact } from "@/lib/user-display"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  // getCurrentUser has already validated activeOrgId against live memberships;
  // this query re-fetches them with org + role names for the switcher.
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { organization: true, role: true },
  })

  const membership =
    memberships.find((m) => m.organizationId === user.activeOrgId) ?? null

  const needsOrganization = memberships.length === 0

  // Restore the sidebar's collapsed state on the server so it doesn't flash
  // open before the client reads the cookie.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    // Wraps the sidebar as well as the content, because tours spotlight the
    // navigation and the header controls, not just the page body.
    <TourProvider>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar
          organizations={memberships.map((m) => ({
            id: m.organizationId,
            name: m.organization.name,
            roleName: m.role.name,
          }))}
          activeOrgId={user.activeOrgId}
          user={{
            name: displayName(user),
            email: primaryContact(user) ?? "",
            role: membership?.role.name ?? null,
          }}
        />
        <SidebarInset className="min-w-0">
          <AppHeader />
          {/*
            Only the content area animates on navigation. The sidebar and header
            sit outside this boundary, so they stay part of the untouched `root`
            snapshot and hold still — the fixed reference that makes it read as
            "the content changed", not "the whole app moved".

            `default` names the class for every case (enter, exit, update); a
            navigation within this layout is an *update*, since the boundary
            itself survives and only its children swap. Styled in globals.css.
          */}
          <ViewTransition default="page">
            <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
          </ViewTransition>
        </SidebarInset>
        {needsOrganization && (
          <CreateOrganizationDialog userName={displayName(user)} />
        )}
      </SidebarProvider>
    </TourProvider>
  )
}
