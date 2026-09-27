import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { InvoiceCard } from "@/components/leases/invoice-card"
import {
  InvoiceBalanceCard,
  InvoiceHeaderCard,
  PaymentHistoryCard,
  RentScheduleCard,
} from "@/components/portal/invoice-detail"
import { PayAccountsCard } from "@/components/portal/pay-accounts-card"
import { PortalNoOrganization } from "@/components/portal/portal-states"
import { Button } from "@/components/ui/button"
import { requireTenantPage } from "@/lib/authz"
import { getPortalLandlord, getPortalLeases } from "@/lib/portal"

export const metadata = { title: "Invoice" }

/**
 * One invoice, laid out like the lease page: back button, header card, then
 * the invoice, its monthly breakdown and its payments, with the balance and
 * how to pay beside them (the balance leads on a phone).
 */
export default async function PortalInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const access = await requireTenantPage()
  if (!access) return <PortalNoOrganization />

  const { id } = await params
  // Looked up among the tenant's own leases only — an invoice on anyone
  // else's lease is simply not in the list.
  const [leases, landlord] = await Promise.all([
    getPortalLeases(access),
    getPortalLandlord(access),
  ])
  const found = leases.find((l) => l.invoice?.id === id)
  if (!found?.invoice) notFound()
  const lease = { ...found, invoice: found.invoice }

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="outline"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href="/portal/payments" />}
      >
        <ArrowLeftIcon />
        All invoices
      </Button>

      <InvoiceHeaderCard lease={lease} />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {/* On a phone the balance leads; from `lg` it moves to the side. */}
          <div className="lg:hidden">
            <InvoiceBalanceCard lease={lease} />
          </div>
          <InvoiceCard invoice={lease.invoice} />
          <RentScheduleCard lease={lease} />
          <PaymentHistoryCard lease={lease} />
        </div>
        {/* Sticky beside the scrolling main column on wide screens. */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-18">
          <div className="hidden lg:block">
            <InvoiceBalanceCard lease={lease} />
          </div>
          {lease.invoice.balance > 0 && (
            <PayAccountsCard
              accounts={landlord.paymentAccounts}
              reference={lease.reference}
            />
          )}
        </div>
      </div>
    </div>
  )
}
