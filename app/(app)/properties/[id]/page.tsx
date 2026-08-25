import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";

import { DetailRow } from "@/components/detail-row";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { PhotoGallery } from "@/components/documents/photo-gallery";
import { PropertyActions } from "@/components/properties/property-actions";
import { PropertyIcon } from "@/components/properties/property-icon";
import { UnitsTable } from "@/components/properties/units-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/session";
import { listAssetTypes } from "@/lib/asset-types";
import { listDocuments } from "@/lib/documents";
import { getProperty } from "@/lib/properties";
import { cn } from "@/lib/utils";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.activeOrgId) redirect("/properties");

  const { id } = await params;
  const property = await getProperty(user.activeOrgId, id);
  if (!property) notFound();

  const isActive = property.status === "ACTIVE";

  // Photos and papers come from one query and split here: the Images tab and
  // the Documents tab are two ways of reading one table, not two sources.
  const [assets, propertyTypes, unitTypes] = await Promise.all([
    listDocuments(user.activeOrgId, "PROPERTY", property.id),
    listAssetTypes(user.activeOrgId, "PROPERTY"),
    listAssetTypes(user.activeOrgId, "UNIT"),
  ]);

  const serialise = (asset: (typeof assets)[number]) => ({
    ...asset,
    // Dates must be serialisable to cross the server/client boundary.
    createdAt: asset.createdAt.toISOString(),
  });

  // `isPhoto` is a column on the type now, so a photo type an organization
  // added of its own lands in the Images tab without anything here listing it.
  const photos = assets.filter((asset) => asset.assetType.isPhoto).map(serialise);
  const papers = assets.filter((asset) => !asset.assetType.isPhoto).map(serialise);

  const photoTypes = propertyTypes.filter((type) => type.isPhoto);
  const documentTypes = propertyTypes.filter((type) => !type.isPhoto);
  const unitPhotoTypes = unitTypes.filter((type) => type.isPhoto);

  const details = [
    { label: "Property type", value: property.category },
    {
      label: "Category",
      value: property.type === "COMMERCIAL" ? "Commercial" : "Residential",
    },
    { label: "Location", value: property.address },
    { label: "Ownership", value: property.ownerName },
  ];

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href="/properties" />}
      >
        <ArrowLeftIcon />
        All properties
      </Button>

      <Card>
        <CardContent className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PropertyIcon
              category={property.category}
              type={property.type}
              className="size-6"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {property.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {property.address} · {property.category} · Owner: {property.ownerName}
            </p>
          </div>
          <PropertyActions
            propertyId={property.id}
            propertyName={property.name}
            unitCount={property.totalUnits}
            ownerName={property.ownerName}
            initialValues={{
              name: property.name,
              type: property.type,
              category: property.category,
              address: property.address,
              status: property.status,
              description: property.description ?? "",
              amenities: property.amenities,
            }}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="overview" className="flex-none px-3">
            Overview
          </TabsTrigger>
          <TabsTrigger value="units" className="flex-none gap-2 px-3">
            Units
            {/* Hidden at zero — a "0" beside a tab reads as a problem rather
                than as a total, same as the Billing and Users tabs. */}
            {property.totalUnits > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {property.totalUnits}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="images" className="flex-none gap-2 px-3">
            Images
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
                <CardTitle className="text-base">Property details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <dl>
                  {details.map((detail) => (
                    <DetailRow
                      key={detail.label}
                      label={detail.label}
                      value={detail.value}
                    />
                  ))}
                  <DetailRow
                    label="Status"
                    value={
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                          isActive
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 rounded-full",
                            isActive ? "bg-emerald-500" : "bg-muted-foreground"
                          )}
                        />
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    }
                  />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {property.description ?? "No description has been added yet."}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">General facility amenities</CardTitle>
            </CardHeader>
            <CardContent>
              {property.amenities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No amenities have been listed for this property.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {property.amenities.map((amenity) => (
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

        <TabsContent value="units" className="pt-5">
          <UnitsTable
            propertyId={property.id}
            units={property.units.map((unit) => ({
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
              status: unit.isOccupied ? "Occupied" : "Vacant",
              tenantName: unit.tenantName,
              // Dates must be serialisable to cross the server/client boundary.
              leaseStart: unit.leaseStart ? unit.leaseStart.toISOString() : null,
              photos: unit.photos,
            }))}
            photoAssetTypes={unitPhotoTypes}
          />
        </TabsContent>

        {/* Its own tab, not a band above the documents table: photos are
            browsed and papers are filed, and stacking the two meant the table
            started below the fold on every property that had pictures. */}
        <TabsContent value="images" className="pt-5">
          <PhotoGallery
            subjectType="PROPERTY"
            subjectId={property.id}
            assetTypes={photoTypes}
            photos={photos}
            emptyMessage="No photos yet. Add a few so this property is recognisable at a glance."
          />
        </TabsContent>

        <TabsContent value="documents" className="pt-5">
          <DocumentsPanel
            subjectType="PROPERTY"
            subjectId={property.id}
            assetTypes={documentTypes}
            documents={papers}
            emptyMessage="No documents yet. Upload the title deed or a permit to keep it on file."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
