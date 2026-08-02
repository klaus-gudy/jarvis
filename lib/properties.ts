import type { PropertyType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/** A lease counts as occupying its unit when it has started and hasn't ended. */
function activeLeaseFilter(now: Date) {
  return {
    startDate: { lte: now },
    OR: [{ endDate: null }, { endDate: { gte: now } }],
  };
}

export type PropertySummary = {
  id: string;
  name: string;
  type: PropertyType;
  category: string;
  address: string;
  ownerName: string;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  monthlyRentRoll: number;
};

export async function getProperties(
  organizationId: string,
  type?: PropertyType
): Promise<PropertySummary[]> {
  const now = new Date();

  const properties = await prisma.property.findMany({
    where: { organizationId, ...(type ? { type } : {}) },
    orderBy: { createdAt: "asc" },
    include: {
      units: {
        select: {
          rentAmount: true,
          leases: { where: activeLeaseFilter(now), select: { id: true }, take: 1 },
        },
      },
    },
  });

  return properties.map((property) => {
    const totalUnits = property.units.length;
    const occupiedUnits = property.units.filter((u) => u.leases.length > 0).length;

    return {
      id: property.id,
      name: property.name,
      type: property.type,
      category: property.category,
      address: property.address,
      ownerName: property.ownerName,
      totalUnits,
      occupiedUnits,
      vacantUnits: totalUnits - occupiedUnits,
      occupancyRate: totalUnits === 0 ? 0 : Math.round((occupiedUnits / totalUnits) * 100),
      // Rent roll is what the property actually bills each month, so only
      // occupied units count — vacant ones earn nothing.
      monthlyRentRoll: property.units
        .filter((u) => u.leases.length > 0)
        .reduce((sum, u) => sum + u.rentAmount, 0),
    };
  });
}

/** Scoped by organization so one org can never read another's property. */
export async function getProperty(organizationId: string, propertyId: string) {
  const now = new Date();

  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    include: {
      units: {
        orderBy: { label: "asc" },
        include: {
          leases: {
            where: activeLeaseFilter(now),
            take: 1,
            include: { membership: { include: { user: true } } },
          },
        },
      },
    },
  });

  if (!property) return null;

  const units = property.units.map((unit) => {
    const lease = unit.leases[0] ?? null;
    return {
      id: unit.id,
      label: unit.label,
      rentAmount: unit.rentAmount,
      isOccupied: lease !== null,
      tenantName: lease?.membership.user.name ?? lease?.membership.user.email ?? null,
      leaseStart: lease?.startDate ?? null,
      leaseEnd: lease?.endDate ?? null,
    };
  });

  const occupiedUnits = units.filter((u) => u.isOccupied).length;

  return {
    id: property.id,
    name: property.name,
    type: property.type,
    category: property.category,
    address: property.address,
    ownerName: property.ownerName,
    status: property.status,
    description: property.description,
    amenities: property.amenities,
    createdAt: property.createdAt,
    units,
    totalUnits: units.length,
    occupiedUnits,
    vacantUnits: units.length - occupiedUnits,
    occupancyRate: units.length === 0 ? 0 : Math.round((occupiedUnits / units.length) * 100),
    monthlyRentRoll: units
      .filter((u) => u.isOccupied)
      .reduce((sum, u) => sum + u.rentAmount, 0),
    potentialRentRoll: units.reduce((sum, u) => sum + u.rentAmount, 0),
  };
}

/** Occupancy reads as a health signal, so colour it rather than leaving it neutral. */
export function occupancyTone(rate: number) {
  if (rate >= 80) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (rate >= 50) return { text: "text-amber-600 dark:text-amber-500", bar: "bg-amber-500" };
  return { text: "text-red-600 dark:text-red-400", bar: "bg-red-500" };
}
