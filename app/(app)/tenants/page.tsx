import { UsersIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

export default function TenantsPage() {
  return (
    <EmptyState
      icon={UsersIcon}
      title="No tenants yet"
      description="Tenants appear here once you add them to your organization and assign a lease."
    />
  )
}
