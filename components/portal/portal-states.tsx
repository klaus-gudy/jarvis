import { FileTextIcon, HomeIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

/** `requireTenantPage` returned null: the account has no organization. */
export function PortalNoOrganization() {
  return (
    <EmptyState
      icon={HomeIcon}
      title="No organization"
      description="You are not a member of an organization yet."
    />
  )
}

/** The membership vanished between the gate and the query. */
export function PortalNotFound() {
  return (
    <EmptyState
      icon={HomeIcon}
      title="Nothing here"
      description="We couldn't find your tenancy. Ask your landlord to check your details."
    />
  )
}

export function PortalNoLeases() {
  return (
    <EmptyState
      icon={FileTextIcon}
      title="No leases yet"
      description="Your leases will appear here once your landlord adds them."
    />
  )
}
