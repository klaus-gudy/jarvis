import { UserCogIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

export default function UsersPage() {
  return (
    <EmptyState
      icon={UserCogIcon}
      title="Only you so far"
      description="Invite teammates and assign them roles within your organization."
    />
  )
}
