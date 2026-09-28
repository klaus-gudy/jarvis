import {
  BuildingIcon,
  FileSignatureIcon,
  FileTextIcon,
  LandmarkIcon,
  PenLineIcon,
  UserPlusIcon,
  WalletIcon,
} from "lucide-react"

import { QuickActionsCard, type QuickAction } from "@/components/dashboard/quick-actions-card"
import type { DashboardAttention } from "@/lib/dashboard-actions"
import type { Permission } from "@/lib/permissions"

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

/**
 * The landlord's side of Quick actions: things waiting on this person —
 * their signature, tenant payments to confirm, contracts not generated yet,
 * payment details tenants can't see — and, once none are left, the everyday
 * shortcuts this role may use.
 */
export function LandlordQuickActions({
  attention,
  permissions,
}: {
  attention: DashboardAttention
  permissions: ReadonlySet<Permission>
}) {
  const can = (p: Permission) => permissions.has(p)
  const { pendingClaims, leasesWithoutContract } = attention
  const actions: QuickAction[] = []

  if (attention.signatureMissing) {
    actions.push({
      label: "Add your signature",
      caption: attention.isContractLandlord
        ? "Printed on every lease contract"
        : "Used when you sign documents",
      icon: PenLineIcon,
      href: "/profile",
      needed: true,
    })
  }
  if (pendingClaims.count > 0) {
    actions.push({
      label: `Confirm ${plural(pendingClaims.count, "payment")}`,
      caption: "Reported by tenants, not counted yet",
      icon: WalletIcon,
      href: pendingClaims.leaseId ? `/leases/${pendingClaims.leaseId}?tab=billing` : "/leases",
      needed: true,
    })
  }
  if (leasesWithoutContract.count > 0) {
    actions.push({
      label: `Generate ${plural(leasesWithoutContract.count, "contract")}`,
      caption: "Running leases with no contract",
      icon: FileSignatureIcon,
      href: leasesWithoutContract.leaseId
        ? `/leases/${leasesWithoutContract.leaseId}?tab=contract`
        : "/leases",
      needed: true,
    })
  }
  if (attention.paymentDetailsMissing) {
    actions.push({
      label: "Add payment details",
      caption: "Tenants see these to pay rent",
      icon: LandmarkIcon,
      href: "/profile",
      needed: true,
    })
  }

  if (can("property:write")) {
    actions.push({
      label: "Add a property",
      caption: "A building and its units",
      icon: BuildingIcon,
      href: "/properties",
    })
  }
  if (can("lease:write")) {
    actions.push({
      label: "New lease",
      caption: "Put a tenant in a unit",
      icon: FileTextIcon,
      href: "/leases",
    })
  }
  if (can("payment:record")) {
    actions.push({
      label: "Record a payment",
      caption: "Rent received against an invoice",
      icon: WalletIcon,
      href: "/payments",
    })
  }
  if (can("member:invite")) {
    actions.push({
      label: "Invite someone",
      caption: "Staff or a tenant",
      icon: UserPlusIcon,
      href: "/users",
    })
  }

  return <QuickActionsCard actions={actions} />
}
