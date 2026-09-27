import Link from "next/link"
import {
  ArrowRightIcon,
  CircleAlertIcon,
  PenLineIcon,
  WalletIcon,
} from "lucide-react"

import {
  ContractLink,
  InvoiceFigures,
  LeasePeriod,
  LeaseTitle,
  PaymentList,
} from "@/components/portal/lease-parts"
import {
  PortalNoLeases,
  PortalNoOrganization,
  PortalNotFound,
} from "@/components/portal/portal-states"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireTenantPage } from "@/lib/authz"
import { formatCurrencyFull } from "@/lib/format"
import { getPortalLeases, getPortalMember, liveLeases } from "@/lib/portal"

export const metadata = { title: "My tenancy" }

export default async function PortalHomePage() {
  const access = await requireTenantPage()
  if (!access) return <PortalNoOrganization />

  const [member, leases] = await Promise.all([
    getPortalMember(access),
    getPortalLeases(access),
  ])
  if (!member) return <PortalNotFound />

  const firstName = member.name?.trim().split(/\s+/)[0] ?? null
  const live = liveLeases(leases)
  const balance = leases.reduce((sum, l) => sum + (l.invoice?.balance ?? 0), 0)
  const recentPayments = leases
    .flatMap((l) => l.invoice?.payments ?? [])
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
    .slice(0, 3)

  const steps: {
    icon: typeof WalletIcon
    text: string
    href?: string
    action?: string
  }[] = []
  if (balance > 0) {
    steps.push({
      icon: WalletIcon,
      text: `You have ${formatCurrencyFull(balance)} outstanding.`,
      href: "/portal/payments",
      action: "See payments",
    })
  }
  if (!member.signatureKey) {
    steps.push({
      icon: PenLineIcon,
      text: "Add your signature so it can be placed on your contract.",
      href: "/portal/profile",
      action: "Add signature",
    })
  }
  if (live.some((lease) => !lease.contract)) {
    steps.push({
      icon: CircleAlertIcon,
      text: "Your contract hasn't been generated yet. Your landlord will prepare it.",
    })
  }

  return (
    <>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Hello, ${firstName}` : "Welcome"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Your tenancy with {member.organizationName}.
        </p>
      </div>

      {steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Next steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {steps.map((step) => (
                <li key={step.text} className="flex items-center gap-3">
                  <step.icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">{step.text}</span>
                  {step.href && (
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={step.href} />}
                    >
                      {step.action}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {live.length > 0 ? (
        live.map((lease) => (
          <Card key={lease.id}>
            <CardHeader>
              <CardTitle>
                <LeaseTitle lease={lease} />
              </CardTitle>
              <CardDescription>
                <LeasePeriod lease={lease} />
              </CardDescription>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/portal/lease" />}
                >
                  Details
                  <ArrowRightIcon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
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
        ))
      ) : (
        <PortalNoLeases />
      )}

      {recentPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/portal/payments" />}
              >
                All payments
                <ArrowRightIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <PaymentList payments={recentPayments} />
          </CardContent>
        </Card>
      )}
    </>
  )
}
