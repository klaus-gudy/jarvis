import {
  sendLeaseCreatedToOwner,
  sendLeaseCreatedToTenant,
  sendLeaseRenewedToOwner,
  sendLeaseRenewedToTenant,
  type LeaseFacts,
} from "@/lib/mail/leases";
import { getProfilePhotoIds } from "@/lib/documents";
import { getOwnerRecipients } from "@/lib/notifications/recipients";
import { prisma } from "@/lib/prisma";
import { invoiceReference } from "@/lib/invoice-types";
import { displayName } from "@/lib/user-display";
import {
  addMonths,
  type CreateLeaseInput,
  type UpdateLeaseInput,
} from "@/lib/leases-schemas";
import { deriveInvoiceStatus, type InvoiceStatus } from "@/lib/invoices";
import { TENANT_ROLE_NAME } from "@/lib/roles";

export type LeaseStatus = "Active" | "Upcoming" | "Ended";

export type InvoiceSummary = {
  id: string;
  amount: number;
  paid: number;
  status: InvoiceStatus;
};

function invoiceSummary(invoice: {
  id: string;
  amount: number;
  payments: { amount: number }[];
}): InvoiceSummary {
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return { id: invoice.id, amount: invoice.amount, paid, status: deriveInvoiceStatus(invoice.amount, paid) };
}

export type LeaseRow = {
  id: string;
  membershipId: string;
  tenantName: string;
  photoId: string | null;
  unitLabel: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  /** The rate agreed for this lease, which may differ from the unit's asking rent. */
  monthlyRent: number;
  leaseAmount: number;
  status: LeaseStatus;
  /** Set only while the lease is running and inside the 60-day window. */
  expiry: LeaseExpiry | null;
  invoice: InvoiceSummary | null;
  /**
   * The lease's own unit, carried so the edit form can prefill it. It has to
   * come from the row rather than from `getLeaseOptions`, which lists only
   * *free* units — a let unit is by definition absent from that list, so
   * without this the form would open with an empty Unit field.
   */
  propertyId: string;
  unitId: string;
  unitRentAmount: number;
  unitMinTenureMonths: number | null;
};

