"use client"

import * as React from "react"

import type { Permission, RoleKind } from "@/lib/permissions"

/**
 * The signed-in member's permissions, handed down by the app layout with the
 * rendered page — the browser never fetches or decides them.
 *
 * Everything here is a courtesy: it hides or greys out controls the member
 * cannot use. The API re-checks every request against the live database
 * (`authorize` in `lib/authz.ts`), so editing this in DevTools only reveals
 * buttons that then answer 403.
 */
type Viewer = { kind: RoleKind; permissions: ReadonlySet<Permission> }

const PermissionsContext = React.createContext<Viewer>({
  kind: "STAFF",
  permissions: new Set(),
})

export function PermissionsProvider({
  kind,
  permissions,
  children,
}: {
  kind: RoleKind
  permissions: Permission[]
  children: React.ReactNode
}) {
  const value = React.useMemo(
    () => ({ kind, permissions: new Set(permissions) as ReadonlySet<Permission> }),
    [kind, permissions]
  )
  return (
    <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
  )
}

export function usePermissions() {
  return React.useContext(PermissionsContext)
}

/** True when the member holds `requirement` (any one, for a list). */
export function useCan(requirement: Permission | readonly Permission[]) {
  const { kind, permissions } = usePermissions()
  if (kind === "OWNER") return true
  return typeof requirement === "string"
    ? permissions.has(requirement)
    : requirement.some((p) => permissions.has(p))
}

/** Renders `children` only when the member holds `permission`. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission | readonly Permission[]
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return useCan(permission) ? children : fallback
}

/**
 * Greys out row actions the member's role can't use, matched by the start of
 * their label ("Edit", "Delete lease"…). Greyed, not hidden — same rule as
 * every other unavailable action: each row keeps its actions in the same
 * places, and the reason is shown on hover.
 */
export function gateActions<A extends { label: string; disabled?: boolean; disabledReason?: string }>(
  actions: A[],
  rules: [prefix: string, allowed: boolean][]
): A[] {
  return actions.map((action) => {
    const rule = rules.find(([prefix]) => action.label.startsWith(prefix))
    if (!rule || rule[1]) return action
    return { ...action, disabled: true, disabledReason: "Your role doesn't allow this" }
  })
}
