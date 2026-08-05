import { cache } from "react";

import { prisma } from "@/lib/prisma";

/** The role name created for the registrant in app/api/auth/register/route.ts. */
const OWNER_ROLE_NAME = "Owner";

/**
 * Properties don't store an owner — it is whoever holds the Owner role in the
 * organization. Cached so one lookup serves a whole render rather than firing
 * once per property card.
 */
export const getOrganizationOwnerName = cache(async (organizationId: string) => {
  const ownerMembership = await prisma.membership.findFirst({
    where: {
      organizationId,
      // Role names are free text and editable, so match loosely.
      role: { name: { equals: OWNER_ROLE_NAME, mode: "insensitive" } },
    },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });

  // email is optional now, so an owner could have neither name nor email.
  const ownerLabel =
    ownerMembership?.user.name ??
    ownerMembership?.user.email ??
    ownerMembership?.user.phone;
  if (ownerLabel) return ownerLabel;

  // No Owner-role member (renamed or removed) — the organization itself is the
  // best remaining answer, and beats rendering a blank owner line.
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  return organization?.name ?? "—";
});

/**
 * Creates an organization for an existing signed-in user and makes them its
 * Owner. Mirrors what registration does, minus creating the user — used when
 * someone ends up with no organization (never invited, or their last one was
 * deleted) and would otherwise be locked out of a working app.
 *
 * One organization per owner: a user already holding an Owner membership
 * anywhere is refused. Registration can't produce a second org for the same
 * person (a duplicate email/phone 409s before any org is created), so this
 * endpoint is the only door and the check lives inside the transaction where
 * it can't race a concurrent create.
 */
export async function createOrganizationForUser(userId: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const existingOwnership = await tx.membership.findFirst({
      where: {
        userId,
        role: { name: { equals: OWNER_ROLE_NAME, mode: "insensitive" } },
      },
      select: { organization: { select: { name: true } } },
    });
    if (existingOwnership) {
      return {
        error: "already-owner" as const,
        organizationName: existingOwnership.organization.name,
      };
    }

    const organization = await tx.organization.create({ data: { name } });
    const ownerRole = await tx.role.create({
      data: { name: OWNER_ROLE_NAME, organizationId: organization.id },
    });
    await tx.membership.create({
      data: { userId, organizationId: organization.id, roleId: ownerRole.id },
    });
    return { organization };
  });
}
