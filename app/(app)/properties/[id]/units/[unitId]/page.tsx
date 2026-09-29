import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, DoorOpenIcon } from "lucide-react";

import { DetailRow, orDash } from "@/components/detail-row";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { PhotoGallery } from "@/components/documents/photo-gallery";
import { ExpiryTag } from "@/components/leases/expiry-tag";
import { UnitActions } from "@/components/properties/unit-actions";
import { UnitLeasesTab } from "@/components/properties/unit-leases-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser, SESSION_EXPIRED_PATH } from "@/lib/auth/session";
import { can, requireStaffPage } from "@/lib/authz";
import { listAssetTypes } from "@/lib/asset-types";
import { listDocuments } from "@/lib/documents";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { getUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

/** Tabs a link may open on, e.g. `?tab=photos`. */
const TABS = ["overview", "leases", "photos", "documents"] as const;

/**
 * A unit's own page, laid out like the property page it belongs to: identity
 * card with actions, then Overview / Leases / Photos / Documents tabs.
 */
export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; unitId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const access = await requireStaffPage("property:read");
  const user = await getCurrentUser();
  if (!user) redirect(SESSION_EXPIRED_PATH);
  if (!user.activeOrgId) redirect("/properties");

  const { id, unitId } = await params;
  const unit = await getUnit(user.activeOrgId, id, unitId);
  if (!unit) notFound();

  // Links only where the destination would open, as on the lease page.
  const canReadLeases = Boolean(access && can(access, "lease:read"));
  const canReadTenants = Boolean(access && can(access, "tenant:read"));
  const requestedTab = (await searchParams).tab;
  const initialTab =
    TABS.filter((tab) => tab !== "leases" || canReadLeases).find(
      (tab) => tab === requestedTab
    ) ?? "overview";

  // One query, split the way the property page splits Images from Documents.
  const [assets, unitTypes] = await Promise.all([
    listDocuments(user.activeOrgId, "UNIT", unit.id),
    listAssetTypes(user.activeOrgId, "UNIT"),
  ]);

  const serialise = (asset: (typeof assets)[number]) => ({
    ...asset,
    // Dates must be serialisable to cross the server/client boundary.
    createdAt: asset.createdAt.toISOString(),
  });

  const photos = assets.filter((asset) => asset.assetType.isPhoto).map(serialise);
  const papers = assets.filter((asset) => !asset.assetType.isPhoto).map(serialise);
  const photoTypes = unitTypes.filter((type) => type.isPhoto);
  const documentTypes = unitTypes.filter((type) => !type.isPhoto);

  const { property, currentLease } = unit;
  const isOccupied = currentLease !== null;
  const propertyHref = `/properties/${property.id}`;
  const linkClass = "text-primary hover:underline";

  const spec = [
    unit.unitType,
    unit.sizeSqm != null ? `${unit.sizeSqm} m²` : null,
    `${formatCurrencyFull(unit.rentAmount)}/mo`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        className="w-fit max-w-full text-muted-foreground"
        nativeButton={false}
        render={<Link href={`${propertyHref}?tab=units`} />}
      >
        <ArrowLeftIcon />
        <span className="min-w-0 truncate">{property.name}</span>
      </Button>

      <Card>
        {/* Same two-rows-on-a-phone header as the property page. */}
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:size-12">
              <DoorOpenIcon className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="truncate text-base font-semibold tracking-tight sm:text-xl">
                  Unit {unit.label}
                </h2>
                <StatusPill occupied={isOccupied} />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                <Link href={propertyHref} className="hover:text-foreground hover:underline">
                  {property.name}
                </Link>
                {spec && ` · ${spec}`}
              </p>
            </div>
          </div>
          <UnitActions
            propertyId={property.id}
            unit={{
              id: unit.id,
              label: unit.label,
              rentAmount: unit.rentAmount,
              minTenureMonths: unit.minTenureMonths,
              autoRenew: unit.autoRenew,
              unitType: unit.unitType,
              floor: unit.floor,
              block: unit.block,
              sizeSqm: unit.sizeSqm,
              amenities: unit.amenities,
            }}
            isOccupied={isOccupied}
            leaseCount={unit.leases.length}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue={initialTab}>
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="overview" className="flex-none px-3">
            Overview
          </TabsTrigger>
          {canReadLeases && (
            <TabsTrigger value="leases" className="flex-none gap-2 px-3">
              Leases
              {/* Hidden at zero, like every other tab count. */}
              {unit.leases.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                  {unit.leases.length}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="photos" className="flex-none gap-2 px-3">
            Photos
            {photos.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {photos.length}
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

        <TabsContent value="overview" className="space-y-5 pt-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Unit details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <dl>
                  <DetailRow
                    label="Property"
                    value={
                      <Link href={propertyHref} className={linkClass}>
                        {property.name}
                      </Link>
                    }
                  />
                  <DetailRow label="Location" value={property.address} />
                  <DetailRow label="Type" value={orDash(unit.unitType)} />
                  <DetailRow
                    label="Size"
                    value={unit.sizeSqm != null ? `${unit.sizeSqm} m²` : "—"}
                  />
                  <DetailRow label="Block" value={orDash(unit.block)} />
                  <DetailRow label="Floor" value={orDash(unit.floor)} />
                  <DetailRow
                    label="Status"
                    value={<StatusPill occupied={isOccupied} />}
                  />
                </dl>
              </CardContent>
            </Card>

            {/* Money and terms on the right, identity on the left — the pairing
                the lease page uses. */}
            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="text-base">Rent & terms</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <dl>
                    <DetailRow
                      label="Monthly rate"
                      value={
                        <span className="font-mono tabular-nums">
                          {formatCurrencyFull(unit.rentAmount)}
                        </span>
                      }
                    />
                    <DetailRow
                      label="Minimum tenure"
                      value={
                        unit.minTenureMonths != null
                          ? `${unit.minTenureMonths} month${unit.minTenureMonths === 1 ? "" : "s"}`
                          : "—"
                      }
                    />
                    <DetailRow label="Auto-renew" value={unit.autoRenew ? "On" : "Off"} />
                  </dl>
                </CardContent>
              </Card>

              <Card className="grow">
                <CardHeader className="border-b">
                  <CardTitle className="text-base">Current tenancy</CardTitle>
                </CardHeader>
                {currentLease ? (
                  <CardContent className="p-0">
                    <dl>
                      <DetailRow
                        label="Tenant"
                        value={
                          canReadTenants ? (
                            <Link
                              href={`/members/${currentLease.membershipId}`}
                              className={linkClass}
                            >
                              {currentLease.tenantName}
                            </Link>
                          ) : (
                            currentLease.tenantName
                          )
                        }
                      />
                      <DetailRow
                        label="Lease"
                        value={
                          canReadLeases ? (
                            <Link
                              href={`/leases/${currentLease.id}`}
                              className={cn(linkClass, "font-mono")}
                            >
                              {currentLease.reference}
                            </Link>
                          ) : (
                            <span className="font-mono">{currentLease.reference}</span>
                          )
                        }
                      />
                      <DetailRow
                        label="Term"
                        value={
                          <span className="inline-flex items-center gap-2">
                            {formatDate(currentLease.startDate)} →{" "}
                            {formatDate(currentLease.endDate)}
                            <ExpiryTag expiry={currentLease.expiry} />
                          </span>
                        }
                      />
                      <DetailRow
                        label="Agreed rent"
                        value={
                          <span className="font-mono tabular-nums">
                            {formatCurrencyFull(currentLease.monthlyRent)}
                          </span>
                        }
                      />
                    </dl>
                  </CardContent>
                ) : (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Nobody is renting this unit right now.
                    </p>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Unit amenities</CardTitle>
            </CardHeader>
            <CardContent>
              {unit.amenities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No amenities have been listed for this unit.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {unit.amenities.map((amenity) => (
                    <li
                      key={amenity}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm"
                    >
                      <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      {amenity}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canReadLeases && (
          <TabsContent value="leases" className="pt-5">
            <UnitLeasesTab
              leases={unit.leases.map((lease) => ({
                id: lease.id,
                reference: lease.reference,
                tenantName: lease.tenantName,
                // Dates must be serialisable to cross the server/client boundary.
                startDate: lease.startDate.toISOString(),
                endDate: lease.endDate.toISOString(),
                durationMonths: lease.durationMonths,
                monthlyRent: lease.monthlyRent,
                leaseAmount: lease.leaseAmount,
                status: lease.status,
                expiry: lease.expiry,
              }))}
            />
          </TabsContent>
        )}

        <TabsContent value="photos" className="pt-5">
          <PhotoGallery
            subjectType="UNIT"
            subjectId={unit.id}
            assetTypes={photoTypes}
            photos={photos}
            emptyMessage="No photos yet. Add a few so this unit can be shown without a visit."
          />
        </TabsContent>

        <TabsContent value="documents" className="pt-5">
          <DocumentsPanel
            subjectType="UNIT"
            subjectId={unit.id}
            assetTypes={documentTypes}
            documents={papers}
            emptyMessage="No documents yet. Upload a floor plan or an inspection report to keep it on file."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** The property page's Active/Inactive pill, read as Occupied/Vacant. */
function StatusPill({ occupied }: { occupied: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        occupied
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          occupied ? "bg-emerald-500" : "bg-muted-foreground"
        )}
      />
      {occupied ? "Occupied" : "Vacant"}
    </span>
  );
}
