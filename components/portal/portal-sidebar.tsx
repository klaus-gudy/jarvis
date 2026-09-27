"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BriefcaseIcon } from "lucide-react"

import { NavUser } from "@/components/nav-user"
import { OrgSwitcher, type OrganizationOption } from "@/components/org-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { findActivePortalItem, portalNavItems } from "@/lib/portal-nav"

/**
 * The tenant's menu. The same `Sidebar` the staff app uses — icon rail on
 * desktop, a sheet on phones — with the portal's own five entries.
 */
export function PortalSidebar({
  organizations,
  activeOrgId,
  user,
  staffHref,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  organizations: OrganizationOption[]
  activeOrgId: string
  user: {
    name: string
    email: string
    role: string | null
    photoId: string | null
  }
  /** First staff page the tenant's role opens, if it opens any. */
  staffHref: string | null
}) {
  const pathname = usePathname()
  const activeItem = findActivePortalItem(pathname)
  const { isMobile, setOpenMobile } = useSidebar()

  // On mobile the sidebar is an overlay sheet; dismiss it after navigating so
  // the destination page isn't left hidden behind it.
  function handleNavigate() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrgSwitcher
          organizations={organizations}
          activeOrgId={activeOrgId}
          homeHref="/portal"
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {portalNavItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    className="h-10"
                    isActive={item.url === activeItem?.url}
                    tooltip={item.title}
                    onClick={handleNavigate}
                    render={<Link href={item.url} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {staffHref && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="h-10"
                    tooltip="Staff app"
                    onClick={handleNavigate}
                    render={<Link href={staffHref} />}
                  >
                    <BriefcaseIcon />
                    <span>Staff app</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} inPortal />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
