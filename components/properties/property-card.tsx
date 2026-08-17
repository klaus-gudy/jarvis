import Link from "next/link";

import { PropertyCardActions } from "@/components/properties/property-card-actions";
import { PropertyIcon } from "@/components/properties/property-icon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { PropertySummary } from "@/lib/properties";

export function PropertyCard({ property }: { property: PropertySummary }) {
  return (
    <Card
      className="gap-0 p-0 transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring"
      data-testid="property-card"
      data-tour="property-card"
    >
      <Link href={`/properties/${property.id}`} className="block p-4 outline-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PropertyIcon
              category={property.category}
              type={property.type}
              className="size-4.5"
            />
          </div>
          <Badge variant="secondary" className="rounded-full font-normal">
            {property.type === "COMMERCIAL" ? "Commercial" : "Residential"}
          </Badge>
        </div>

        <div className="mt-3 space-y-0.5">
          <h3 className="font-semibold tracking-tight">{property.name}</h3>
          <p className="text-sm text-muted-foreground">
            {property.category} · {property.address}
          </p>
          <p className="text-sm text-muted-foreground">Owner · {property.ownerName}</p>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {property.occupiedUnits}/{property.totalUnits} occupied
            </span>
            <span className="font-medium tabular-nums text-secondary-foreground">
              {property.occupancyRate}%
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={property.occupancyRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${property.name} occupancy`}
          >
            <div
              className="h-full rounded-full bg-stat-accent transition-all"
              style={{ width: `${property.occupancyRate}%` }}
            />
          </div>
        </div>

      </Link>

      {/*
       * The stats sit here rather than inside the link above, alongside the
       * actions — a <button> inside an <a> is invalid markup, and nesting them
       * would make every action click navigate. Keeping all three in one row
       * is what the card gains by moving the stats out.
       */}
      <div className="flex items-end justify-between gap-3 border-t px-4 py-3">
        <div className="flex items-end gap-4">
          <div>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {formatCurrency(property.monthlyRentRoll)}
            </p>
            <p className="text-xs text-muted-foreground">Monthly rent roll</p>
          </div>
          <div>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {property.vacantUnits}
            </p>
            <p className="text-xs text-muted-foreground">Vacant</p>
          </div>
        </div>

        <PropertyCardActions property={property} />
      </div>
    </Card>
  );
}
