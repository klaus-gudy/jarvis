"use client";

import { CheckIcon, ImagePlusIcon } from "lucide-react";

import { DetailRow, orDash } from "@/components/detail-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyFull } from "@/lib/format";
import type { UnitRow } from "@/components/properties/unit-columns";

/**
 * Read-only counterpart to the add/edit form — same fields, same order, so a
 * unit reads back the way it was entered. Exists because the table only shows
 * label/type/status/tenant/rent; floor, block, size, minimum tenure and
 * amenities have nowhere else to be seen.
 */
export function UnitViewDialog({
  unit,
  onOpenChange,
  onAddPhotos,
}: {
  unit: UnitRow | null;
  onOpenChange: (open: boolean) => void;
  /** Hands the unit back so the table can open the picker for it. */
  onAddPhotos: (unit: UnitRow) => void;
}) {
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
                it than the rent does. This is also the only place they can be
                seen: a unit has no page of its own. */}
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
                          src={`/api/documents/${photo.id}`}
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
                  label="Auto-renew"
                  value={unit.autoRenew ? "On" : "Off"}
                />
                <DetailRow label="Status" value={unit.status} />
                <DetailRow label="Tenant" value={orDash(unit.tenantName)} />
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
      </DialogContent>
    </Dialog>
  );
}
