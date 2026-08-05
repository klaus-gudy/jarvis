import { prisma } from "@/lib/prisma";
import { TENANT_ROLE_NAME } from "@/lib/roles";
import { displayName, primaryContact } from "@/lib/user-display";

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
  vacancy: {
    /** Asking rent of every unit with nobody in it — one month's worth. */
    lossMonthly: number;
    /** `lossMonthly` over twelve months. */
    lossYear: number;
    /** The share of `expectedMonthly` that empty units account for. */
    lossPercent: number;
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
  vacancy: { lossMonthly: 0, lossYear: 0, lossPercent: 0 },
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
    tenantsTotal,
    tenantsActive,
    tenantsProspect,
    leasesTotal,
    leasesActive,
    leasesExpiringSoon,
    yearLeases,
  ] = await Promise.all([
    prisma.property.count({ where: { organizationId } }),
    // Asking rents plus whether anyone is in the unit: that one row carries the
    // expected income, the occupancy split and the vacancy loss, so none of the
    // three needs a query of its own.
    prisma.unit.findMany({
      where: { property: { organizationId } },
      select: {
        rentAmount: true,
        leases: {
          where: activeLeaseFilter(now, organizationId),
          select: { id: true },
          take: 1,
        },
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
  const occupiedUnits = units.filter((unit) => unit.leases.length > 0).length;
  const expectedMonthly = units.reduce((sum, unit) => sum + unit.rentAmount, 0);
  const expectedYear = expectedMonthly * 12;
  // The rent an empty unit isn't earning. This is most of the distance between
  // `collected` and `expectedYear`, so it belongs next to them.
  const lossMonthly = units
    .filter((unit) => unit.leases.length === 0)
    .reduce((sum, unit) => sum + unit.rentAmount, 0);

  return {
    rent: {
      collected,
      expectedMonthly,
      expectedYear,
      collectedPercent:
        expectedYear === 0 ? 0 : Math.round((collected / expectedYear) * 100),
    },
    vacancy: {
      lossMonthly,
      lossYear: lossMonthly * 12,
      lossPercent:
        expectedMonthly === 0
          ? 0
          : Math.round((lossMonthly / expectedMonthly) * 100),
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

/** Renewals are chased this far ahead; wider than the card's "expiring soon" count. */
const RENEWAL_WINDOW_DAYS = 90;
/** Move-ins far enough out to still prepare the unit. */
const MOVE_IN_WINDOW_DAYS = 30;
/** Lists are a glance, not a table — each links through to the full page. */
const PANEL_ROWS = 5;

export type RenewalRow = {
  id: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
  endDate: Date;
  daysLeft: number;
};

export type MoveInRow = {
  id: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
  startDate: Date;
  daysUntil: number;
};

export type VacantUnitRow = {
  id: string;
  label: string;
  propertyId: string;
  propertyName: string;
  rentAmount: number;
  /** Days since the last lease ended, or null when the unit has never been let. */
  daysVacant: number | null;
};

export type NeedsInviteRow = {
  membershipId: string;
  name: string;
  contact: string | null;
  roleName: string;
};

export type ActivityRow = {
  id: string;
  kind: "lease" | "tenant";
  title: string;
  subtitle: string;
  createdAt: Date;
};

export type DashboardPanels = {
  renewals: RenewalRow[];
  moveIns: MoveInRow[];
  vacantUnits: VacantUnitRow[];
  needsInvite: NeedsInviteRow[];
  activity: ActivityRow[];
};

const EMPTY_PANELS: DashboardPanels = {
  renewals: [],
  moveIns: [],
  vacantUnits: [],
  needsInvite: [],
  activity: [],
};

/** Whole days from `from` to `to`, rounded down. Negative when `to` is past. */
function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * The short lists under the summary cards. Separate from `getDashboardStats`
 * so the page can await both at once, and so a slow list can be dropped
 * without touching the figures.
 */
export async function getDashboardPanels(
  organizationId: string | null
): Promise<DashboardPanels> {
  if (!organizationId) return EMPTY_PANELS;

  const now = new Date();
  const renewalCutoff = new Date(now.getTime() + RENEWAL_WINDOW_DAYS * DAY_MS);
  const moveInCutoff = new Date(now.getTime() + MOVE_IN_WINDOW_DAYS * DAY_MS);

  const orgLease = {
    membership: { organizationId },
    unit: { property: { organizationId } },
  };
  const tenantTitle = {
    unit: { select: { label: true, property: { select: { name: true } } } },
    membership: {
      select: { user: { select: { name: true, email: true, phone: true } } },
    },
  } as const;

  const [renewals, moveIns, vacantUnits, needsInvite, recentLeases, recentTenants] =
    await Promise.all([
      prisma.lease.findMany({
        where: {
          ...orgLease,
          startDate: { lte: now },
          endDate: { gte: now, lte: renewalCutoff },
        },
        orderBy: { endDate: "asc" },
        take: PANEL_ROWS,
        select: { id: true, endDate: true, ...tenantTitle },
      }),
      prisma.lease.findMany({
        where: {
          ...orgLease,
          startDate: { gt: now, lte: moveInCutoff },
        },
        orderBy: { startDate: "asc" },
        take: PANEL_ROWS,
        select: { id: true, startDate: true, ...tenantTitle },
      }),
      // Every unit nobody is in right now. The single past lease that comes
      // back is only there to date the vacancy.
      prisma.unit.findMany({
        where: {
          property: { organizationId },
          leases: { none: activeLeaseFilter(now, organizationId) },
        },
        select: {
          id: true,
          label: true,
          rentAmount: true,
          property: { select: { id: true, name: true } },
          leases: {
            where: { endDate: { lt: now } },
            orderBy: { endDate: "desc" },
            take: 1,
            select: { endDate: true },
          },
        },
      }),
      prisma.membership.findMany({
        where: { organizationId, user: { passwordHash: null } },
        orderBy: { createdAt: "desc" },
        take: PANEL_ROWS,
        select: {
          id: true,
          role: { select: { name: true } },
          user: { select: { name: true, email: true, phone: true } },
        },
      }),
      prisma.lease.findMany({
        where: orgLease,
        orderBy: { createdAt: "desc" },
        take: PANEL_ROWS,
        select: { id: true, createdAt: true, ...tenantTitle },
      }),
      prisma.membership.findMany({
        where: {
          organizationId,
          role: { name: { equals: TENANT_ROLE_NAME, mode: "insensitive" } },
        },
        orderBy: { createdAt: "desc" },
        take: PANEL_ROWS,
        select: {
          id: true,
          createdAt: true,
          user: { select: { name: true, email: true, phone: true } },
        },
      }),
    ]);

  const activity: ActivityRow[] = [
    ...recentLeases.map((lease) => ({
      id: `lease-${lease.id}`,
      kind: "lease" as const,
      title: displayName(lease.membership.user),
      subtitle: `Lease signed · ${lease.unit.property.name} / ${lease.unit.label}`,
      createdAt: lease.createdAt,
    })),
    ...recentTenants.map((membership) => ({
      id: `tenant-${membership.id}`,
      kind: "tenant" as const,
      title: displayName(membership.user),
      subtitle: "Tenant added",
      createdAt: membership.createdAt,
    })),
  ]
    // Merged after the fact rather than in SQL: two `take: 5` queries and one
    // sort is cheaper than a union across unrelated tables.
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, PANEL_ROWS + 1);

  return {
    renewals: renewals.map((lease) => ({
      id: lease.id,
      tenantName: displayName(lease.membership.user),
      unitLabel: lease.unit.label,
      propertyName: lease.unit.property.name,
      endDate: lease.endDate,
      daysLeft: daysBetween(now, lease.endDate),
    })),
    moveIns: moveIns.map((lease) => ({
      id: lease.id,
      tenantName: displayName(lease.membership.user),
      unitLabel: lease.unit.label,
      propertyName: lease.unit.property.name,
      startDate: lease.startDate,
      daysUntil: daysBetween(now, lease.startDate),
    })),
    vacantUnits: vacantUnits
      .map((unit) => ({
        id: unit.id,
        label: unit.label,
        propertyId: unit.property.id,
        propertyName: unit.property.name,
        rentAmount: unit.rentAmount,
        daysVacant: unit.leases[0]
          ? daysBetween(unit.leases[0].endDate, now)
          : null,
      }))
      // Never-let units sort first: they are the longest-standing vacancy
      // there is, and no end date means no number to compare.
      .sort((a, b) => (b.daysVacant ?? Infinity) - (a.daysVacant ?? Infinity))
      .slice(0, PANEL_ROWS),
    needsInvite: needsInvite.map((membership) => ({
      membershipId: membership.id,
      name: displayName(membership.user),
      contact: primaryContact(membership.user),
      roleName: membership.role.name,
    })),
    activity,
  };
}
