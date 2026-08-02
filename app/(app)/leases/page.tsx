import { FileTextIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

export default function LeasesPage() {
  return (
    <EmptyState
      icon={FileTextIcon}
      title="No leases yet"
      description="A lease connects a tenant to a unit for a period of time."
    />
  )
}
