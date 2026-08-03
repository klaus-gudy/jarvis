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
  input: CreateUnitInput
) {
  const property = await assertPropertyInOrg(organizationId, propertyId);
  if (!property) return { error: "not-found" as const };

  // label is unique per property, so a clash is a user error, not a crash.
  const clash = await prisma.unit.findFirst({
    where: { propertyId, label: input.label },
    select: { id: true },
  });
  if (clash) return { error: "duplicate-label" as const };

  const unit = await prisma.unit.create({
    data: { ...input, propertyId },
    select: { id: true },
  });
  return { unit };
}

export async function updateUnit(
  organizationId: string,
  propertyId: string,
  unitId: string,
  input: UpdateUnitInput
) {
  const property = await assertPropertyInOrg(organizationId, propertyId);
  if (!property) return { error: "not-found" as const };

  const existing = await prisma.unit.findFirst({
    where: { id: unitId, propertyId },
    select: { id: true },
  });
  if (!existing) return { error: "not-found" as const };

  if (input.label) {
    const clash = await prisma.unit.findFirst({
      where: { propertyId, label: input.label, NOT: { id: unitId } },
      select: { id: true },
    });
    if (clash) return { error: "duplicate-label" as const };
  }

  const unit = await prisma.unit.update({
    where: { id: existing.id },
    data: input,
    select: { id: true },
  });
  return { unit };
}

export async function deleteUnit(
  organizationId: string,
  propertyId: string,
  unitId: string
) {
  const property = await assertPropertyInOrg(organizationId, propertyId);
  if (!property) return { error: "not-found" as const };

  const existing = await prisma.unit.findFirst({
    where: { id: unitId, propertyId },
    select: { id: true },
  });
  if (!existing) return { error: "not-found" as const };

  // Leases on this unit cascade via the schema's onDelete rule.
  await prisma.unit.delete({ where: { id: existing.id } });
  return { unit: existing };
}
