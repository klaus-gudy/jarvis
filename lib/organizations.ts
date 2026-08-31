import { cache } from "react";

import { prisma } from "@/lib/prisma";

/** The role name created for the registrant in app/api/auth/register/route.ts. */
const OWNER_ROLE_NAME = "Owner";

/**
 * Whoever holds the Owner role, as a person rather than a label — the lease
 * contract names them alongside their phone and email, which
 * `getOrganizationOwnerName` throws away. Cached, so the two together are one
 * query.
 *
 * Null when the role has been renamed or its last holder removed; callers
 * decide what to say instead.
 */
export const getOrganizationOwner = cache(async (organizationId: string) => {
  const ownerMembership = await prisma.membership.findFirst({
    where: {
      organizationId,
      // Role names are free text and editable, so match loosely.
      role: { name: { equals: OWNER_ROLE_NAME, mode: "insensitive" } },
    },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });

  return ownerMembership?.user ?? null;
});

/**
 * Properties don't store an owner — it is whoever holds the Owner role in the
 * organization. Cached so one lookup serves a whole render rather than firing
 * once per property card.
 */
export const getOrganizationOwnerName = cache(async (organizationId: string) => {
  const owner = await getOrganizationOwner(organizationId);

  // email is optional now, so an owner could have neither name nor email.
  const ownerLabel = owner?.name ?? owner?.email ?? owner?.phone;
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
 * Case-insensitive: "Acme" and "acme" collide, since two near-identical org
 * names sitting side by side would read as a data-entry mistake. Backs the
 * live availability check on the registration form — the client-side check is
 * a courtesy, so `POST /api/auth/register` re-runs the same comparison inside
 * its own transaction before creating anything, where it's the check that
 * actually counts.
 */
export async function organizationNameExists(name: string) {
  const existing = await prisma.organization.findFirst({
    where: { name: { equals: name.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  return existing !== null;
}

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

/**
 * Deletes an organization and everything hanging off it. Irreversible.
 *
 * Only an Owner of *this* organization may do it, and the check runs inside
 * the transaction so it can't race a concurrent role change or removal.
 *
 * The three deletes are explicit and ordered rather than one `organization
 * .delete()` relying on the database to unwind everything. `Membership.roleId`
 * and `Invitation.roleId` are ON DELETE RESTRICT, so a single delete only
 * succeeds if Postgres happens to clear those rows before it clears `Role` —
 * true in testing, but an ordering the schema does not promise. Removing both
 * referrers first makes it deterministic; the organization delete then cascades
 * roles, properties → units → leases → invoices → payments, notification logs
 * and file assets.
 *
 * **The bucket is not touched.** `FileAsset` rows go, the objects they name do
 * not — deleting `organizations/<id>/` needs a storage call this transaction
 * cannot make and could not roll back. Until that exists, an organization
 * delete leaves its files behind, unreferenced and unreachable.
 *
 * Users are deliberately untouched: a User is not org-scoped, so a member of
 * another organization keeps that, and anyone left with none lands on the
 * create-organization prompt rather than a broken session.
 */
export async function deleteOrganization(
  userId: string,
  organizationId: string
) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: { select: { name: true } } },
    });
    if (!membership) return { error: "not-found" as const };

    const isOwner =
      membership.role.name.toLowerCase() === OWNER_ROLE_NAME.toLowerCase();
    if (!isOwner) return { error: "not-owner" as const };

    await tx.membership.deleteMany({ where: { organizationId } });
    await tx.invitation.deleteMany({ where: { organizationId } });
    await tx.organization.delete({ where: { id: organizationId } });

    return { ok: true as const };
  });
}
