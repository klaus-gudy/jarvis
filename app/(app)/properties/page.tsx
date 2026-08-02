import Link from "next/link";
import { redirect } from "next/navigation";
import { BuildingIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PropertyCard } from "@/components/properties/property-card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import type { PropertyType } from "@/lib/generated/prisma/enums";
import { getProperties } from "@/lib/properties";
import { cn } from "@/lib/utils";

const FILTERS = [
  { label: "All properties", value: undefined, href: "/properties" },
  { label: "Residential", value: "RESIDENTIAL", href: "/properties?type=residential" },
  { label: "Commercial", value: "COMMERCIAL", href: "/properties?type=commercial" },
] as const;

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.activeOrgId) {
    return (
      <EmptyState
        icon={BuildingIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    );
  }

  const typeParam = (await searchParams).type?.toUpperCase();
  const activeType =
    typeParam === "RESIDENTIAL" || typeParam === "COMMERCIAL"
      ? (typeParam as PropertyType)
      : undefined;

  const properties = await getProperties(user.activeOrgId, activeType);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const isActive = filter.value === activeType;
            return (
              <Button
                key={filter.label}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={cn("rounded-full", !isActive && "bg-background")}
                nativeButton={false}
                render={<Link href={filter.href} />}
              >
                {filter.label}
              </Button>
            );
          })}
        </div>
        <Button size="sm" nativeButton={false} render={<Link href="/properties/new" />}>
          Add property
        </Button>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          icon={BuildingIcon}
          title={activeType ? "No matching properties" : "No properties yet"}
          description={
            activeType
              ? "No properties of this type. Try a different filter."
              : "Add your first building to start tracking its units and leases."
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}
