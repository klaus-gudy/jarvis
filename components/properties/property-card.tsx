import Link from "next/link";

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
    >
      <Link href={`/properties/${property.id}`} className="block p-5 outline-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PropertyIcon
              category={property.category}
              type={property.type}
              className="size-5"
            />
          </div>
          <Badge variant="secondary" className="rounded-full font-normal">
            {property.type === "COMMERCIAL" ? "Commercial" : "Residential"}
          </Badge>
        </div>

        <div className="mt-4 space-y-0.5">
          <h3 className="font-semibold tracking-tight">{property.name}</h3>
          <p className="text-sm text-muted-foreground">
            {property.category} · {property.address}
          </p>
          <p className="text-sm text-muted-foreground">Owner · {property.ownerName}</p>
        </div>

        <div className="mt-5 space-y-2">
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
              className="h-full rounded-full bg-secondary-foreground transition-all"
              style={{ width: `${property.occupancyRate}%` }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between border-t pt-4">
          <div>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {formatCurrency(property.monthlyRentRoll)}
            </p>
            <p className="text-xs text-muted-foreground">Monthly rent roll</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold tabular-nums">
              {property.vacantUnits}
            </p>
            <p className="text-xs text-muted-foreground">Vacant</p>
          </div>
        </div>
      </Link>
    </Card>
  );
}
