import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";

import { BillingTab } from "@/components/leases/billing-tab";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { ContractTab } from "@/components/leases/contract-tab";
import { DetailRow, orDash } from "@/components/detail-row";
import { InvoiceCard } from "@/components/leases/invoice-card";
import { LeaseTermsCard } from "@/components/leases/lease-terms-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser, SESSION_EXPIRED_PATH } from "@/lib/auth/session";
import { can, requireStaffPage } from "@/lib/authz";
import { formatCurrencyFull } from "@/lib/format";
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
  Renewed: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

const STATUS_DOT: Record<LeaseStatus, string> = {
  Active: "bg-emerald-500",
  Upcoming: "bg-amber-500",
  Ended: "bg-muted-foreground",
  Renewed: "bg-sky-500",
};

/** Tabs a link may open on, e.g. the dashboard's "Confirm payment" → billing. */
const TABS = ["overview", "billing", "contract", "documents"] as const;

export default async function LeaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const access = await requireStaffPage("lease:read");
  const user = await getCurrentUser();
  if (!user) redirect(SESSION_EXPIRED_PATH);
  if (!user.activeOrgId) redirect("/leases");

  const { id } = await params;
  const requestedTab = (await searchParams).tab;
  const initialTab = TABS.find((tab) => tab === requestedTab) ?? "overview";
  const [lease, invoice, documents, documentAssetTypes] = await Promise.all([
    getLease(user.activeOrgId, id),
    getInvoiceForLease(user.activeOrgId, id),
    listDocuments(user.activeOrgId, "LEASE", id),
    listAssetTypes(user.activeOrgId, "LEASE"),
  ]);
  if (!lease) notFound();

  /*
    Split the same way a property splits Images from Documents: the generated
    contract on one tab, the papers people file on the other. The predicate is
    the seeded type's id rather than a column, because exactly one type is
    machine-made and inventing an `isGenerated` column for it would be a
    migration to express something a constant already says.
  */
  const serialise = (document: (typeof documents)[number]) => ({
    ...document,
    // Dates must be serialisable to cross the server/client boundary.
    createdAt: document.createdAt.toISOString(),
  });

  const contracts = documents
    .filter((document) => document.assetType.id === LEASE_CONTRACT_TYPE_ID)
    .map(serialise);
  const papers = documents
    .filter((document) => document.assetType.id !== LEASE_CONTRACT_TYPE_ID)
    .map(serialise);

  const contractTypes = documentAssetTypes.filter(
    (type) => type.id === LEASE_CONTRACT_TYPE_ID
  );
  const paperTypes = documentAssetTypes.filter(
    (type) => type.id !== LEASE_CONTRACT_TYPE_ID
  );

  const { tenant, unit, property } = lease;
  // Link only where the destination would open: the member page needs
  // `tenant:read`, the property page `property:read` — otherwise it's a 404
  // or a redirect, and plain text is the honest rendering.
  const tenantHref =
    access && can(access, "tenant:read") ? `/members/${tenant.membershipId}` : null;
  const propertyHref =
    access && can(access, "property:read") ? `/properties/${property.id}` : null;
  const linkClass = "text-primary hover:underline";
  const leaseLink = (link: { id: string; reference: string } | null) =>
    link && (
      <Link href={`/leases/${link.id}`} className={cn(linkClass, "font-mono")}>
        {link.reference}
      </Link>
    );

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
              {tenantHref ? (
                <Link href={tenantHref} className="hover:text-foreground hover:underline">
                  {tenant.name}
                </Link>
              ) : (
                tenant.name
              )}{" "}
              ·{" "}
              {propertyHref ? (
                <Link href={propertyHref} className="hover:text-foreground hover:underline">
                  {property.name} · {unit.label}
                </Link>
              ) : (
                <>
                  {property.name} · {unit.label}
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={initialTab}>
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
          <TabsTrigger value="contract" className="flex-none gap-2 px-3">
            Contract
            {contracts.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {contracts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex-none gap-2 px-3">
            Documents
            {papers.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {papers.length}
              </span>
            )}
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
                      tenantHref ? (
                        <Link href={tenantHref} className={linkClass}>
                          {tenant.name}
                        </Link>
                      ) : (
                        tenant.name
                      )
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
                      propertyHref ? (
                        <Link href={propertyHref} className={linkClass}>
                          {property.name}
                        </Link>
                      ) : (
                        property.name
                      )
                    }
                  />
                  <DetailRow
                    label="Unit"
                    value={
                      propertyHref ? (
                        <Link
                          href={`${propertyHref}/units/${unit.id}`}
                          className={linkClass}
                        >
                          {unit.label}
                        </Link>
                      ) : (
                        unit.label
                      )
                    }
                  />
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
            <LeaseTermsCard
              lease={lease}
              renewal={{
                renewedFrom: leaseLink(lease.renewedFrom),
                renewedTo: leaseLink(lease.renewedTo),
              }}
              className="grow"
            />

            {/* The invoice is part of what this lease *is*, so it reads here;
                the Billing tab is only the ledger. */}
            <InvoiceCard invoice={invoice} className="grow" />
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
                    pendingClaims: invoice.pendingClaims.map((claim) => ({
                      ...claim,
                      paidAt: claim.paidAt.toISOString(),
                    })),
                  }
                : null
            }
          />
        </TabsContent>

        <TabsContent value="contract" className="pt-5">
          <ContractTab
            leaseId={lease.id}
            assetTypes={contractTypes}
            documents={contracts}
          />
        </TabsContent>

        <TabsContent value="documents" className="pt-5">
          <DocumentsPanel
            subjectType="LEASE"
            subjectId={lease.id}
            assetTypes={paperTypes}
            documents={papers}
            emptyMessage="No documents yet. Upload the signed agreement, an amendment or a termination notice to keep it on file."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
