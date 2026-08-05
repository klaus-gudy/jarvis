"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { RentopsLogo } from "@/components/logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type OrganizationOption = {
  id: string
  name: string
  roleName: string
}

/**
 * The sidebar's identity block. With one organization it stays what it always
 * was — a link home. With several it becomes a menu that re-points the session
 * at another org and lands on /dashboard, because any detail page from the
 * old org would 404 under the new one.
 */
export function OrgSwitcher({
  organizations,
  activeOrgId,
}: {
  organizations: OrganizationOption[]
  activeOrgId: string | null
}) {
  const router = useRouter()
  const { isMobile, setOpenMobile } = useSidebar()
  // Two pending phases: `switching` covers the fetch, `isPending` covers the
  // navigation. The sidebar lives in the persistent layout and never remounts,
  // so a flag we set must also be one React clears — useTransition's isPending
  // resets itself when the refresh lands, where a manual "hold until unmount"
  // would hold forever and leave the switcher dead after its first use.
  const [switching, setSwitching] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const pending = switching || isPending

  const active =
    organizations.find((org) => org.id === activeOrgId) ??
    organizations[0] ??
    null

  async function handleSwitch(org: OrganizationOption) {
    if (org.id === active?.id || pending) return
    setSwitching(true)

    const response = await fetch("/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: org.id }),
    })

    if (isMobile) setOpenMobile(false)

    if (response.ok) {
      // isPending keeps the menu disabled from here until the new org's data
      // has replaced the tree, then clears on its own.
      startTransition(() => {
        router.push("/dashboard")
        router.refresh()
      })
      setSwitching(false)
      return
    }

    // Membership disappeared between render and click; refresh to drop the
    // stale entry from the list.
    setSwitching(false)
    startTransition(() => {
      router.refresh()
    })
  }

  const identity = (
    <>
      {/* size-8! beats the sidebar's `[&_svg]:size-4`, which would otherwise
          clamp the mark to icon size. */}
      <RentopsLogo className="size-8!" />
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">
          {active?.name ?? "Rentops"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          Property management
        </span>
      </div>
    </>
  )

  // One organization: no menu to offer, keep the block as a plain link home.
  if (organizations.length <= 1) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="h-12 px-3"
            tooltip={active?.name ?? "Rentops"}
            onClick={() => {
              if (isMobile) setOpenMobile(false)
            }}
            render={<Link href="/dashboard" />}
          >
            {identity}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="h-12 px-3 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                tooltip={active?.name ?? "Rentops"}
                disabled={pending}
              >
                {identity}
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Organizations
              </DropdownMenuLabel>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  disabled={pending}
                  onClick={() => handleSwitch(org)}
                >
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{org.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {org.roleName}
                    </span>
                  </div>
                  {org.id === active?.id && (
                    <CheckIcon className="ml-auto size-4" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
