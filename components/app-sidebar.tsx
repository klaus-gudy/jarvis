"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavUser } from "@/components/nav-user"
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
import { RentopsLogo } from "@/components/logo"
import { findActiveNavItem, navItems } from "@/lib/nav"

export function AppSidebar({
  organizationName,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  organizationName: string
  user: { name: string; email: string; role: string | null }
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-12 px-3"
              tooltip={organizationName}
              onClick={handleNavigate}
              render={<Link href="/dashboard" />}
            >
              {/* size-8! beats the sidebar's `[&_svg]:size-4`, which would
                  otherwise clamp the mark to icon size. */}
              <RentopsLogo className="size-8!" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{organizationName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  Property management
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {/* <SidebarGroupLabel>Manage</SidebarGroupLabel> */}
          <SidebarGroupContent>
            <SidebarMenu>
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
