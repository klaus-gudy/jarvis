"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { safeNextPath } from "@/lib/site"

/**
 * A link between the sign-in and sign-up pages that keeps `?next=` — so a
 * visitor who chose a plan, then realised they already have an account, still
 * lands on checkout afterwards. Read on click rather than at render, so the
 * server and client markup match.
 */
export function CarryNextLink({
  href,
  className,
  children,
}: {
  href: "/login" | "/register"
  className?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        const next = safeNextPath(new URLSearchParams(window.location.search).get("next"))
        if (!next) return
        event.preventDefault()
        router.push(`${href}?next=${encodeURIComponent(next)}`)
      }}
    >
      {children}
    </Link>
  )
}
