import { audit, createdBy, diff, snapshot, updatedBy, type Actor } from "@/lib/audit";
import type { PropertyStatus, PropertyType } from "@/lib/generated/prisma/enums";
import { getProfilePhotoIds } from "@/lib/documents";
import { leaseExpiry, leaseReference } from "@/lib/leases";
import { getOrganizationOwnerName } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
} from "@/lib/properties-schemas";

/**
 * A lease counts as occupying its unit when it has started and hasn't ended.
 *
 * The membership is also constrained to the same organization: nothing in the
 * schema stops a Lease from joining a Membership in org A to a Unit in org B,
 * and without this filter such a row would surface another org's member name
 * on this org's property page.
 */
function activeLeaseFilter(now: Date, organizationId: string) {
  return {
    startDate: { lte: now },
    // Leases are always fixed-term, so there is no open-ended case to allow for.
    endDate: { gte: now },
    membership: { organizationId },
  };
}

export type PropertySummary = {
  id: string;
  name: string;
  type: PropertyType;
  category: string;
  address: string;
  ownerName: string;
  /**
   * The three below are not shown on the card — they are what its Edit dialog
   * seeds from, so opening it needs no second fetch and the form can't flash
   * empty fields before the real values land.
   */
  status: PropertyStatus;
  description: string | null;
  amenities: string[];
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
            leases: {
              where: activeLeaseFilter(now, organizationId),
              select: { id: true },
              take: 1,
            },
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
      status: property.status,
      description: property.description,
      amenities: property.amenities,
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
          orderBy: { updatedAt: "desc" },
          include: {
            leases: {
              where: activeLeaseFilter(now, organizationId),
              take: 1,
              include: { membership: { include: { user: true } } },
            },
            /**
             * Enough to render the unit's photo strip, and no more: the id is
             * the image URL and the name is its alt text. Loaded with the
             * units rather than fetched per row, because the view dialog opens
             * from a table that is already in memory and a spinner there would
             * be a round trip to show four thumbnails.
             */
            fileAssets: {
              // Any photo type, not the seeded `UNIT_PHOTO` by name: an
              // organization that added its own unit photo type should see
              // those here too, and `isPhoto` is what the carousel and the
              // narrow MIME allowlist already key off.
              where: { assetType: { isPhoto: true } },
              orderBy: { createdAt: "asc" },
              select: { id: true, fileName: true },
            },
          },
        },
      },
    }),
    getOrganizationOwnerName(organizationId),
  ]);

  if (!property) return null;

  // For the tenant hover cards, batched per list rather than per unit.
  const photoIds = await getProfilePhotoIds(
    organizationId,
    property.units.flatMap((unit) => unit.leases.map((lease) => lease.membershipId))
  );

  const units = property.units.map((unit) => {
    const lease = unit.leases[0] ?? null;
    return {
      id: unit.id,
      label: unit.label,
      rentAmount: unit.rentAmount,
      minTenureMonths: unit.minTenureMonths,
      autoRenew: unit.autoRenew,
      unitType: unit.unitType,
      floor: unit.floor,
      block: unit.block,
      sizeSqm: unit.sizeSqm,
      amenities: unit.amenities,
      photos: unit.fileAssets,
      isOccupied: lease !== null,
      tenantName: lease?.membership.user.name ?? lease?.membership.user.email ?? null,
      // For links from the unit to its tenant and its lease.
      tenantMembershipId: lease?.membershipId ?? null,
      tenantPhone: lease?.membership.user.phone ?? null,
      tenantEmail: lease?.membership.user.email ?? null,
      tenantPhotoId: lease ? (photoIds.get(lease.membershipId) ?? null) : null,
      /** What the lease hover card shows; null when vacant. */
      lease: lease
        ? {
            reference: leaseReference(lease.id),
            status: lease.status,
            startDate: lease.startDate.toISOString(),
            endDate: lease.endDate.toISOString(),
            durationMonths: lease.durationMonths,
            monthlyRent: lease.monthlyRent,
            expiry: leaseExpiry(now, lease.startDate, lease.endDate),
          }
        : null,
      leaseId: lease?.id ?? null,
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
  input: CreatePropertyInput,
  actor: Actor
) {
  return prisma.$transaction(async (tx) => {
    const property = await tx.property.create({
      data: { ...input, organizationId, ...createdBy(actor) },
    });
    await audit(tx, {
      organizationId,
      actor,
      action: "property.created",
      entityType: "Property",
      entityId: property.id,
      changes: snapshot(property),
    });
    return { id: property.id };
  });
}

/**
 * Update and delete both scope by organizationId first, so a caller holding a
 * valid id from another org gets "not found" rather than someone else's data.
 */
export async function updateProperty(
  organizationId: string,
  propertyId: string,
  input: UpdatePropertyInput,
  actor: Actor
) {
  const existing = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
  });
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    const property = await tx.property.update({
      where: { id: existing.id },
      data: { ...input, ...updatedBy(actor) },
      select: { id: true },
    });
    await audit(tx, {
      organizationId,
      actor,
      action: "property.updated",
      entityType: "Property",
      entityId: existing.id,
      changes: diff(existing, input),
    });
    return property;
  });
}

export async function deleteProperty(
  organizationId: string,
  propertyId: string,
  actor: Actor
) {
  const existing = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
  });
  if (!existing) return null;

  // Units and their leases cascade via the schema's onDelete rules.
  await prisma.$transaction(async (tx) => {
    await tx.property.delete({ where: { id: existing.id } });
    await audit(tx, {
      organizationId,
      actor,
      action: "property.deleted",
      entityType: "Property",
      entityId: existing.id,
      changes: snapshot(existing),
    });
  });
  return { id: existing.id };
}
