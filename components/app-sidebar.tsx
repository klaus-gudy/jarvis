"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavUser } from "@/components/nav-user"
import { OrgSwitcher, type OrganizationOption } from "@/components/org-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { findActiveNavItem, navItems } from "@/lib/nav"

export function AppSidebar({
  organizations,
  activeOrgId,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  organizations: OrganizationOption[]
  activeOrgId: string | null
  user: {
    name: string
    email: string
    role: string | null
    photoId: string | null
  }
}) {
  const pathname = usePathname()
  const activeItem = findActiveNavItem(pathname)
  const { isMobile, setOpenMobile } = useSidebar()

  // On mobile the sidebar is an overlay sheet; dismiss it after navigating so
  // the destination page isn't left hidden behind it.
  function handleNavigate() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrgSwitcher organizations={organizations} activeOrgId={activeOrgId} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {/* <SidebarGroupLabel>Manage</SidebarGroupLabel> */}
          <SidebarGroupContent>
            <SidebarMenu data-tour="sidebar-nav">
              {navItems.map((item) => (
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
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
