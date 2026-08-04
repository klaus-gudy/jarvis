import { leaseReference, type LeaseStatus } from "@/lib/leases";
import type { UpdateMemberProfileInput } from "@/lib/member-profile-schemas";
import { prisma } from "@/lib/prisma";
import { ensureRole, TENANT_ROLE_NAME } from "@/lib/roles";
import type { CreateTenantInput } from "@/lib/tenants-schemas";

/**
 * Status is derived from leases rather than stored, so it can never drift out
 * of sync with the actual lease data:
 *   Active   — has a lease running right now
 *   Vacated  — had a lease, but it has ended
 *   Prospect — never had a lease (usually just onboarded)
 */
export type TenantStatus = "Active" | "Vacated" | "Prospect";

export type TenantRow = {
  membershipId: string;
  userId: string;
  name: string;
  /** The stored name, null when unset. */
  rawName: string | null;
  email: string | null;
  phone: string | null;
  joinedAt: string;
  unitLabel: string | null;
  propertyName: string | null;
  status: TenantStatus;
  canSignIn: boolean;
};

export async function getTenants(organizationId: string): Promise<TenantRow[]> {
  const now = new Date();

  const memberships = await prisma.membership.findMany({
    where: {
      organizationId,
      role: { name: { equals: TENANT_ROLE_NAME, mode: "insensitive" } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          passwordHash: true,
        },
      },
      leases: {
        orderBy: { startDate: "desc" },
        include: { unit: { include: { property: { select: { name: true } } } } },
      },
    },
  });

  return memberships.map((membership) => {
    const activeLease =
      membership.leases.find(
        (lease) => lease.startDate <= now && lease.endDate >= now
      ) ?? null;

    // Falls back to the most recent lease so a vacated tenant still shows
    // which unit they left.
    const relevantLease = activeLease ?? membership.leases[0] ?? null;

    const status: TenantStatus = activeLease
      ? "Active"
      : membership.leases.length > 0
        ? "Vacated"
        : "Prospect";

    return {
      membershipId: membership.id,
      userId: membership.user.id,
      name: membership.user.name ?? membership.user.email ?? membership.user.phone ?? "Unnamed",
      rawName: membership.user.name,
      email: membership.user.email,
      phone: membership.user.phone,
      joinedAt: membership.createdAt.toISOString(),
      unitLabel: relevantLease?.unit.label ?? null,
      propertyName: relevantLease?.unit.property.name ?? null,
      status,
      // Surfaced so staff can see who still needs an invite to actually log in.
      canSignIn: membership.user.passwordHash !== null,
    };
  });
}

export type MemberProfileFields = {
  occupation: string | null;
  nidaNumber: string | null;
  employer: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
};

const EMPTY_PROFILE: MemberProfileFields = {
  occupation: null,
  nidaNumber: null,
  employer: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  emergencyContactRelation: null,
};

export type TenantDetail = {
  membershipId: string;
  userId: string;
  name: string;
  rawName: string | null;
  phone: string | null;
  email: string | null;
  roleName: string;
  joinedAt: Date;
  canSignIn: boolean;
  status: TenantStatus;
  profile: MemberProfileFields;
  leases: {
    id: string;
    reference: string;
    propertyName: string;
    unitLabel: string;
    startDate: Date;
    endDate: Date;
    durationMonths: number;
    leaseAmount: number;
    status: LeaseStatus;
  }[];
};

/** Scoped by organizationId, so a membership id from another org reads as missing. */
export async function getTenantDetail(
  organizationId: string,
  membershipId: string
): Promise<TenantDetail | null> {
  const now = new Date();

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, passwordHash: true },
      },
      role: { select: { name: true } },
      profile: true,
      leases: {
        orderBy: { startDate: "desc" },
        include: { unit: { include: { property: { select: { name: true } } } } },
      },
    },
  });
  if (!membership) return null;

  const hasActive = membership.leases.some(
    (lease) => lease.startDate <= now && lease.endDate >= now
  );

  return {
    membershipId: membership.id,
    userId: membership.user.id,
    name:
      membership.user.name ??
      membership.user.email ??
      membership.user.phone ??
      "Unnamed",
    rawName: membership.user.name,
    phone: membership.user.phone,
    email: membership.user.email,
    roleName: membership.role.name,
    joinedAt: membership.createdAt,
    canSignIn: membership.user.passwordHash !== null,
    status: hasActive
      ? "Active"
      : membership.leases.length > 0
        ? "Vacated"
        : "Prospect",
    // A member with no profile row is normal, so absent reads as all-blank
    // rather than forcing every caller to null-check the relation.
    profile: membership.profile
      ? {
          occupation: membership.profile.occupation,
          nidaNumber: membership.profile.nidaNumber,
          employer: membership.profile.employer,
          emergencyContactName: membership.profile.emergencyContactName,
          emergencyContactPhone: membership.profile.emergencyContactPhone,
          emergencyContactRelation: membership.profile.emergencyContactRelation,
        }
      : EMPTY_PROFILE,
    leases: membership.leases.map((lease) => ({
      id: lease.id,
      reference: leaseReference(lease.id),
      propertyName: lease.unit.property.name,
      unitLabel: lease.unit.label,
      startDate: lease.startDate,
      endDate: lease.endDate,
      durationMonths: lease.durationMonths,
      leaseAmount: lease.leaseAmount,
      status:
        lease.startDate > now
          ? "Upcoming"
          : lease.endDate < now
            ? "Ended"
            : "Active",
    })),
  };
}

/**
 * Upserts because the profile row is created lazily — a member only gets one
 * the first time somebody actually fills these details in.
 */
export async function updateMemberProfile(
  organizationId: string,
  membershipId: string,
  input: UpdateMemberProfileInput
) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    select: { id: true },
  });
  if (!membership) return { error: "not-found" as const };

  await prisma.memberProfile.upsert({
    where: { membershipId: membership.id },
    create: { membershipId: membership.id, ...input },
    update: input,
  });

  return { ok: true as const };
}

/**
 * Creates the tenant record without a password: this is assisted onboarding,
 * not self-service, so the account exists for record-keeping and can only gain
 * sign-in access later through an invitation.
 *
 * A person may already exist as a User (e.g. a tenant of another org), so this
 * reuses the matching user rather than failing on the unique phone/email.
 */
export async function createTenant(
  organizationId: string,
  input: CreateTenantInput
) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: input.phone },
        ...(input.email ? [{ email: input.email }] : []),
      ],
    },
    select: { id: true },
  });

  if (existingUser) {
    const alreadyMember = await prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId: existingUser.id, organizationId },
      },
      select: { id: true },
    });
    if (alreadyMember) return { error: "already-member" as const };
  }

  const role = await ensureRole(organizationId, TENANT_ROLE_NAME);

  const membership = await prisma.$transaction(async (tx) => {
    const user = existingUser
      ? existingUser
      : await tx.user.create({
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email ?? null,
            // No password: this account cannot sign in until invited.
            passwordHash: null,
          },
          select: { id: true },
        });

    return tx.membership.create({
      data: { userId: user.id, organizationId, roleId: role.id },
      select: { id: true },
    });
  });

  return { membership };
}

export async function removeTenant(organizationId: string, membershipId: string) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    select: { id: true, _count: { select: { leases: true } } },
  });
  if (!membership) return { error: "not-found" as const };

  // Leases cascade with the membership, so say so rather than silently
  // deleting lease history.
  await prisma.membership.delete({ where: { id: membership.id } });
  return { removedLeases: membership._count.leases };
}
