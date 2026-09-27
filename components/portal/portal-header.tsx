"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOutIcon } from "lucide-react"

import { RentopsWordmark } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * The portal's whole chrome: brand, organization picker (someone can rent in
 * one organization and work in another), theme, sign out. No sidebar — a
 * tenant has one page.
 */
export function PortalHeader({
  organizations,
  activeOrgId,
  staffHref,
}: {
  organizations: { id: string; name: string }[]
  activeOrgId: string
  /** First staff page the tenant's role opens, if any. */
  staffHref: string | null
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function switchTo(organizationId: string) {
    if (organizationId === activeOrgId) return
    setPending(true)
    const response = await fetch("/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    })
    // `/dashboard` sends staff memberships to the app and tenant ones back here.
    if (response.ok) router.push("/dashboard")
    router.refresh()
    setPending(false)
  }

  async function signOut() {
    setPending(true)
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
        <RentopsWordmark />
        <div className="ml-auto flex items-center gap-2">
          {organizations.length > 1 && (
            <Select
              value={activeOrgId}
              onValueChange={(next) => next && switchTo(next)}
              disabled={pending}
            >
              <SelectTrigger aria-label="Organization" className="max-w-48">
                <SelectValue>
                  {(selected: string) =>
                    organizations.find((o) => o.id === selected)?.name ?? "Organization"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {staffHref && (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={staffHref} />}>
              Staff app
            </Button>
          )}
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={signOut} disabled={pending}>
            <LogOutIcon />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
