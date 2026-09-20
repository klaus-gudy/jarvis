"use client"

import { usePathname } from "next/navigation"

import { GlobalSearch } from "@/components/global-search"
import { ThemeToggle } from "@/components/theme-toggle"
import { TourHelpButton } from "@/components/tour/tour-help-button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { findPageTitle } from "@/lib/nav"

export function AppHeader() {
  const pathname = usePathname()
  const title = findPageTitle(pathname)

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-vertical:h-4 data-vertical:self-auto"
      />
      <h1 className="truncate text-sm font-medium">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />
        <ThemeToggle />
        {/* Tours don't run below `md` (see TourProvider), so the menu that
            replays them is hidden there rather than left to report that every
            page has no tour. CSS rather than `useIsMobile` so it is never
            rendered and then removed on hydration. */}
        <TourHelpButton className="hidden md:inline-flex" />
      </div>
    </header>
  )
}
