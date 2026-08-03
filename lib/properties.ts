import type { PropertyStatus, PropertyType } from "@/lib/generated/prisma/enums";
import { getOrganizationOwnerName } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
} from "@/lib/properties-schemas";

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
  filters: { type?: PropertyType; status?: PropertyStatus; q?: string } = {}
): Promise<PropertySummary[]> {
  const now = new Date();
  const { type, status, q } = filters;

  const [properties, ownerName] = await Promise.all([
    prisma.property.findMany({
      where: {
        organizationId,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { address: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "asc" },
      include: {
        units: {
          select: {
            rentAmount: true,
            leases: { where: activeLeaseFilter(now), select: { id: true }, take: 1 },
          },
        },
      },
    }),
    // Resolved once for the whole list rather than per property.
    getOrganizationOwnerName(organizationId),
  ]);

  return properties.map((property) => {
    const totalUnits = property.units.length;
    const occupiedUnits = property.units.filter((u) => u.leases.length > 0).length;

    return {
      id: property.id,
      name: property.name,
      type: property.type,
      category: property.category,
      address: property.address,
      ownerName,
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

  const [property, ownerName] = await Promise.all([
    prisma.property.findFirst({
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
    }),
    getOrganizationOwnerName(organizationId),
  ]);

  if (!property) return null;

  const units = property.units.map((unit) => {
    const lease = unit.leases[0] ?? null;
    return {
      id: unit.id,
      label: unit.label,
      rentAmount: unit.rentAmount,
      minTenureMonths: unit.minTenureMonths,
      unitType: unit.unitType,
      floor: unit.floor,
      block: unit.block,
      sizeSqm: unit.sizeSqm,
      amenities: unit.amenities,
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
    ownerName,
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

export async function createProperty(
  organizationId: string,
  input: CreatePropertyInput
) {
  return prisma.property.create({
    data: { ...input, organizationId },
    select: { id: true },
  });
}

/**
 * Update and delete both scope by organizationId first, so a caller holding a
 * valid id from another org gets "not found" rather than someone else's data.
 */
export async function updateProperty(
  organizationId: string,
  propertyId: string,
  input: UpdatePropertyInput
) {
  const existing = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.property.update({
    where: { id: existing.id },
    data: input,
    select: { id: true },
  });
}

export async function deleteProperty(organizationId: string, propertyId: string) {
  const existing = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    select: { id: true },
  });
  if (!existing) return null;

  // Units and their leases cascade via the schema's onDelete rules.
  await prisma.property.delete({ where: { id: existing.id } });
  return existing;
}

/** Occupancy reads as a health signal, so colour it rather than leaving it neutral. */
export function occupancyTone(rate: number) {
  if (rate >= 80) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (rate >= 50) return { text: "text-amber-600 dark:text-amber-500", bar: "bg-amber-500" };
  return { text: "text-red-600 dark:text-red-400", bar: "bg-red-500" };
}
