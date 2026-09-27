import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { InvoiceCard } from "@/components/leases/invoice-card"
import { LeaseTermsCard } from "@/components/leases/lease-terms-card"
import {
  LeaseHeaderCard,
  LeaseTermCard,
} from "@/components/portal/lease-detail"
import { PortalNoOrganization } from "@/components/portal/portal-states"
import { Button } from "@/components/ui/button"
import { requireTenantPage } from "@/lib/authz"
import { getPortalLeases } from "@/lib/portal"

export const metadata = { title: "Lease" }

/**
 * One lease, laid out like the landlord's detail pages: back button, header
 * card, then the content — the lease and its rent in the main column, the term
 * beside them (above them on a phone).
 */
export default async function PortalLeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const access = await requireTenantPage()
  if (!access) return <PortalNoOrganization />

  const { id } = await params
  // Looked up among the tenant's own leases only — another tenant's id, or a
  // made-up one, is simply not in the list.
  const leases = await getPortalLeases(access)
  const lease = leases.find((l) => l.id === id)
  if (!lease) notFound()

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="outline"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href="/portal/lease" />}
      >
        <ArrowLeftIcon />
        All leases
      </Button>

      <LeaseHeaderCard lease={lease} />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {/* On a phone the term (days left, contract) leads; from `lg` it
              moves to the side column below. */}
          <div className="lg:hidden">
            <LeaseTermCard lease={lease} />
          </div>
          <LeaseTermsCard lease={lease} />
          <InvoiceCard invoice={lease.invoice} />
        </div>
        {/* Sticky beside the scrolling main column on wide screens. */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-18">
          <div className="hidden lg:block">
            <LeaseTermCard lease={lease} />
          </div>
        </div>
      </div>
    </div>
  )
}
