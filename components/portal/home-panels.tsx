import {
  FileTextIcon,
  FolderOpenIcon,
  KeyRoundIcon,
  PenLineIcon,
  ReceiptIcon,
  UserRoundPenIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

import { DashboardPanel, PanelRow } from "@/components/dashboard/panel"
import { QuickActionsCard, type QuickAction } from "@/components/dashboard/quick-actions-card"
import { formatCurrencyFull, formatDate } from "@/lib/format"
import type { PortalLease, PortalMember } from "@/lib/portal"
import { cn } from "@/lib/utils"

/**
 * The tenant Home below the top row. Server components, built from the
 * landlord dashboard's `DashboardPanel` so the lists share its look.
 */

/** At most this many rows; the count badge and the Payments link cover the rest. */
const MAX_BILLS = 5

/**
 * Everything unpaid, one row per invoice (a lease has exactly one), largest
 * arrears first and capped at five. Ended leases stay listed while money is
 * owed on them.
 */
export function BillsPanel({ leases, className }: { leases: PortalLease[]; className?: string }) {
  const bills = leases.flatMap((lease) =>
    lease.invoice && lease.invoice.balance > 0 ? [{ lease, invoice: lease.invoice }] : []
  )
  const shown = [...bills]
    .sort((a, b) => b.invoice.coverage.amountBehind - a.invoice.coverage.amountBehind)
    .slice(0, MAX_BILLS)

  return (
    <DashboardPanel
      className={className}
      title="Bills to pay"
      icon={ReceiptIcon}
      href="/portal/payments"
      linkLabel="Payments"
      count={bills.length}
      empty="Nothing to pay — you're all settled."
    >
      {shown.map(({ lease, invoice }) => {
        const { coverage } = invoice
        const behind = coverage.amountBehind > 0
        return (
          <PanelRow
            key={lease.id}
            href="/portal/payments"
            leading={<RowIcon icon={WalletIcon} urgent={behind} />}
            title={`Rent · ${lease.propertyName} · ${lease.unitLabel}`}
            subtitle={
              behind
                ? `Due ${formatDate(invoice.dueDate)}`
                : `Next due ${formatDate(coverage.coveredUntil)}`
            }
            trailing={formatCurrencyFull(invoice.balance)}
            trailingCaption={invoice.status}
            tone={behind ? "accent" : "default"}
          />
        )
      })}
    </DashboardPanel>
  )
}

function RowIcon({ icon: Icon, urgent = false }: { icon: LucideIcon; urgent?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg",
        urgent ? "bg-stat-accent/15 text-stat-accent" : "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  )
}

/**
 * The tenant's quick actions, drawn by the shared `QuickActionsCard` (urgent
 * only while anything is urgent). Everyday shortcuts: payment history,
 * contract, documents, password. Call / WhatsApp the landlord were dropped on
 * purpose.
 */
export function QuickActions({
  member,
  lease,
  leases,
  className,
}: {
  member: PortalMember
  /** The current lease, for its contract. */
  lease: PortalLease | null
  leases: PortalLease[]
  className?: string
}) {
  const owing = leases.some((l) => (l.invoice?.balance ?? 0) > 0)
  const profileIncomplete =
    !member.profile.emergencyContactName || !member.profile.emergencyContactPhone

  const actions: QuickAction[] = []
  if (!member.signatureKey) {
    actions.push({
      label: "Add signature",
      caption: "Needed for your contract",
      icon: PenLineIcon,
      href: "/portal/profile",
      needed: true,
    })
  }
  actions.push({
    label: "Pay rent",
    caption: owing ? "See what you owe" : "Payment history",
    icon: WalletIcon,
    href: "/portal/payments",
    needed: owing,
  })
  if (profileIncomplete) {
    actions.push({
      label: "Complete profile",
      caption: "Add an emergency contact",
      icon: UserRoundPenIcon,
      href: "/portal/profile",
      needed: true,
    })
  }
  if (lease?.contract) {
    actions.push({
      label: "View contract",
      caption: lease.reference,
      icon: FileTextIcon,
      document: { ...lease.contract, label: "Lease contract" },
    })
  }
  actions.push(
    {
      label: "Documents",
      caption: "Contracts and files",
      icon: FolderOpenIcon,
      href: "/portal/documents",
    },
    {
      label: "Change password",
      caption: "Keep your account safe",
      icon: KeyRoundIcon,
      href: "/portal/profile",
    }
  )

  return <QuickActionsCard actions={actions} className={className} />
}
