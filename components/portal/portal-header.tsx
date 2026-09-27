"use client"

import { usePathname } from "next/navigation"

import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { findActivePortalItem } from "@/lib/portal-nav"

/**
 * The portal's top bar: menu toggle, page title, theme. Organization switching
 * and sign-out live in the sidebar, as in the staff app; no search or tours —
 * a tenant has five pages of their own records.
 */
export function PortalHeader() {
  const pathname = usePathname()
  const title = findActivePortalItem(pathname)?.title ?? "My tenancy"

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-vertical:h-4 data-vertical:self-auto"
      />
      <h1 className="truncate text-sm font-medium">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  )
}
