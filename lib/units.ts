import type { PropertyPreview } from "@/components/hover-cards/property-hover-card";
import type { UnitPreview } from "@/components/hover-cards/unit-hover-card";
import { audit, createdBy, diff, snapshot, updatedBy, type Actor } from "@/lib/audit";
import { getProfilePhotoIds } from "@/lib/documents";
import {
  leaseExpiry,
  leaseReference,
  type LeaseExpiry,
  type LeaseStatus,
} from "@/lib/leases";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/user-display";
import type { CreateUnitInput, UpdateUnitInput } from "@/lib/units-schemas";

/**
 * Units are reached through their property, so every mutation first proves the
 * property belongs to the caller's organization. A unit id from another org is
 * then indistinguishable from one that doesn't exist.
 */
async function assertPropertyInOrg(organizationId: string, propertyId: string) {
  return prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    select: { id: true },
  });
}

export async function createUnit(
  organizationId: string,
  propertyId: string,
  input: CreateUnitInput,
  actor: Actor
) {
  const property = await assertPropertyInOrg(organizationId, propertyId);
  if (!property) return { error: "not-found" as const };

  // label is unique per property, so a clash is a user error, not a crash.
  const clash = await prisma.unit.findFirst({
    where: { propertyId, label: input.label },
    select: { id: true },
  });
  if (clash) return { error: "duplicate-label" as const };

  const unit = await prisma.$transaction(async (tx) => {
    const created = await tx.unit.create({
      data: { ...input, propertyId, ...createdBy(actor) },
    });
    await audit(tx, {
      organizationId,
      actor,
      action: "unit.created",
      entityType: "Unit",
      entityId: created.id,
      changes: snapshot(created),
    });
    return { id: created.id };
  });
  return { unit };
}

export async function updateUnit(
  organizationId: string,
  propertyId: string,
  unitId: string,
  input: UpdateUnitInput,
  actor: Actor
) {
  const property = await assertPropertyInOrg(organizationId, propertyId);
  if (!property) return { error: "not-found" as const };

  const existing = await prisma.unit.findFirst({
    where: { id: unitId, propertyId },
  });
  if (!existing) return { error: "not-found" as const };

  if (input.label) {
    const clash = await prisma.unit.findFirst({
      where: { propertyId, label: input.label, NOT: { id: unitId } },
      select: { id: true },
    });
    if (clash) return { error: "duplicate-label" as const };
  }

  const unit = await prisma.$transaction(async (tx) => {
    const updated = await tx.unit.update({
      where: { id: existing.id },
      data: { ...input, ...updatedBy(actor) },
      select: { id: true },
    });
    await audit(tx, {
      organizationId,
      actor,
      action: "unit.updated",
      entityType: "Unit",
      entityId: existing.id,
      changes: diff(existing, input),
    });
    return updated;
  });
  return { unit };
}

export async function deleteUnit(
  organizationId: string,
  propertyId: string,
  unitId: string,
  actor: Actor
) {
  const property = await assertPropertyInOrg(organizationId, propertyId);
  if (!property) return { error: "not-found" as const };

  const existing = await prisma.unit.findFirst({
    where: { id: unitId, propertyId },
  });
  if (!existing) return { error: "not-found" as const };

  // Leases on this unit cascade via the schema's onDelete rule.
  await prisma.$transaction(async (tx) => {
    await tx.unit.delete({ where: { id: existing.id } });
    await audit(tx, {
      organizationId,
      actor,
      action: "unit.deleted",
      entityType: "Unit",
      entityId: existing.id,
      changes: snapshot(existing),
    });
  });
  return { unit: { id: existing.id } };
}

/**
 * Everything the unit page shows, in one read: the unit, enough of its
 * property for the header and back link, and every lease the unit has held.
 *
 * Scoped through the property's organization, and each lease through the
 * membership's too — nothing in the schema stops a lease joining a member of
 * one org to a unit in another, and such a row must not surface here.
 */
export async function getUnit(
  organizationId: string,
  propertyId: string,
  unitId: string
) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, propertyId, property: { organizationId } },
    include: {
      property: {
        select: { id: true, name: true, address: true, category: true },
      },
      leases: {
        where: { membership: { organizationId } },
        orderBy: { startDate: "desc" },
        include: {
          membership: {
            include: { user: { select: { name: true, email: true, phone: true } } },
          },
        },
      },
    },
  });
  if (!unit) return null;

  // Batched per list, as everywhere else, for the tenant hover cards.
  const photoIds = await getProfilePhotoIds(
    organizationId,
    unit.leases.map((lease) => lease.membershipId)
  );

  const now = new Date();
  const leases = unit.leases.map((lease) => ({
    id: lease.id,
    reference: leaseReference(lease.id),
    membershipId: lease.membershipId,
    tenantName:
      lease.membership.user.name ??
      lease.membership.user.email ??
      lease.membership.user.phone ??
      "Unnamed",
    tenantPhone: lease.membership.user.phone,
    tenantEmail: lease.membership.user.email,
    tenantPhotoId: photoIds.get(lease.membershipId) ?? null,
    startDate: lease.startDate,
    endDate: lease.endDate,
    durationMonths: lease.durationMonths,
    monthlyRent: lease.monthlyRent,
    leaseAmount: lease.leaseAmount,
    status: lease.status,
    expiry: leaseExpiry(now, lease.startDate, lease.endDate),
  }));

  // The same test the property page uses for "occupied": started and not ended.
  const currentLease =
    leases.find((lease) => lease.startDate <= now && lease.endDate >= now) ?? null;

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
    property: unit.property,
    leases,
    currentLease,
  };
}

