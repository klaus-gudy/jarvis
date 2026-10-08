"use client";

import Link from "next/link";
import { ArrowRightIcon, CheckIcon, ImagePlusIcon } from "lucide-react";

import { DetailRow, orDash } from "@/components/detail-row";
import { LeaseHoverCard } from "@/components/hover-cards/lease-hover-card";
import { TenantHoverCard } from "@/components/hover-cards/tenant-hover-card";
import { useCan } from "@/components/permissions-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyFull } from "@/lib/format";
import { documentImageSrc } from "@/lib/document-options";
import type { UnitRow } from "@/components/properties/unit-columns";

/**
 * Read-only counterpart to the add/edit form — same fields, same order, so a
 * unit reads back the way it was entered. The quick look from the Units table;
 * "View more" leads to the unit's own page for its lease history, the full
 * gallery and its documents.
 */
export function UnitViewDialog({
  unit,
  propertyId,
  onOpenChange,
  onAddPhotos,
}: {
  unit: UnitRow | null;
  propertyId: string;
  onOpenChange: (open: boolean) => void;
  /** Hands the unit back so the table can open the picker for it. */
  onAddPhotos: (unit: UnitRow) => void;
}) {
  const canReadTenants = useCan("tenant:read");
  const canReadLeases = useCan("lease:read");

  return (
    <Dialog open={unit !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{unit?.label}</DialogTitle>
          <DialogDescription>Unit details</DialogDescription>
        </DialogHeader>

        {unit && (
          <div className="space-y-4">
            {/* Photos first — a unit is a room, and a picture says more about
                it than the rent does. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Photos
                  {unit.photos.length > 0 && (
                    <span className="ml-1.5 text-muted-foreground tabular-nums">
                      {unit.photos.length}
                    </span>
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddPhotos(unit)}
                >
                  <ImagePlusIcon />
                  Add photos
                </Button>
              </div>

              {unit.photos.length === 0 ? (
                <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                  No photos yet.
                </p>
              ) : (
                <ul className="flex gap-2 overflow-x-auto pb-1">
                  {unit.photos.map((photo) => (
                    <li key={photo.id} className="shrink-0">
                      {/* Opens the full image in a new tab rather than a second
                          dialog stacked on this one. */}
                      <a
                        href={`/api/documents/${photo.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block size-20 overflow-hidden rounded-md border transition-colors hover:border-primary"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={documentImageSrc(photo.id, 192)}
                          alt={photo.fileName}
                          className="size-full object-cover"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border">
              <dl>
                <DetailRow label="Unit name" value={unit.label} />
                <DetailRow
                  label="Monthly rate"
                  value={formatCurrencyFull(unit.rentAmount)}
                />
                <DetailRow label="Type" value={orDash(unit.unitType)} />
                <DetailRow
                  label="Size"
                  value={unit.sizeSqm != null ? `${unit.sizeSqm} m²` : "—"}
                />
                <DetailRow
                  label="Minimum tenure"
                  value={
                    unit.minTenureMonths != null
                      ? `${unit.minTenureMonths} month${unit.minTenureMonths === 1 ? "" : "s"}`
                      : "—"
                  }
                />
                <DetailRow label="Block" value={orDash(unit.block)} />
                <DetailRow label="Floor" value={orDash(unit.floor)} />
                <DetailRow
                  label="New leases auto-renew"
                  value={unit.autoRenew ? "Yes" : "No"}
                />
                <DetailRow label="Status" value={unit.status} />
                <DetailRow
                  label="Tenant"
                  value={
                    // A link and preview only where it can open: the member
                    // page needs `tenant:read`, the lease page `lease:read`.
                    unit.tenantName && unit.tenantMembershipId ? (
                      <TenantHoverCard
                        tenant={{
                          name: unit.tenantName,
                          phone: unit.tenantPhone,
                          email: unit.tenantEmail,
                          photoId: unit.tenantPhotoId,
                          context: `Unit ${unit.label}`,
                        }}
                        href={canReadTenants ? `/members/${unit.tenantMembershipId}` : null}
                        className="text-primary hover:underline"
                      />
                    ) : (
                      orDash(unit.tenantName)
                    )
                  }
                />
                {unit.leaseId && unit.lease && canReadLeases && (
                  <DetailRow
                    label="Current lease"
                    value={
                      <LeaseHoverCard
                        lease={{ ...unit.lease, subtitle: unit.tenantName }}
                        href={`/leases/${unit.leaseId}`}
                        className="font-mono text-primary hover:underline"
                      />
                    }
                  />
                )}
              </dl>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Unit amenities</p>
              {unit.amenities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No amenities have been listed for this unit.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {unit.amenities.map((amenity) => (
                    <li key={amenity}>
                      <Badge
                        variant="outline"
                        className="gap-1.5 rounded-full py-1 pl-2.5 font-normal"
                      >
                        <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        {amenity}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {unit && (
          // Stacks full width on a phone with "View more" on top (the footer is
          // `flex-col-reverse`), a right-aligned row from `sm`.
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Close</Button>} />
            <Button
              nativeButton={false}
              render={<Link href={`/properties/${propertyId}/units/${unit.id}`} />}
            >
              View more
              <ArrowRightIcon />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
