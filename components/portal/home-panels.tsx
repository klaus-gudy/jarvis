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

/**
 * Everything unpaid, one row per invoice (a lease has exactly one). Ended
 * leases stay listed while money is owed on them.
 */
export function BillsPanel({ leases }: { leases: PortalLease[] }) {
  const bills = leases.flatMap((lease) =>
    lease.invoice && lease.invoice.balance > 0 ? [{ lease, invoice: lease.invoice }] : []
  )
  const total = bills.reduce((sum, b) => sum + b.invoice.balance, 0)

  return (
    <DashboardPanel
      title={total > 0 ? `Bills to pay · ${formatCurrencyFull(total)}` : "Bills to pay"}
      icon={ReceiptIcon}
      href="/portal/payments"
      linkLabel="Payments"
      count={bills.length}
      empty="Nothing to pay — you're all settled."
    >
      {bills.map(({ lease, invoice }) => {
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
                ? `${coverage.monthsBehind} month${coverage.monthsBehind === 1 ? "" : "s"} overdue · ${formatCurrencyFull(coverage.amountBehind)}`
                : `${invoice.reference} · next month due ${formatDate(coverage.coveredUntil)}`
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

export function RecentPaymentsPanel({ leases }: { leases: PortalLease[] }) {
  const payments = leases
    .flatMap((lease) =>
      (lease.invoice?.payments ?? []).map((payment) => ({ payment, lease }))
    )
    .sort((a, b) => b.payment.paidAt.getTime() - a.payment.paidAt.getTime())
    .slice(0, 4)

  return (
    <DashboardPanel
      title="Recent payments"
      icon={WalletIcon}
      href="/portal/payments"
      empty="No payments recorded yet."
    >
      {payments.map(({ payment, lease }) => (
        <PanelRow
          key={payment.id}
          leading={<RowIcon icon={ReceiptIcon} />}
          title={formatCurrencyFull(payment.amount)}
          subtitle={`${lease.propertyName} · ${lease.unitLabel}${payment.method ? ` · ${payment.method}` : ""}`}
          trailing={formatDate(payment.paidAt)}
          tone="muted"
        />
      ))}
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
}: {
  member: PortalMember
  /** The current lease, for its contract. */
  lease: PortalLease | null
  leases: PortalLease[]
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

  return <QuickActionsCard actions={actions} />
}
