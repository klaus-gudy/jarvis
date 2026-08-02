import { BuildingIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

export default function PropertiesPage() {
  return (
    <EmptyState
      icon={BuildingIcon}
      title="No properties yet"
      description="Add your first building to start tracking its units and leases."
    />
  )
}
