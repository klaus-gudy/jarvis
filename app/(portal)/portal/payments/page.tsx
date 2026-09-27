import { WalletIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import {
  Figure,
  InvoiceFigures,
  PaymentList,
} from "@/components/portal/lease-parts"
import { PortalNoOrganization } from "@/components/portal/portal-states"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireTenantPage } from "@/lib/authz"
import { formatCurrencyFull, formatDate } from "@/lib/format"
import { getPortalLeases } from "@/lib/portal"

export const metadata = { title: "Payments" }

export default async function PortalPaymentsPage() {
  const access = await requireTenantPage()
  if (!access) return <PortalNoOrganization />

  // Paired up front so the invoice is known to exist from here on.
  const billed = (await getPortalLeases(access)).flatMap((lease) =>
    lease.invoice ? [{ lease, invoice: lease.invoice }] : []
  )
  if (billed.length === 0) {
    return (
      <EmptyState
        icon={WalletIcon}
        title="No invoices yet"
        description="Invoices and the payments recorded against them will appear here."
      />
    )
  }

  const totals = billed.reduce(
    (sum, { invoice }) => ({
      amount: sum.amount + invoice.amount,
      paid: sum.paid + invoice.paid,
      balance: sum.balance + invoice.balance,
    }),
    { amount: 0, paid: 0, balance: 0 }
  )

  return (
    // The Home dashboard uses the full width; reading pages stay narrow.
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Across all your leases.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Figure label="Invoiced" value={formatCurrencyFull(totals.amount)} />
            <Figure label="Paid" value={formatCurrencyFull(totals.paid)} />
            <Figure label="Balance" value={formatCurrencyFull(totals.balance)} />
          </div>
        </CardContent>
      </Card>

      {billed.map(({ lease, invoice }) => {
        return (
          <Card key={lease.id}>
            <CardHeader>
              <CardTitle>
                {lease.propertyName} · {lease.unitLabel}
              </CardTitle>
              <CardDescription>
                {lease.reference} · due {formatDate(invoice.dueDate)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <InvoiceFigures invoice={invoice} />
              {invoice.payments.length > 0 ? (
                <PaymentList payments={invoice.payments} />
              ) : (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
