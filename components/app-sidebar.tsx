"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRightIcon } from "lucide-react"

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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { findActiveNavItem, findActiveSubItem, navItems, type NavItem } from "@/lib/nav"

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
  const activeSubItem = findActiveSubItem(pathname)
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
              {navItems.map((item) =>
                item.items?.length ? (
                  <NavGroup
                    key={item.url}
                    item={item}
                    isActive={item.url === activeItem?.url}
                    activeSubItemUrl={activeSubItem?.url}
                    onNavigate={handleNavigate}
                  />
                ) : (
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
                )
              )}
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

/**
 * A nav item with children. The parent is a disclosure, not a link — it owns no
 * page, so clicking it opens the submenu rather than navigating somewhere that
 * immediately redirects.
 *
 * Collapsed to icons, the submenu is hidden by the sidebar's own CSS, which
 * would make the parent inert; so a click there expands the sidebar first. That
 * keeps one interaction ("click Settings, see what's under it") true in both
 * states instead of two rules to learn.
 */
function NavGroup({
  item,
  isActive,
  activeSubItemUrl,
  onNavigate,
}: {
  item: NavItem
  isActive: boolean
  activeSubItemUrl: string | undefined
  onNavigate: () => void
}) {
  const { state, setOpen, isMobile } = useSidebar()
  // Starts open when you are already inside it, so arriving on a child page by
  // any route (a link, a refresh, the back button) shows where you are.
  const [open, setOpenGroup] = React.useState(isActive)

  function handleClick() {
    if (!isMobile && state === "collapsed") {
      setOpen(true)
      setOpenGroup(true)
      return
    }
    setOpenGroup((current) => !current)
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="h-10"
        isActive={isActive}
        tooltip={item.title}
        onClick={handleClick}
        aria-expanded={open}
      >
        <item.icon />
        <span>{item.title}</span>
        <ChevronRightIcon
          className={`ml-auto transition-transform duration-200 group-data-[collapsible=icon]:hidden ${
            open ? "rotate-90" : ""
          }`}
        />
      </SidebarMenuButton>

      {open && (
        <SidebarMenuSub>
          {item.items?.map((child) => (
            <SidebarMenuSubItem key={child.url}>
              <SidebarMenuSubButton
                isActive={child.url === activeSubItemUrl}
                onClick={onNavigate}
                render={<Link href={child.url} />}
              >
                <child.icon />
                <span>{child.title}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}
