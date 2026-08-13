"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrencyFull } from "@/lib/format";
import type { UnitRow } from "@/components/properties/unit-columns";

/**
 * A unit as one card, for the mobile list on a property's Units tab.
 *
 * Keeps the table's five columns and nothing more — floor, block, tenure and
 * amenities stay where they already were, in the View dialog, which the mobile
 * actions sheet reaches in one tap.
 */
export function UnitCard({ unit }: { unit: UnitRow }) {
  const spec = [unit.unitType, unit.sizeSqm != null ? `${unit.sizeSqm} m²` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{unit.label}</p>
          {spec && (
            <p className="truncate text-xs text-muted-foreground">{spec}</p>
          )}
        </div>
        <Badge
          variant={unit.status === "Occupied" ? "secondary" : "outline"}
          className="shrink-0 rounded-full font-normal"
        >
          {unit.status}
        </Badge>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-xs text-muted-foreground">
          {unit.tenantName ?? <span className="italic">Nobody in it</span>}
        </span>
        <span className="shrink-0 font-mono text-sm tabular-nums">
          {formatCurrencyFull(unit.rentAmount)}
          <span className="text-xs text-muted-foreground">/mo</span>
        </span>
      </div>
    </div>
  );
}
