import { prisma } from "@/lib/prisma";
import type { UpdateMemberInput } from "@/lib/members-schemas";
import { OWNER_ROLE_NAME } from "@/lib/roles";

export type MemberRow = {
  membershipId: string;
  name: string;
  /** The stored name, null when unset — the form must not prefill the fallback. */
  rawName: string | null;
  email: string | null;
  phone: string | null;
  roleId: string;
  roleName: string;
  joinedAt: string;
  canSignIn: boolean;
  isOwner: boolean;
};

export async function getMembers(organizationId: string): Promise<MemberRow[]> {
  const memberships = await prisma.membership.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          passwordHash: true,
        },
      },
      role: { select: { id: true, name: true } },
    },
  });

  return memberships.map((membership) => ({
    membershipId: membership.id,
    name:
      membership.user.name ??
      membership.user.email ??
      membership.user.phone ??
      "Unnamed",
    rawName: membership.user.name,
    email: membership.user.email,
    phone: membership.user.phone,
    roleId: membership.role.id,
    roleName: membership.role.name,
    joinedAt: membership.createdAt.toISOString(),
    canSignIn: membership.user.passwordHash !== null,
    isOwner: membership.role.name.toLowerCase() === OWNER_ROLE_NAME.toLowerCase(),
  }));
}

/**
 * Removing the last Owner would leave the organization with nobody able to
 * administer it, so that case is refused rather than merely warned about.
 */
export async function removeMember(
  organizationId: string,
  membershipId: string,
  currentUserId: string
) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    include: { role: { select: { name: true } }, _count: { select: { leases: true } } },
  });
  if (!membership) return { error: "not-found" as const };

  if (membership.userId === currentUserId) return { error: "self" as const };

  if (membership.role.name.toLowerCase() === OWNER_ROLE_NAME.toLowerCase()) {
    const ownerCount = await prisma.membership.count({
      where: {
        organizationId,
        role: { name: { equals: OWNER_ROLE_NAME, mode: "insensitive" } },
      },
    });
    if (ownerCount <= 1) return { error: "last-owner" as const };
  }

  await prisma.membership.delete({ where: { id: membership.id } });
  return { removedLeases: membership._count.leases };
}

/**
 * Updates the User behind a membership. phone/email are globally unique, so a
 * clash with another account is reported as a conflict rather than surfacing a
 * raw constraint error.
 */
export async function updateMember(
  organizationId: string,
  membershipId: string,
  input: UpdateMemberInput
) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    select: { id: true, userId: true },
  });
  if (!membership) return { error: "not-found" as const };

  const clash = await prisma.user.findFirst({
    where: {
      id: { not: membership.userId },
      OR: [
        { phone: input.phone },
        ...(input.email ? [{ email: input.email }] : []),
      ],
    },
    select: { phone: true },
  });
  if (clash) {
    return {
      error: "duplicate" as const,
      field: clash.phone === input.phone ? ("phone" as const) : ("email" as const),
    };
  }

  await prisma.user.update({
    where: { id: membership.userId },
    data: {
      name: input.name,
      phone: input.phone,
      // Clearing the field stores null rather than an empty string.
      email: input.email ?? null,
    },
  });

  return { ok: true as const };
}
