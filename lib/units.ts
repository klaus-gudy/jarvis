import { audit, createdBy, diff, snapshot, updatedBy, type Actor } from "@/lib/audit";
import { getProfilePhotoIds } from "@/lib/documents";
import { leaseExpiry, leaseReference } from "@/lib/leases";
import { prisma } from "@/lib/prisma";
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
