import { prisma } from "@/lib/prisma";
import type { CreateLeaseInput } from "@/lib/leases-schemas";
import { TENANT_ROLE_NAME } from "@/lib/roles";

/** Sentinel for "no end date" when checking interval overlap against a fixed upper bound. */
const FAR_FUTURE = new Date(8640000000000000);

export type LeaseStatus = "Active" | "Upcoming" | "Ended";

export type LeaseRow = {
  id: string;
  membershipId: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
  rentAmount: number;
  startDate: string;
  endDate: string | null;
  status: LeaseStatus;
};

function leaseStatus(now: Date, startDate: Date, endDate: Date | null): LeaseStatus {
  if (startDate > now) return "Upcoming";
  if (endDate && endDate < now) return "Ended";
  return "Active";
}

/**
 * Scoped through both the membership and the unit's property, so a lease
 * that somehow joins a membership in one org to a unit in another (nothing
 * in the schema forbids it) can never surface on this org's page.
 */
export async function getLeases(organizationId: string): Promise<LeaseRow[]> {
  const now = new Date();

  const leases = await prisma.lease.findMany({
    where: {
      membership: { organizationId },
      unit: { property: { organizationId } },
    },
    orderBy: { startDate: "desc" },
    include: {
      unit: { include: { property: { select: { name: true } } } },
      membership: {
        include: { user: { select: { name: true, email: true, phone: true } } },
      },
    },
  });

  return leases.map((lease) => ({
    id: lease.id,
    membershipId: lease.membershipId,
    tenantName:
      lease.membership.user.name ??
      lease.membership.user.email ??
      lease.membership.user.phone ??
      "Unnamed",
    unitLabel: lease.unit.label,
    propertyName: lease.unit.property.name,
    rentAmount: lease.unit.rentAmount,
    startDate: lease.startDate.toISOString(),
    endDate: lease.endDate?.toISOString() ?? null,
    status: leaseStatus(now, lease.startDate, lease.endDate),
  }));
}

export type LeaseOptions = {
  units: { id: string; label: string; propertyName: string; rentAmount: number }[];
  tenants: { membershipId: string; name: string }[];
};

/** A new lease can only be built from a currently-vacant unit and a Tenant-role member. */
export async function getLeaseOptions(organizationId: string): Promise<LeaseOptions> {
  const now = new Date();

  const [units, tenantMemberships] = await Promise.all([
    prisma.unit.findMany({
      where: {
        property: { organizationId },
        leases: {
          none: {
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        },
      },
      orderBy: { label: "asc" },
      include: { property: { select: { name: true } } },
    }),
    prisma.membership.findMany({
      where: {
        organizationId,
        role: { name: { equals: TENANT_ROLE_NAME, mode: "insensitive" } },
      },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, email: true, phone: true } } },
    }),
  ]);

  return {
    units: units.map((unit) => ({
      id: unit.id,
      label: unit.label,
      propertyName: unit.property.name,
      rentAmount: unit.rentAmount,
    })),
    tenants: tenantMemberships.map((membership) => ({
      membershipId: membership.id,
      name:
        membership.user.name ??
        membership.user.email ??
        membership.user.phone ??
        "Unnamed",
    })),
  };
}

/**
 * The unit and tenant ids are re-validated server-side rather than trusted
 * from the options list a client fetched earlier: the unit must belong to
 * this org and be free for the requested period, and the membership must
 * belong to this org and actually hold the Tenant role.
 */
export async function createLease(organizationId: string, input: CreateLeaseInput) {
  const unit = await prisma.unit.findFirst({
    where: { id: input.unitId, property: { organizationId } },
    select: { id: true },
  });
  if (!unit) return { error: "unit-not-found" as const };

  const membership = await prisma.membership.findFirst({
    where: {
      id: input.membershipId,
      organizationId,
      role: { name: { equals: TENANT_ROLE_NAME, mode: "insensitive" } },
    },
    select: { id: true },
  });
  if (!membership) return { error: "tenant-not-found" as const };

  // Interval overlap: an existing lease conflicts if it starts before this
  // one ends, and ends (or never ends) after this one starts.
  const overlapping = await prisma.lease.findFirst({
    where: {
      unitId: unit.id,
      startDate: { lte: input.endDate ?? FAR_FUTURE },
      OR: [{ endDate: null }, { endDate: { gte: input.startDate } }],
    },
    select: { id: true },
  });
  if (overlapping) return { error: "unit-occupied" as const };

  const lease = await prisma.lease.create({
    data: {
      unitId: unit.id,
      membershipId: membership.id,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
    },
    select: { id: true },
  });

  return { lease };
}

export async function deleteLease(organizationId: string, leaseId: string) {
  const lease = await prisma.lease.findFirst({
    where: {
      id: leaseId,
      membership: { organizationId },
      unit: { property: { organizationId } },
    },
    select: { id: true },
  });
  if (!lease) return { error: "not-found" as const };

  await prisma.lease.delete({ where: { id: lease.id } });
  return { ok: true as const };
}
