import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";

import { BillingTab } from "@/components/leases/billing-tab";
import { DetailRow, orDash } from "@/components/detail-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/session";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { INVOICE_STATUS_VARIANT } from "@/lib/invoice-types";
import { getInvoiceForLease } from "@/lib/invoices";
import { getLease, type LeaseStatus } from "@/lib/leases";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<LeaseStatus, string> = {
  Active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Upcoming: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Ended: "bg-muted text-muted-foreground",
};

const STATUS_DOT: Record<LeaseStatus, string> = {
  Active: "bg-emerald-500",
  Upcoming: "bg-amber-500",
  Ended: "bg-muted-foreground",
};

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.activeOrgId) redirect("/leases");

  const { id } = await params;
  const [lease, invoice] = await Promise.all([
    getLease(user.activeOrgId, id),
    getInvoiceForLease(user.activeOrgId, id),
  ]);
  if (!lease) notFound();

  const { tenant, unit, property } = lease;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        className="-ml-2 w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href="/leases" />}
      >
        <ArrowLeftIcon />
        All leases
      </Button>

      <Card>
        <CardContent className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileTextIcon className="size-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate text-xl font-semibold tracking-tight">
                Lease {lease.reference}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  STATUS_TONE[lease.status]
                )}
              >
                <span
                  aria-hidden
                  className={cn("size-1.5 rounded-full", STATUS_DOT[lease.status])}
                />
                {lease.status}
              </span>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {tenant.name} · {property.name} · {unit.label}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="overview" className="flex-none px-3">
            Overview
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex-none px-3">
            Billing
          </TabsTrigger>
          <TabsTrigger value="contract" className="flex-none px-3">
            Contract
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5 pt-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Tenant</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <dl>
                  <DetailRow
                    label="Tenant name"
                    value={
                      <Link
                        href="/tenants"
                        className="text-primary hover:underline"
                      >
                        {tenant.name}
                      </Link>
                    }
                  />
                  <DetailRow label="Phone" value={orDash(tenant.phone)} />
                  <DetailRow label="Email" value={orDash(tenant.email)} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Unit info</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <dl>
                  <DetailRow
                    label="Property"
                    value={
                      <Link
                        href={`/properties/${property.id}`}
                        className="text-primary hover:underline"
                      >
                        {property.name}
                      </Link>
                    }
                  />
                  <DetailRow label="Unit" value={unit.label} />
                  <DetailRow label="Area" value={orDash(property.address)} />
                  <DetailRow label="Type" value={orDash(unit.unitType)} />
                  <DetailRow label="Floor" value={orDash(unit.floor)} />
                  <DetailRow label="Block" value={orDash(unit.block)} />
                  <DetailRow
                    label="Monthly rate"
                    value={
                      <span className="font-mono tabular-nums">
                        {formatCurrencyFull(unit.rentAmount)}
                      </span>
                    }
                  />
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Lease terms</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Two columns on wide screens. DetailRow's own `last:after:hidden`
                  only clears the final cell, so the whole bottom row is cleared
                  here — otherwise the second-to-last cell keeps a stray divider. */}
              <dl className="md:grid md:grid-cols-2 md:[&>*:nth-last-child(-n+2)]:after:hidden">
                <DetailRow label="Start date" value={formatDate(lease.startDate)} />
                <DetailRow label="End date" value={formatDate(lease.endDate)} />
                <DetailRow
                  label="Duration"
                  value={`${lease.durationMonths} months`}
                />
                <DetailRow label="Payment frequency" value="Monthly" />
                {/* The rate this lease was agreed at — not `unit.rentAmount`,
                    which is the asking price and shown on the Unit info card.
                    They differ whenever the rent was negotiated. */}
                <DetailRow
                  label="Monthly rent"
                  value={
                    <span className="font-mono tabular-nums">
                      {formatCurrencyFull(lease.monthlyRent)}
                    </span>
                  }
                />
                <DetailRow
                  label="Total lease amount"
                  value={
                    <span className="font-mono tabular-nums">
                      {formatCurrencyFull(lease.leaseAmount)}
                    </span>
                  }
                />
              </dl>
            </CardContent>
          </Card>

          {/* Same shape as Lease terms — the invoice is part of what this lease
              *is*, so it reads here; the Billing tab is only the ledger. */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Invoice</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invoice ? (
                <dl className="md:grid md:grid-cols-2 md:[&>*:nth-last-child(-n+2)]:after:hidden">
                  <DetailRow
                    label="Reference"
                    value={
                      <span className="font-mono text-xs">{invoice.reference}</span>
                    }
                  />
                  <DetailRow
                    label="Status"
                    value={
                      <Badge
                        variant={INVOICE_STATUS_VARIANT[invoice.status]}
                        className="rounded-full font-normal"
                      >
                        {invoice.status}
                      </Badge>
                    }
                  />
                  <DetailRow
                    label="Total amount"
                    value={
                      <span className="font-mono tabular-nums">
                        {formatCurrencyFull(invoice.amount)}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Due date"
                    value={formatDate(invoice.dueDate)}
                  />
                  <DetailRow
                    label="Paid so far"
                    value={
                      <span className="font-mono tabular-nums">
                        {formatCurrencyFull(invoice.paid)}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Balance remaining"
                    value={
                      <span className="font-mono tabular-nums">
                        {formatCurrencyFull(invoice.balance)}
                      </span>
                    }
                  />
                </dl>
              ) : (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No invoice exists for this lease yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="pt-5">
          <BillingTab
            invoice={
              invoice
                ? {
                    id: invoice.id,
                    reference: invoice.reference,
                    amount: invoice.amount,
                    dueDate: invoice.dueDate.toISOString(),
                    paid: invoice.paid,
                    balance: invoice.balance,
                    status: invoice.status,
                    payments: invoice.payments.map((payment) => ({
                      id: payment.id,
                      amount: payment.amount,
                      paidAt: payment.paidAt.toISOString(),
                      method: payment.method,
                      notes: payment.notes,
                    })),
                  }
                : null
            }
          />
        </TabsContent>

        <TabsContent value="contract" className="pt-5">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Contract</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contract documents for lease {lease.reference} will live here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
