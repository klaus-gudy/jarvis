import { FileTextIcon, HomeIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { SignatureCard } from "@/components/members/signature-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireTenantPage } from "@/lib/authz"
import { formatCurrencyFull, formatDate } from "@/lib/format"
import { INVOICE_STATUS_VARIANT } from "@/lib/invoice-types"
import { getPortalOverview } from "@/lib/portal"

export default async function PortalPage() {
  const access = await requireTenantPage()
  if (!access) {
    return (
      <EmptyState
        icon={HomeIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    )
  }

  const overview = await getPortalOverview(access)
  if (!overview) {
    return (
      <EmptyState
        icon={HomeIcon}
        title="Nothing here"
        description="We couldn't find your tenancy. Ask your landlord to check your details."
      />
    )
  }

  const firstName = overview.name?.trim().split(/\s+/)[0] ?? null

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Hello, ${firstName}` : "Welcome"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your tenancy with {overview.organizationName}.
        </p>
      </div>

      {overview.leases.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="No leases yet"
          description="Your leases will appear here once your landlord adds them."
        />
      ) : (
        overview.leases.map((lease) => (
          <Card key={lease.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {lease.propertyName} · {lease.unitLabel}
                <Badge variant="outline" className="rounded-full font-normal">
                  {lease.status}
                </Badge>
              </CardTitle>
              <CardDescription>
                {lease.reference} · {formatDate(lease.startDate)} – {formatDate(lease.endDate)} ·{" "}
                {formatCurrencyFull(lease.monthlyRent)} a month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lease.invoice ? (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrencyFull(lease.invoice.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Paid</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrencyFull(lease.invoice.paid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Balance</p>
                    <p className="flex items-center gap-2 font-medium tabular-nums">
                      {formatCurrencyFull(lease.invoice.balance)}
                      <Badge
                        variant={INVOICE_STATUS_VARIANT[lease.invoice.status]}
                        className="rounded-full font-normal"
                      >
                        {lease.invoice.status}
                      </Badge>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No invoice issued yet.</p>
              )}

              {lease.invoice && lease.invoice.payments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Payments</p>
                  <ul className="divide-y rounded-md border text-sm">
                    {lease.invoice.payments.map((payment) => (
                      <li key={payment.id} className="flex justify-between gap-3 px-3 py-2">
                        <span className="text-muted-foreground">
                          {formatDate(payment.paidAt)}
                          {payment.method ? ` · ${payment.method}` : ""}
                        </span>
                        <span className="tabular-nums">{formatCurrencyFull(payment.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lease.contract ? (
                <a
                  href={`/api/portal/documents/${lease.contract.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  <FileTextIcon className="size-4" aria-hidden />
                  View contract
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">No contract generated yet.</p>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {overview.documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your documents</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border text-sm">
              {overview.documents.map((doc) => (
                <li key={doc.id} className="flex justify-between gap-3 px-3 py-2">
                  <a
                    href={`/api/portal/documents/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 truncate text-primary underline-offset-4 hover:underline"
                  >
                    {doc.fileName}
                  </a>
                  <span className="shrink-0 text-muted-foreground">{doc.label}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <SignatureCard
        membershipId={access.membershipId}
        name={overview.name ?? "You"}
        signatureKey={overview.signatureKey}
        isSelf
      />
    </>
  )
}
