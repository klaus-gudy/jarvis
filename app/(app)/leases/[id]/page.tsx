import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";

import { BillingTab } from "@/components/leases/billing-tab";
import { ContractTab } from "@/components/leases/contract-tab";
import { DetailRow, orDash } from "@/components/detail-row";
import { InvoiceProgress } from "@/components/leases/invoice-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/session";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { INVOICE_STATUS_VARIANT } from "@/lib/invoice-types";
import { listAssetTypes } from "@/lib/asset-types";
import { LEASE_CONTRACT_TYPE_ID } from "@/lib/contracts";
import { listDocuments } from "@/lib/documents";
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
  const [lease, invoice, documents, documentAssetTypes] = await Promise.all([
    getLease(user.activeOrgId, id),
    getInvoiceForLease(user.activeOrgId, id),
    listDocuments(user.activeOrgId, "LEASE", id),
    listAssetTypes(user.activeOrgId, "LEASE"),
  ]);
  if (!lease) notFound();

  const hasContract = documents.some(
    (document) => document.assetType.id === LEASE_CONTRACT_TYPE_ID
  );

  const { tenant, unit, property } = lease;

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        className="w-fit text-muted-foreground"
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
          <TabsTrigger value="billing" className="flex-none gap-2 px-3">
            Billing
            {/* How many payments have been recorded, matching the count badges
                the Units and Users tabs already carry. Hidden at zero — a "0"
                beside a tab reads as a problem rather than as a total. */}
            {invoice && invoice.payments.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {invoice.payments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="contract" className="flex-none px-3">
            Contract
          </TabsTrigger>
        </TabsList>

        {/*
          Two columns of equal height, whatever they contain.

          Three things are doing that. The grid keeps its default
          `items-stretch`, so both column wrappers take the height of the taller
          one. Each wrapper is a flex column. And every card carries `grow`,
          which shares the leftover height between the cards in the shorter
          column instead of leaving it as a gap at the bottom — `grow` rather
          than `flex-1` so the cards keep their content-based proportions and
          only the surplus is divided.

          A 2×2 grid was tried first and was wrong: it aligns *rows*, and Tenant
          (three rows) beside Unit info (seven) left a 192px hole. Independent
          columns fixed the hole but staggered the two sides against each other.

          Pairing is by meaning as well as balance: identity and location on the
          left, terms and money on the right. Below `lg` the grid collapses to
          one column and the wrappers stack, so reading order is unchanged.
        */}
        <TabsContent value="overview" className="pt-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
            <Card className="grow">
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

            <Card className="grow">
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

            <div className="flex flex-col gap-5">
            <Card className="grow">
              <CardHeader className="border-b">
                <CardTitle className="text-base">Lease terms</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <dl>
                  <DetailRow
                    label="Start date"
                    value={formatDate(lease.startDate)}
                  />
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

            {/* The invoice is part of what this lease *is*, so it reads here;
                the Billing tab is only the ledger. */}
            <Card className="grow">
              <CardHeader className="border-b">
                <CardTitle className="text-base">Invoice</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {invoice ? (
                  <>
                    {/* The bar replaces the Total / Paid so far / Balance rows
                        that used to sit below — same three numbers, but a
                        reader no longer has to subtract to see where the
                        invoice stands. What remains are the facts a bar can't
                        carry. */}
                    <div className="px-6 py-4">
                      <InvoiceProgress
                        amount={invoice.amount}
                        paid={invoice.paid}
                        balance={invoice.balance}
                      />
                    </div>
                    <dl className="border-t">
                      <DetailRow
                        label="Reference"
                        value={
                          <span className="font-mono text-xs">
                            {invoice.reference}
                          </span>
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
                        label="Due date"
                        value={formatDate(invoice.dueDate)}
                      />
                    </dl>
                  </>
                ) : (
                  <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                    No invoice exists for this lease yet.
                  </p>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
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
          <ContractTab
            leaseId={lease.id}
            reference={lease.reference}
            hasContract={hasContract}
            assetTypes={documentAssetTypes}
            documents={documents.map((document) => ({
              ...document,
              // Dates must be serialisable to cross the server/client boundary.
              createdAt: document.createdAt.toISOString(),
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
