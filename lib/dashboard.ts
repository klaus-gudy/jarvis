import { prisma } from "@/lib/prisma";
import { TENANT_ROLE_NAME } from "@/lib/roles";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A lease occupies its unit when it has started and hasn't ended yet. */
function activeLeaseFilter(now: Date, organizationId: string) {
  return {
    startDate: { lte: now },
    endDate: { gte: now },
    membership: { organizationId },
  };
}

/**
 * Whole months a lease's term shares with the given calendar year.
 *
 * Counted in months rather than days because that is the unit the money is
 * expressed in: `leaseAmount` is `rentAmount * durationMonths`, so a month is
 * indivisible here and a lease that starts mid-month still bills that month in
 * full.
 */
function leaseMonthsInYear(
  startDate: Date,
  durationMonths: number,
  year: number
): number {
  const leaseStart = startDate.getFullYear() * 12 + startDate.getMonth();
  const leaseEnd = leaseStart + durationMonths; // exclusive
  const yearStart = year * 12;
  const yearEnd = yearStart + 12; // exclusive

  return Math.max(0, Math.min(leaseEnd, yearEnd) - Math.max(leaseStart, yearStart));
}

export type DashboardStats = {
  rent: {
    /**
     * What the signed leases are worth across this calendar year. A lease
     * counts in full the moment it exists — signing is the collection event,
     * there being no payment record to go on.
     */
    collected: number;
    /** Every unit's asking rent added up — one month of a fully let portfolio. */
    expectedMonthly: number;
    /** `expectedMonthly` over twelve months. The ceiling `collected` is measured against. */
    expectedYear: number;
    /** `collected` as a percentage of `expectedYear`. */
    collectedPercent: number;
  };
  properties: {
    total: number;
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
  };
  tenants: {
    total: number;
    active: number;
    prospect: number;
  };
  leases: {
    total: number;
    active: number;
    expiringSoon: number;
  };
};

const EMPTY_STATS: DashboardStats = {
  rent: {
    collected: 0,
    expectedMonthly: 0,
    expectedYear: 0,
    collectedPercent: 0,
  },
  properties: {
    total: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    occupancyRate: 0,
  },
  tenants: { total: 0, active: 0, prospect: 0 },
  leases: { total: 0, active: 0, expiringSoon: 0 },
};

/** Leases ending within this window count as "expiring soon". */
const EXPIRY_WINDOW_DAYS = 60;

/**
 * Every figure on the dashboard, scoped to one organization.
 *
 * Leases are scoped through both the membership and the unit's property: the
 * schema doesn't stop a lease joining a membership in one org to a unit in
 * another, and such a row must never reach this org's totals.
 */
export async function getDashboardStats(
  organizationId: string | null
): Promise<DashboardStats> {
  if (!organizationId) return EMPTY_STATS;

  const now = new Date();
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const expiryCutoff = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * DAY_MS);

  const orgLease = {
    membership: { organizationId },
    unit: { property: { organizationId } },
  };
  const tenantRole = {
    organizationId,
    role: { name: { equals: TENANT_ROLE_NAME, mode: "insensitive" as const } },
  };

  const [
    properties,
    units,
    occupiedUnits,
    tenantsTotal,
    tenantsActive,
    tenantsProspect,
    leasesTotal,
    leasesActive,
    leasesExpiringSoon,
    yearLeases,
  ] = await Promise.all([
    prisma.property.count({ where: { organizationId } }),
    // Asking rents, not a count: they are what the portfolio is expected to
    // earn, and the row count falls out of the array anyway.
    prisma.unit.findMany({
      where: { property: { organizationId } },
      select: { rentAmount: true },
    }),
    prisma.unit.count({
      where: {
        property: { organizationId },
        leases: { some: activeLeaseFilter(now, organizationId) },
      },
    }),
    prisma.membership.count({ where: tenantRole }),
    prisma.membership.count({
      where: {
        ...tenantRole,
        leases: { some: { startDate: { lte: now }, endDate: { gte: now } } },
      },
    }),
    prisma.membership.count({ where: { ...tenantRole, leases: { none: {} } } }),
    prisma.lease.count({ where: orgLease }),
    prisma.lease.count({
      where: { ...orgLease, startDate: { lte: now }, endDate: { gte: now } },
    }),
    prisma.lease.count({
      where: {
        ...orgLease,
        startDate: { lte: now },
        endDate: { gte: now, lte: expiryCutoff },
      },
    }),
    // Only leases whose term touches this calendar year can contribute rent to
    // it, so the loop below never sees an irrelevant row.
    prisma.lease.findMany({
      where: {
        ...orgLease,
        startDate: { lt: yearEnd },
        endDate: { gt: yearStart },
      },
      select: { startDate: true, durationMonths: true, leaseAmount: true },
    }),
  ]);

  // A lease's whole value counts as collected, but only the part of its term
  // that lands in this year — otherwise a 24-month lease would book two years
  // of rent against one year's expectation and push the bar past 100%.
  let collected = 0;
  for (const lease of yearLeases) {
    if (lease.durationMonths <= 0) continue;
    const monthlyRent = lease.leaseAmount / lease.durationMonths;
    collected +=
      monthlyRent * leaseMonthsInYear(lease.startDate, lease.durationMonths, year);
  }
  collected = Math.round(collected);

  const totalUnits = units.length;
  const expectedMonthly = units.reduce((sum, unit) => sum + unit.rentAmount, 0);
  const expectedYear = expectedMonthly * 12;

  return {
    rent: {
      collected,
      expectedMonthly,
      expectedYear,
      collectedPercent:
        expectedYear === 0 ? 0 : Math.round((collected / expectedYear) * 100),
    },
    properties: {
      total: properties,
      totalUnits,
      occupiedUnits,
      vacantUnits: totalUnits - occupiedUnits,
      occupancyRate:
        totalUnits === 0 ? 0 : Math.round((occupiedUnits / totalUnits) * 100),
    },
    tenants: {
      total: tenantsTotal,
      active: tenantsActive,
      prospect: tenantsProspect,
    },
    leases: {
      total: leasesTotal,
      active: leasesActive,
      expiringSoon: leasesExpiringSoon,
    },
  };
}
