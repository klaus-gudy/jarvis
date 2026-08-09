"use client";

import { CheckIcon } from "lucide-react";

import { DetailRow, orDash } from "@/components/detail-row";
import { Badge } from "@/components/ui/badge";
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
}: {
  unit: UnitRow | null;
  onOpenChange: (open: boolean) => void;
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
