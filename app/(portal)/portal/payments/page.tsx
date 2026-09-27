import { WalletIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { FilterPills, parseFilter } from "@/components/portal/filter-pills"
import { InvoiceListCard } from "@/components/portal/invoice-list-card"
import { PortalNoOrganization } from "@/components/portal/portal-states"
import { requireTenantPage } from "@/lib/authz"
import { getPortalLeases } from "@/lib/portal"

export const metadata = { title: "Payments" }

const FILTERS = [
  { label: "All invoices", value: undefined },
  { label: "Outstanding", value: "outstanding" },
  { label: "Paid", value: "paid" },
] as const

/**
 * Every invoice the tenant has — one per lease — as a grid of cards under the
 * same filter pills as My lease. Each opens the invoice with its monthly
 * breakdown and payments.
 */
export default async function PortalPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
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

  const active = parseFilter(FILTERS, (await searchParams).status)
  // Owing first (behind before merely unpaid), then settled; each group keeps
  // the newest-lease-first order it arrived in.
  const rank = (i: (typeof invoiced)[number]["invoice"]) =>
    i.coverage.amountBehind > 0 ? 0 : i.balance > 0 ? 1 : 2
  const sorted = invoiced
    .filter((l) =>
      active === "outstanding"
        ? l.invoice.balance > 0
        : active === "paid"
          ? l.invoice.balance === 0
          : true
    )
    .sort((a, b) => rank(a.invoice) - rank(b.invoice))

  return (
    <div className="flex flex-col gap-6">
      <FilterPills basePath="/portal/payments" filters={FILTERS} active={active} />
      {sorted.length === 0 ? (
        <EmptyState
          icon={WalletIcon}
          title="No matching invoices"
          description={
            active === "outstanding"
              ? "Nothing outstanding — every invoice is paid."
              : "No invoices with this status. Try a different filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((lease) => (
            <InvoiceListCard key={lease.invoice.id} lease={lease} />
          ))}
        </div>
      )}
    </div>
  )
}