/** One side of a unit's occupancy: who, which lease, and its dates. */
export type UnitOccupant = {
  leaseId: string;
  reference: string;
  membershipId: string;
  tenantName: string;
  tenantPhone: string | null;
  tenantEmail: string | null;
  photoId: string | null;
  status: LeaseStatus;
  /** ISO strings — they cross the server/client boundary. `endDate` is exclusive. */
  startDate: string;
  endDate: string;
  durationMonths: number;
  monthlyRent: number;
  expiry: LeaseExpiry | null;
};

export type UnitListRow = {
  id: string;
  label: string;
  propertyId: string;
  propertyName: string;
  /** For the property and unit hover cards. */
  property: PropertyPreview;
  unit: UnitPreview;
  rentAmount: number;
  minTenureMonths: number | null;
  autoRenew: boolean;
  unitType: string | null;
  floor: string | null;
  block: string | null;
  sizeSqm: number | null;
  amenities: string[];
  status: "Occupied" | "Vacant";
  /**
   * The running lease when occupied, otherwise the last one to end; null for a
   * unit that has never been let. One lease per unit, so a table of units
   * answers "who is in it" without the leases page's one row per term.
   */
  occupant: UnitOccupant | null;
  /** The next lease to start, when one is already signed. */
  next: UnitOccupant | null;
};

/**
 * Every unit in the organization with its occupancy, for the Units page.
 *
 * Leases never overlap on a unit, so the most recent lease that has *started*
 * is either the running one (its end is still ahead) or the last one to end —
 * one `take: 1` answers both. Upcoming leases are a second, flat query rather
 * than a per-unit include. Leases are scoped through the membership's org as
 * well, as everywhere: the schema doesn't stop a cross-org lease.
 */
export async function getOrganizationUnits(organizationId: string): Promise<UnitListRow[]> {
  const now = new Date();
  const leaseInclude = {
    membership: {
      include: { user: { select: { name: true, email: true, phone: true } } },
    },
  } as const;

  const [units, upcoming] = await Promise.all([
    prisma.unit.findMany({
      where: { property: { organizationId } },
      orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
      include: {
        property: {
          select: { id: true, name: true, address: true, category: true, type: true },
        },
        leases: {
          where: { membership: { organizationId }, startDate: { lte: now } },
          orderBy: { startDate: "desc" },
          take: 1,
          include: leaseInclude,
        },
      },
    }),
    prisma.lease.findMany({
      where: {
        startDate: { gt: now },
        membership: { organizationId },
        unit: { property: { organizationId } },
      },
      orderBy: { startDate: "asc" },
      include: leaseInclude,
    }),
  ]);

  const nextByUnit = new Map<string, (typeof upcoming)[number]>();
  for (const lease of upcoming) {
    if (!nextByUnit.has(lease.unitId)) nextByUnit.set(lease.unitId, lease);
  }

  // Batched per list, as everywhere else, for the avatars and hover cards.
  const photoIds = await getProfilePhotoIds(organizationId, [
    ...units.flatMap((unit) => unit.leases.map((lease) => lease.membershipId)),
    ...[...nextByUnit.values()].map((lease) => lease.membershipId),
  ]);

  const occupant = (lease: (typeof upcoming)[number]): UnitOccupant => ({
    leaseId: lease.id,
    reference: leaseReference(lease.id),
    membershipId: lease.membershipId,
    tenantName: displayName(lease.membership.user),
    tenantPhone: lease.membership.user.phone,
    tenantEmail: lease.membership.user.email,
    photoId: photoIds.get(lease.membershipId) ?? null,
    status: lease.status,
    startDate: lease.startDate.toISOString(),
    endDate: lease.endDate.toISOString(),
    durationMonths: lease.durationMonths,
    monthlyRent: lease.monthlyRent,
    expiry: leaseExpiry(now, lease.startDate, lease.endDate),
  });

  return units.map((unit) => {
    const latest = unit.leases[0] ?? null;
    const next = nextByUnit.get(unit.id) ?? null;
    return {
      id: unit.id,
      label: unit.label,
      propertyId: unit.property.id,
      propertyName: unit.property.name,
      property: {
        name: unit.property.name,
        address: unit.property.address,
        category: unit.property.category,
        type: unit.property.type,
      },
      unit: {
        label: unit.label,
        propertyName: unit.property.name,
        unitType: unit.unitType,
        sizeSqm: unit.sizeSqm,
        rentAmount: unit.rentAmount,
        floor: unit.floor,
        block: unit.block,
      },
      rentAmount: unit.rentAmount,
      minTenureMonths: unit.minTenureMonths,
      autoRenew: unit.autoRenew,
      unitType: unit.unitType,
      floor: unit.floor,
      block: unit.block,
      sizeSqm: unit.sizeSqm,
      amenities: unit.amenities,
      // The property page's test for "occupied": started and not ended.
      status: latest && latest.endDate >= now ? "Occupied" : "Vacant",
      occupant: latest ? occupant(latest) : null,
      next: next ? occupant(next) : null,
    };
  });
}
