import {
  ContractLink,
  InvoiceFigures,
  LeasePeriod,
  LeaseTitle,
} from "@/components/portal/lease-parts"
import {
  PortalNoLeases,
  PortalNoOrganization,
} from "@/components/portal/portal-states"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireTenantPage } from "@/lib/authz"
import { formatCurrencyFull, formatDate } from "@/lib/format"
import { getPortalLeases, liveLeases, type PortalLease } from "@/lib/portal"

export const metadata = { title: "My lease" }

export default async function PortalLeasePage() {
  const access = await requireTenantPage()
  if (!access) return <PortalNoOrganization />

  const leases = await getPortalLeases(access)
  if (leases.length === 0) return <PortalNoLeases />

  const live = liveLeases(leases)
  const others = leases.filter((l) => !live.includes(l))

  return (
    <>
      {live.map((lease) => (
        <LeaseCard key={lease.id} lease={lease} />
      ))}

      {others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past leases</CardTitle>
            <CardDescription>Ended and renewed leases.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border text-sm">
              {others.map((other) => (
                <li
                  key={other.id}
                  className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {other.propertyName} · {other.unitLabel}
                      <Badge
                        variant="outline"
                        className="rounded-full font-normal"
                      >
                        {other.status}
                      </Badge>
                    </p>
                    <p className="text-muted-foreground">
                      <LeasePeriod lease={other} />
                    </p>
                  </div>
                  <ContractLink lease={other} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function LeaseCard({ lease }: { lease: PortalLease }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <LeaseTitle lease={lease} />
        </CardTitle>
        <CardDescription>
          <LeasePeriod lease={lease} />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Term label="Reference" value={lease.reference} />
          <Term label="Property" value={lease.propertyName} />
          <Term label="Unit" value={lease.unitLabel} />
          <Term label="Starts" value={formatDate(lease.startDate)} />
          <Term label="Ends" value={formatDate(lease.endDate)} />
          <Term
            label="Duration"
            value={`${lease.durationMonths} month${lease.durationMonths === 1 ? "" : "s"}`}
          />
          <Term
            label="Monthly rent"
            value={formatCurrencyFull(lease.monthlyRent)}
          />
          <Term
            label="Lease amount"
            value={formatCurrencyFull(lease.leaseAmount)}
          />
          {lease.invoice && (
            <Term
              label="Payment due"
              value={formatDate(lease.invoice.dueDate)}
            />
          )}
        </dl>

        {lease.invoice ? (
          <InvoiceFigures invoice={lease.invoice} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No invoice issued yet.
          </p>
        )}

        <ContractLink lease={lease} />
      </CardContent>
    </Card>
  )
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
