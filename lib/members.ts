import { audit, diff, snapshot, updatedBy, type Actor } from "@/lib/audit";
import { can, type AuthContext } from "@/lib/authz";
import { getProfilePhotoIds } from "@/lib/documents";
import { parsePermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { UpdateMemberInput } from "@/lib/members-schemas";

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
  /** Opening a tenant's page needs `tenant:read`, not just `member:read`. */
  isTenant: boolean;
  photoId: string | null;
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
      role: { select: { id: true, name: true, kind: true } },
    },
  });

  const photoIds = await getProfilePhotoIds(
    organizationId,
    memberships.map((membership) => membership.id)
  );

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
    isOwner: membership.role.kind === "OWNER",
    isTenant: membership.role.kind === "TENANT",
    photoId: photoIds.get(membership.id) ?? null,
  }));
}

/**
 * Removing the last Owner would leave the organization with nobody able to
 * administer it, so that case is refused rather than merely warned about.
 */
export async function removeMember(
  organizationId: string,
  membershipId: string,
  currentUserId: string,
  actor: Actor
) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    include: {
      role: { select: { kind: true } },
      user: { select: { name: true, email: true, phone: true } },
      _count: { select: { leases: true } },
    },
  });
  if (!membership) return { error: "not-found" as const };

  if (membership.userId === currentUserId) return { error: "self" as const };

  if (membership.role.kind === "OWNER") {
    const ownerCount = await prisma.membership.count({
      where: { organizationId, role: { kind: "OWNER" } },
    });
    if (ownerCount <= 1) return { error: "last-owner" as const };
  }

  await removeMembership(organizationId, membership, actor, "member.removed");
  return { removedLeases: membership._count.leases };
}

/**
 * Whether an edit may change the sign-in identifiers (phone, email) of the
 * User behind a membership.
 *
 * Users are global: the same account can be a tenant here and an Owner
 * elsewhere, and its email is where password-reset codes go. Letting staff of
 * one organization rewrite it would let them reset the password and walk into
 * every other organization that person belongs to. So identifiers are editable
 * only by the person themselves, or by staff when the record is theirs alone —
 * a passwordless account (assisted onboarding) that belongs to no other
 * organization. Anything else is "self-managed" and keeps its identifiers.
 */
export async function checkIdentifierEdit(
  organizationId: string,
  membershipId: string,
  actorUserId: string,
  input: Pick<UpdateMemberInput, "phone" | "email">
) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    select: {
      user: {
        select: {
          id: true,
          phone: true,
          email: true,
          passwordHash: true,
          memberships: { select: { organizationId: true } },
        },
      },
    },
  });
  if (!membership) return { error: "not-found" as const };

  const { user } = membership;
  const changing =
    (user.phone ?? null) !== (input.phone ?? null) ||
    (user.email ?? null) !== (input.email ?? null);
  if (!changing || user.id === actorUserId) return { ok: true as const, user };

  const landlordManaged =
    !user.passwordHash &&
    user.memberships.every((m) => m.organizationId === organizationId);
  return landlordManaged
    ? { ok: true as const, user }
    : { error: "self-managed" as const };
}

/**
 * Updates the User behind a membership. phone/email are globally unique, so a
 * clash with another account is reported as a conflict rather than surfacing a
 * raw constraint error. Identifier changes go through `checkIdentifierEdit`.
 */
export async function updateMember(
  organizationId: string,
  membershipId: string,
  actorUserId: string,
  input: UpdateMemberInput,
  actor: Actor
) {
  const allowed = await checkIdentifierEdit(organizationId, membershipId, actorUserId, input);
  if ("error" in allowed) return allowed;
  const { user } = allowed;

  const clash = await prisma.user.findFirst({
    where: {
      id: { not: user.id },
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

  const email = input.email ?? null;
  const changes = { name: input.name, phone: input.phone, email };
  const before = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, phone: true, email: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        ...changes,
        // A new address has proved nothing yet.
        ...(email !== user.email ? { emailVerifiedAt: null } : {}),
      },
    });
    // `User` is global, so the stamp goes on this org's membership instead.
    await tx.membership.update({
      where: { id: membershipId },
      data: updatedBy(actor),
    });
    await audit(tx, {
      organizationId,
      actor,
      action: "member.updated",
      entityType: "Membership",
      entityId: membershipId,
      changes: diff(before, changes),
    });
  });

  return { ok: true as const };
}

/**
 * Moves a member to another role. Guards, in order:
 *
 * - nobody changes their own role (no self-promotion, no accidental lockout);
 * - only an Owner can make or unmake an Owner;
 * - a non-Owner cannot hand out a staff role holding permissions they lack;
 * - the last Owner cannot be demoted.
 *
 * The last-Owner count runs inside the transaction so two concurrent demotions
 * cannot both pass it.
 */
export async function changeMemberRole(
  ctx: AuthContext,
  target: { id: string; kind: "OWNER" | "STAFF" | "TENANT" },
  roleId: string
) {
  if (target.id === ctx.membershipId) return { error: "self" as const };
  if (!can(ctx, "member:write")) return { error: "forbidden" as const };

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findFirst({
      where: { id: roleId, organizationId: ctx.organizationId },
      select: { id: true, kind: true, permissions: true },
    });
    if (!role) return { error: "role-not-found" as const };

    if ((role.kind === "OWNER" || target.kind === "OWNER") && ctx.kind !== "OWNER") {
      return { error: "forbidden" as const };
    }
    if (ctx.kind !== "OWNER") {
      const granted = parsePermissions(role.permissions);
      if (granted.some((p) => !ctx.permissions.has(p))) {
        return { error: "escalation" as const };
      }
    }

    if (target.kind === "OWNER" && role.kind !== "OWNER") {
      const owners = await tx.membership.count({
        where: { organizationId: ctx.organizationId, role: { kind: "OWNER" } },
      });
      if (owners <= 1) return { error: "last-owner" as const };
    }

    const before = await tx.membership.findUniqueOrThrow({
      where: { id: target.id },
      select: { roleId: true },
    });
    await tx.membership.update({
      where: { id: target.id },
      data: { roleId: role.id, ...updatedBy(ctx) },
    });
    await audit(tx, {
      organizationId: ctx.organizationId,
      actor: ctx,
      action: "member.role_changed",
      entityType: "Membership",
      entityId: target.id,
      changes: diff(before, { roleId: role.id }),
    });
    return { ok: true as const };
  });
}

/**
 * Deletes a membership (its leases cascade) and logs it. The entry keeps who
 * the person was, because after this nothing else in the organization does.
 */
export async function removeMembership(
  organizationId: string,
  membership: {
    id: string;
    userId: string;
    roleId: string;
    user: { name: string | null; email: string | null; phone: string | null };
    _count: { leases: number };
  },
  actor: Actor,
  action: "member.removed" | "tenant.removed"
) {
  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({ where: { id: membership.id } });
    await audit(tx, {
      organizationId,
      actor,
      action,
      entityType: "Membership",
      entityId: membership.id,
      changes: {
        ...snapshot(membership.user),
        userId: membership.userId,
        roleId: membership.roleId,
        removedLeases: membership._count.leases,
      },
    });
  });
}
