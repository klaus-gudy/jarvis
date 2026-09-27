import { WalletIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { InvoiceListCard } from "@/components/portal/invoice-list-card"
import { PortalNoOrganization } from "@/components/portal/portal-states"
import { requireTenantPage } from "@/lib/authz"
import { formatCurrencyFull } from "@/lib/format"
import { getPortalLeases } from "@/lib/portal"

export const metadata = { title: "Payments" }

/**
 * Every invoice the tenant has — one per lease — as a grid of cards like My
 * lease. Each opens the invoice with its monthly breakdown and payments.
 */
export default async function PortalPaymentsPage() {
  const access = await requireTenantPage()
  if (!access) return <PortalNoOrganization />

  // Paired up front so the invoice is known to exist from here on.
  const invoiced = (await getPortalLeases(access)).flatMap((lease) =>
    lease.invoice ? [{ ...lease, invoice: lease.invoice }] : []
  )
  if (invoiced.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <EmptyState
          icon={WalletIcon}
          title="No invoices yet"
          description="Invoices and the payments recorded against them will appear here."
        />
      </div>
    )
  }

  // Owing first (behind before merely unpaid), then settled; each group keeps
  // the newest-lease-first order it arrived in.
  const rank = (i: (typeof invoiced)[number]["invoice"]) =>
    i.coverage.amountBehind > 0 ? 0 : i.balance > 0 ? 1 : 2
  const sorted = [...invoiced].sort((a, b) => rank(a.invoice) - rank(b.invoice))

  const outstanding = invoiced.reduce((sum, l) => sum + l.invoice.balance, 0)
  const paid = invoiced.reduce((sum, l) => sum + l.invoice.paid, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Your invoices</h2>
        <p className="text-sm text-muted-foreground">
          {outstanding > 0
            ? `${formatCurrencyFull(outstanding)} outstanding · ${formatCurrencyFull(paid)} paid so far`
            : `All settled · ${formatCurrencyFull(paid)} paid`}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((lease) => (
          <InvoiceListCard key={lease.invoice.id} lease={lease} />
        ))}
      </div>
    </div>
  )
}