function leaseStatus(now: Date, startDate: Date, endDate: Date): LeaseStatus {
  if (startDate > now) return "Upcoming";
  if (endDate < now) return "Ended";
  return "Active";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A lease this close to its end date is worth flagging in a list. */
const EXPIRY_SOON_DAYS = 60;
/** …and this close is worth flagging harder. */
const EXPIRY_URGENT_DAYS = 30;

export type LeaseExpiry = {
  /** `urgent` inside 30 days, `soon` inside 60 — escalating as the date nears,
   * matching the renewals panel, which already golds anything under 30. */
  tier: "urgent" | "soon";
  daysLeft: number;
};

/**
 * Worked out here rather than in the table so the clock can't disagree with
 * itself: a client component computing `Date.now()` during render produces one
 * answer on the server and another on hydration, and a lease sitting on a
 * threshold would flicker between tiers.
 *
 * Only a lease that has actually started can be "ending soon" — an upcoming
 * short lease is near its end date without that meaning anything yet.
 */
export function leaseExpiry(
  now: Date,
  startDate: Date,
  endDate: Date
): LeaseExpiry | null {
  if (startDate > now || endDate < now) return null;

  const daysLeft = Math.floor((endDate.getTime() - now.getTime()) / DAY_MS);
  if (daysLeft > EXPIRY_SOON_DAYS) return null;

  return {
    tier: daysLeft <= EXPIRY_URGENT_DAYS ? "urgent" : "soon",
    daysLeft,
  };
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
      unit: { include: { property: { select: { id: true, name: true } } } },
      membership: {
        include: { user: { select: { name: true, email: true, phone: true } } },
      },
      invoice: { include: { payments: { select: { amount: true } } } },
    },
  });

  const photoIds = await getProfilePhotoIds(
    organizationId,
    leases.map((lease) => lease.membershipId)
  );

  return leases.map((lease) => ({
    id: lease.id,
    membershipId: lease.membershipId,
    tenantName:
      lease.membership.user.name ??
      lease.membership.user.email ??
      lease.membership.user.phone ??
      "Unnamed",
    photoId: photoIds.get(lease.membershipId) ?? null,
    unitLabel: lease.unit.label,
    propertyName: lease.unit.property.name,
    startDate: lease.startDate.toISOString(),
    endDate: lease.endDate.toISOString(),
    durationMonths: lease.durationMonths,
    monthlyRent: lease.monthlyRent,
    leaseAmount: lease.leaseAmount,
    status: leaseStatus(now, lease.startDate, lease.endDate),
    expiry: leaseExpiry(now, lease.startDate, lease.endDate),
    invoice: lease.invoice ? invoiceSummary(lease.invoice) : null,
    propertyId: lease.unit.property.id,
    unitId: lease.unitId,
    unitRentAmount: lease.unit.rentAmount,
    unitMinTenureMonths: lease.unit.minTenureMonths,
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
  /** The rate agreed for this lease, which may differ from the unit's asking rent. */
  monthlyRent: number;
  leaseAmount: number;
  invoice: InvoiceSummary | null;
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
      invoice: { include: { payments: { select: { amount: true } } } },
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
    monthlyRent: lease.monthlyRent,
    leaseAmount: lease.leaseAmount,
    invoice: lease.invoice ? invoiceSummary(lease.invoice) : null,
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
 * The overlap check plus the atomic Lease+Invoice write, shared by the public
 * `createLease` (manual, from the UI) and the auto-renewal job in
 * `lib/lease-renewal.ts` — one place owns the overlap-safety guarantee so a
 * renewal can never double-book a unit a person has already re-let by hand.
 */
export async function insertLease(params: {
  unitId: string;
  membershipId: string;
  startDate: Date;
  durationMonths: number;
  /** The agreed rate — the unit's asking rent unless it was negotiated. */
  monthlyRent: number;
  renewedFromId?: string;
}) {
  const endDate = addMonths(params.startDate, params.durationMonths);

  // Half-open interval, so a lease starting the day another ends is allowed.
  const overlapping = await prisma.lease.findFirst({
    where: {
      unitId: params.unitId,
      startDate: { lt: endDate },
      endDate: { gt: params.startDate },
    },
    select: { id: true },
  });
  if (overlapping) return { error: "unit-occupied" as const };

  const lease = await prisma.$transaction(async (tx) => {
    const created = await tx.lease.create({
      data: {
        unitId: params.unitId,
        membershipId: params.membershipId,
        startDate: params.startDate,
        endDate,
        durationMonths: params.durationMonths,
        // Both locked in at the rate agreed when the lease was signed, so a
        // later change to the unit's rentAmount doesn't rewrite this lease's history.
        monthlyRent: params.monthlyRent,
        leaseAmount: params.monthlyRent * params.durationMonths,
        renewedFromId: params.renewedFromId,
      },
      select: { id: true, leaseAmount: true, startDate: true },
    });
    // Returned, not discarded: both the new-lease and the renewal email name
    // the invoice this raises, and re-reading it afterwards would be a second
    // query for a row we are holding.
    const invoice = await tx.invoice.create({
      data: {
        leaseId: created.id,
        amount: created.leaseAmount,
        dueDate: created.startDate,
      },
      select: { id: true, amount: true, dueDate: true },
    });
    return { ...created, endDate, invoice };
  });

  return { lease };
}

/**
 * Everything the client sent is re-checked here rather than trusted from the
 * options payload it fetched earlier: the unit must belong to the named
 * property *and* to this org, the membership must be a Tenant in this org, the
 * term must clear the unit's minimum tenure, and the resulting period must not
 * overlap an existing lease on that unit. Creating the lease also generates
 * its invoice, for the full lease value, in the same transaction.
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

  return insertLease({
    unitId: unit.id,
    membershipId: membership.id,
    startDate: input.startDate,
    durationMonths: input.durationMonths,
    // A negotiated rate wins; absent one, the unit's asking rent stands.
    monthlyRent: input.monthlyRent ?? unit.rentAmount,
  });
}

/**
 * Corrects an existing lease — the wrong unit, the wrong term, the wrong start.
 *
 * The lease is *re-derived* rather than patched: the end date and value are
 * recomputed from the unit's rent as it stands now, and the invoice is brought
 * back in step in the same transaction. That deliberately departs from the
 * "locked in at signing" rule `insertLease` follows, because an edit is a
 * correction of the record, not the passage of time — the form shows the new
 * total before it is saved so the change can't be a surprise.
 *
 * Payments already recorded are the one thing an edit can't invalidate: if the
 * corrected value is below what the tenant has paid, the edit is refused
 * rather than leaving an invoice that is somehow overpaid.
 */
export async function updateLease(
  organizationId: string,
  leaseId: string,
  input: UpdateLeaseInput
) {
  const existing = await prisma.lease.findFirst({
    where: {
      id: leaseId,
      membership: { organizationId },
      unit: { property: { organizationId } },
    },
    select: {
      id: true,
      invoice: {
        select: { id: true, payments: { select: { amount: true } } },
      },
    },
  });
  if (!existing) return { error: "not-found" as const };

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

  // Same half-open overlap test as `insertLease`, minus this lease — a lease
  // always overlaps itself, so without the exclusion no edit could ever save.
  const overlapping = await prisma.lease.findFirst({
    where: {
      id: { not: existing.id },
      unitId: unit.id,
      startDate: { lt: endDate },
      endDate: { gt: input.startDate },
    },
    select: { id: true },
  });
  if (overlapping) return { error: "unit-occupied" as const };

  const monthlyRent = input.monthlyRent ?? unit.rentAmount;
  const leaseAmount = monthlyRent * input.durationMonths;
  const paid =
    existing.invoice?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
  if (paid > leaseAmount) {
    return { error: "amount-below-paid" as const, paid, leaseAmount };
  }

  const lease = await prisma.$transaction(async (tx) => {
    const updated = await tx.lease.update({
      where: { id: existing.id },
      data: {
        unitId: unit.id,
        membershipId: membership.id,
        startDate: input.startDate,
        endDate,
        durationMonths: input.durationMonths,
        monthlyRent,
        leaseAmount,
      },
      select: { id: true },
    });

    // Leases predating the billing migration have no invoice; there is simply
    // nothing to keep in step for those.
    if (existing.invoice) {
      await tx.invoice.update({
        where: { id: existing.invoice.id },
        data: { amount: leaseAmount, dueDate: input.startDate },
      });
    }

    return updated;
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

/* ------------------------------------------------------------------ *
 * Notifications
 *
 * Deliberately *not* emitted from `insertLease`, which cannot tell the two
 * apart: it is the shared write for both a manual lease and an auto-renewal,
 * so announcing from inside it would send "new lease" for every renewal as
 * well. Each caller announces its own event instead.
 * ------------------------------------------------------------------ */

/** Everything either lease email renders, in one read. */
export async function leaseFacts(leaseId: string): Promise<LeaseFacts | null> {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      durationMonths: true,
      monthlyRent: true,
      leaseAmount: true,
      invoice: { select: { id: true, dueDate: true } },
      unit: { select: { label: true, property: { select: { name: true } } } },
      membership: { select: { user: { select: { name: true, email: true, phone: true } } } },
    },
  });
  // No invoice means the lease predates billing — nothing here can name one,
  // and inventing a reference would be worse than sending nothing.
  if (!lease?.invoice) return null;

  return {
    leaseId: lease.id,
    reference: leaseReference(lease.id),
    tenantName: displayName(lease.membership.user),
    tenantEmail: lease.membership.user.email,
    propertyName: lease.unit.property.name,
    unitLabel: lease.unit.label,
    startDate: lease.startDate,
    endDate: lease.endDate,
    durationMonths: lease.durationMonths,
    monthlyRent: lease.monthlyRent,
    leaseAmount: lease.leaseAmount,
    invoiceReference: invoiceReference(lease.invoice.id),
    invoiceDueDate: lease.invoice.dueDate,
  };
}

/** `lease.created` — to the tenant and every owner. Never throws. */
export async function announceLeaseCreated(
  organizationId: string,
  leaseId: string
) {
  const facts = await leaseFacts(leaseId);
  if (!facts) return;

  await sendLeaseCreatedToTenant(facts);
  for (const owner of await getOwnerRecipients(organizationId)) {
    await sendLeaseCreatedToOwner(facts, owner);
  }
}

/** One renewal the sweep performed, as much of it as an email needs. */
export type RenewalAnnouncement = {
  /** The lease that was *created*, not the one that ended. */
  leaseId: string;
  previousEndDate: Date;
};

/** `lease.renewed` — to the tenant and every owner, for each renewal. */
export async function announceLeaseRenewals(
  organizationId: string,
  renewals: RenewalAnnouncement[]
) {
  if (renewals.length === 0) return;

  // Read once for the whole batch: a sweep that renews eight leases in one
  // organization should not fetch the same owner list eight times.
  const owners = await getOwnerRecipients(organizationId);

  for (const renewal of renewals) {
    const facts = await leaseFacts(renewal.leaseId);
    if (!facts) continue;

    await sendLeaseRenewedToTenant(facts, renewal.previousEndDate);
    for (const owner of owners) {
      await sendLeaseRenewedToOwner(facts, renewal.previousEndDate, owner);
    }
  }
}
