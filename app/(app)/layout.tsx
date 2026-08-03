import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppHeader } from "@/components/app-header"
import { CreateOrganizationDialog } from "@/components/create-organization-dialog"
import { AppSidebar } from "@/components/app-sidebar"
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

  // Read real memberships rather than trusting the session: activeOrgId can be
  // stale if the organization was deleted while the user was signed in.
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { organization: true, role: true },
  })

  const membership =
    memberships.find((m) => m.organizationId === user.activeOrgId) ??
    memberships[0] ??
    null

  const needsOrganization = memberships.length === 0

  // Restore the sidebar's collapsed state on the server so it doesn't flash
  // open before the client reads the cookie.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        organizationName={membership?.organization.name ?? "Jarvis"}
        user={{
          name: displayName(user),
          email: primaryContact(user) ?? "",
          role: membership?.role.name ?? null,
        }}
      />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
      {needsOrganization && (
        <CreateOrganizationDialog userName={displayName(user)} />
      )}
    </SidebarProvider>
  )
}
