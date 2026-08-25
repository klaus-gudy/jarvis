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
import { isPhotoType, PROPERTY_DOCUMENT_TYPES } from "@/lib/document-options";
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

  // Photos and papers come from one query and split here: the carousel and the
  // documents table are two ways of reading the same table, not two sources.
  const assets = await listDocuments(user.activeOrgId, "property", property.id);
  const serialise = (asset: (typeof assets)[number]) => ({
    ...asset,
    // Dates must be serialisable to cross the server/client boundary.
    createdAt: asset.createdAt.toISOString(),
  });
  const photos = assets.filter((asset) => isPhotoType(asset.assetType)).map(serialise);
  const papers = assets.filter((asset) => !isPhotoType(asset.assetType)).map(serialise);

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
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
              {property.totalUnits}
            </span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex-none gap-2 px-3">
            Documents
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
              {assets.length}
            </span>
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
          />
        </TabsContent>

        {/* Photos above papers: a title deed is filed and forgotten, whereas
            the pictures are what anyone actually opens this tab to look at. */}
        <TabsContent value="documents" className="space-y-6 pt-5">
          <PhotoGallery
            subjectType="property"
            subjectId={property.id}
            assetType="PROPERTY_PHOTO"
            photos={photos}
            title="Photos"
            emptyMessage="No photos yet. Add a few so this property is recognisable at a glance."
          />

          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">Documents</h3>
            <DocumentsPanel
              subjectType="property"
              subjectId={property.id}
              assetTypes={PROPERTY_DOCUMENT_TYPES}
              documents={papers}
              emptyMessage="No documents yet. Upload the title deed or a permit to keep it on file."
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
