import { prisma } from "@/lib/prisma";
import { addMonths, type CreateLeaseInput } from "@/lib/leases-schemas";
import { TENANT_ROLE_NAME } from "@/lib/roles";

export type LeaseStatus = "Active" | "Upcoming" | "Ended";

export type LeaseRow = {
  id: string;
  membershipId: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  leaseAmount: number;
  status: LeaseStatus;
};

function leaseStatus(now: Date, startDate: Date, endDate: Date): LeaseStatus {
  if (startDate > now) return "Upcoming";
  if (endDate < now) return "Ended";
  return "Active";
}

/**
 * Scoped through both the membership and the unit's property, so a lease that
 * somehow joins a membership in one org to a unit in another (nothing in the
 * schema forbids it) can never surface on this org's page.
 */
export async function getLeases(organizationId: string): Promise<LeaseRow[]> {
  const now = new Date();

  const leases = await prisma.lease.findMany({
    where: {
      membership: { organizationId },
      unit: { property: { organizationId } },
    },
    orderBy: { updatedAt: "desc" },
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
    startDate: lease.startDate.toISOString(),
    endDate: lease.endDate.toISOString(),
    durationMonths: lease.durationMonths,
    leaseAmount: lease.leaseAmount,
    status: leaseStatus(now, lease.startDate, lease.endDate),
  }));
}

/**
 * There is no lease-number column, so the reference is derived from the tail of
 * the cuid — stable for the life of the row, but not a sequential "L-05".
 */
export function leaseReference(id: string) {
  return `L-${id.slice(-5).toUpperCase()}`;
}

export type LeaseDetail = {
  id: string;
  reference: string;
  status: LeaseStatus;
  tenant: {
    membershipId: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  unit: {
    id: string;
    label: string;
    unitType: string | null;
    floor: string | null;
    block: string | null;
    sizeSqm: number | null;
    rentAmount: number;
  };
  property: {
    id: string;
    name: string;
    address: string;
    category: string;
  };
  startDate: Date;
  endDate: Date;
  durationMonths: number;
  leaseAmount: number;
};

/** Scoped through both relations, matching getLeases, so one org can't read another's lease. */
export async function getLease(
  organizationId: string,
  leaseId: string
): Promise<LeaseDetail | null> {
  const lease = await prisma.lease.findFirst({
    where: {
      id: leaseId,
      membership: { organizationId },
      unit: { property: { organizationId } },
    },
    include: {
      unit: { include: { property: true } },
      membership: {
        include: { user: { select: { name: true, email: true, phone: true } } },
      },
    },
  });
  if (!lease) return null;

  return {
    id: lease.id,
    reference: leaseReference(lease.id),
    status: leaseStatus(new Date(), lease.startDate, lease.endDate),
    tenant: {
      membershipId: lease.membershipId,
      name:
        lease.membership.user.name ??
        lease.membership.user.email ??
        lease.membership.user.phone ??
        "Unnamed",
      phone: lease.membership.user.phone,
      email: lease.membership.user.email,
    },
    unit: {
      id: lease.unit.id,
      label: lease.unit.label,
      unitType: lease.unit.unitType,
      floor: lease.unit.floor,
      block: lease.unit.block,
      sizeSqm: lease.unit.sizeSqm,
      rentAmount: lease.unit.rentAmount,
    },
    property: {
      id: lease.unit.property.id,
      name: lease.unit.property.name,
      address: lease.unit.property.address,
      category: lease.unit.property.category,
    },
    startDate: lease.startDate,
    endDate: lease.endDate,
    durationMonths: lease.durationMonths,
    leaseAmount: lease.leaseAmount,
  };
}

export type LeaseUnitOption = {
  id: string;
  label: string;
  rentAmount: number;
  /** Floors the duration the form will accept for this unit. */
  minTenureMonths: number | null;
};

export type LeaseOptions = {
  properties: { id: string; name: string; units: LeaseUnitOption[] }[];
  tenants: { membershipId: string; name: string }[];
};

/**
 * Drives the property → unit → tenant cascade.
 *
 * A unit counts as available when it has no lease that ends in the future,
 * which excludes both current occupants and units already committed to an
 * upcoming lease. Properties with nothing available are dropped so the first
 * step never leads to an empty second step.
 */
export async function getLeaseOptions(organizationId: string): Promise<LeaseOptions> {
  const now = new Date();

  const [properties, tenantMemberships] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: {
        units: {
          where: { leases: { none: { endDate: { gte: now } } } },
          orderBy: { label: "asc" },
        },
      },
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
    properties: properties
      .filter((property) => property.units.length > 0)
      .map((property) => ({
        id: property.id,
        name: property.name,
        units: property.units.map((unit) => ({
          id: unit.id,
          label: unit.label,
          rentAmount: unit.rentAmount,
          minTenureMonths: unit.minTenureMonths,
        })),
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
 * Everything the client sent is re-checked here rather than trusted from the
 * options payload it fetched earlier: the unit must belong to the named
 * property *and* to this org, the membership must be a Tenant in this org, the
 * term must clear the unit's minimum tenure, and the resulting period must not
 * overlap an existing lease on that unit.
 */
export async function createLease(organizationId: string, input: CreateLeaseInput) {
  const unit = await prisma.unit.findFirst({
    where: {
      id: input.unitId,
      propertyId: input.propertyId,
      property: { organizationId },
    },
    select: { id: true, minTenureMonths: true, rentAmount: true },
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

  if (unit.minTenureMonths != null && input.durationMonths < unit.minTenureMonths) {
    return {
      error: "duration-too-short" as const,
      minTenureMonths: unit.minTenureMonths,
    };
  }

  const endDate = addMonths(input.startDate, input.durationMonths);

  // Half-open interval, so a lease starting the day another ends is allowed.
  const overlapping = await prisma.lease.findFirst({
    where: {
      unitId: unit.id,
      startDate: { lt: endDate },
      endDate: { gt: input.startDate },
    },
    select: { id: true },
  });
  if (overlapping) return { error: "unit-occupied" as const };

  const lease = await prisma.lease.create({
    data: {
      unitId: unit.id,
      membershipId: membership.id,
      startDate: input.startDate,
      endDate,
      durationMonths: input.durationMonths,
      // Locked in at the rent that applied when the lease was signed, so a
      // later change to the unit's rentAmount doesn't rewrite this lease's history.
      leaseAmount: unit.rentAmount * input.durationMonths,
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
