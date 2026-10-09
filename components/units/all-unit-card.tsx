"use client";

import { ExpiryTag } from "@/components/leases/expiry-tag";
import { nextTerm, occupantTerm } from "@/components/units/unit-occupancy";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyFull } from "@/lib/format";
import type { UnitListRow } from "@/lib/units";

/**
 * A unit as one card, for the mobile list on the org-wide Units page: the
 * property page's unit card with the property named, and the occupancy line
 * saying who is (or was last) in it and until when.
 */
export function AllUnitCard({ unit }: { unit: UnitListRow }) {
  const spec = [unit.propertyName, unit.unitType].filter(Boolean).join(" · ");
  const next = nextTerm(unit);

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{unit.label}</p>
          <p className="truncate text-xs text-muted-foreground">{spec}</p>
        </div>
        <Badge
          variant={unit.status === "Occupied" ? "secondary" : "outline"}
          className="shrink-0 rounded-full font-normal"
        >
          {unit.status}
        </Badge>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-xs text-muted-foreground">
          {unit.occupant ? (
            <>
              <p className="truncate text-foreground">{unit.occupant.tenantName}</p>
              <p className="flex flex-wrap items-center gap-1.5">
                {occupantTerm(unit)}
                <ExpiryTag expiry={unit.occupant.expiry} />
              </p>
            </>
          ) : (
            <p className="italic">Never let</p>
          )}
          {next && <p className="truncate">{next}</p>}
        </div>
        <span className="shrink-0 font-mono text-sm tabular-nums">
          {formatCurrencyFull(unit.rentAmount)}
          <span className="text-xs text-muted-foreground">/mo</span>
        </span>
      </div>
    </div>
  );
}
