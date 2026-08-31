import { invoiceReference } from "@/lib/invoice-types";
import { leaseReference } from "@/lib/leases";
import {
  sendInvoiceOverdueToOwner,
  type InvoiceFacts,
} from "@/lib/mail/billing";
import {
  sendLeaseExpiringToOwner,
  type ExpiringLease,
} from "@/lib/mail/leases";
import { getOwnerRecipients, type Recipient } from "@/lib/notifications/recipients";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/user-display";

/**
 * The scheduled half of the notification catalogue: what a query can find but
 * no request will ever trigger.
 *
 * Runs across every organization, unlike everything else in `lib/` — a cron
 * job has no active org. Org scoping still matters and is carried through: the
 * recipients and the dedupe rows are per organization, reached from the lease
 * or invoice rather than assumed.
 *
 * **Idempotent by the database, not by care.** Every send is claimed first by
 * inserting a unique `dedupeKey`; a duplicate insert throws and the send is
 * skipped. Two overlapping cron hits therefore cannot both mail the same
 * landlord, which no amount of "check then send" would guarantee.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Matches `EXPIRY_SOON_DAYS` / `EXPIRY_URGENT_DAYS` in `lib/leases.ts`, so the
 * emails land on the same boundaries the UI already flags. */
const EXPIRY_TIERS = [60, 30] as const;

/** How often an overdue invoice is chased, and for how long. */
const OVERDUE_INTERVAL_DAYS = 7;
/** After two months of weekly notices, more email is not the answer. */
const MAX_OVERDUE_NOTICES = 8;

export type SweepResult = {
  leaseExpiring: number;
  invoiceOverdue: number;
  /** Found and due, but already sent on an earlier run. Never an error — on a
   * healthy hourly schedule this is what almost every run reports. */
  skipped: number;
};

/**
 * Claims one notification. Returns false when it has already been sent.
 *
 * The insert *is* the lock: `dedupeKey` is unique, so the loser of a race gets
 * a constraint violation rather than a second email. Claiming before sending
 * means a crash mid-send loses that one notice — which is the right way round,
 * since a missed reminder is a smaller problem than a duplicated one.
 */
async function claim(
  organizationId: string,
  type: string,
  dedupeKey: string
): Promise<boolean> {
  try {
    await prisma.notificationLog.create({
      data: { organizationId, type, dedupeKey },
    });
    return true;
  } catch {
    return false;
  }
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/* ------------------------------------------------------------------ *
 * lease.expiring
 * ------------------------------------------------------------------ */

async function sweepExpiringLeases(now: Date) {
  const horizon = new Date(now.getTime() + EXPIRY_TIERS[0] * DAY_MS);

  const leases = await prisma.lease.findMany({
    where: {
      // Only a lease that has actually started can be "ending soon" — an
      // upcoming short lease is near its end date without that meaning
      // anything yet. Same rule as `leaseExpiry()` in `lib/leases.ts`.
      startDate: { lte: now },
      endDate: { gte: now, lte: horizon },
      // A lease that already has a successor has been dealt with.
      renewedTo: null,
    },
    select: {
      id: true,
      endDate: true,
      monthlyRent: true,
      unit: {
        select: {
          label: true,
          autoRenew: true,
          minTenureMonths: true,
          property: { select: { name: true, organizationId: true } },
        },
      },
      membership: {
        select: {
          organizationId: true,
          user: { select: { name: true, email: true, phone: true } },
        },
      },
    },
  });

  const ownersByOrg = new Map<string, Recipient[]>();
  let sent = 0;
  let skipped = 0;

  for (const lease of leases) {
    // A unit that renews itself needs no decision from anyone, and the
    // landlord copy says as much in so many words. Telling someone to act on
    // something the app is about to do for them is worse than silence.
    // Not counted as skipped: `skipped` means "already sent", and this lease
    // was never eligible in the first place.
    if (lease.unit.autoRenew && lease.unit.minTenureMonths != null) continue;

    const daysLeft = daysBetween(now, lease.endDate);
    // The tightest tier this lease has reached. A lease created with 20 days
    // to run gets the 30-day notice and never the 60 — it was never eligible.
    const tier = EXPIRY_TIERS.find((days) => daysLeft <= days);
    if (tier === undefined) continue;

    const organizationId = lease.membership.organizationId;
    if (!(await claim(organizationId, "lease.expiring", `lease.expiring:${lease.id}:${tier}`))) {
      skipped += 1;
      continue;
    }

    const facts: ExpiringLease = {
      leaseId: lease.id,
      reference: leaseReference(lease.id),
      tenantName: displayName(lease.membership.user),
      propertyName: lease.unit.property.name,
      unitLabel: lease.unit.label,
      endDate: lease.endDate,
      daysLeft,
      monthlyRent: lease.monthlyRent,
    };

    if (!ownersByOrg.has(organizationId)) {
      ownersByOrg.set(organizationId, await getOwnerRecipients(organizationId));
    }

    for (const owner of ownersByOrg.get(organizationId)!) {
      await sendLeaseExpiringToOwner(facts, owner);
    }
    sent += 1;
  }

  return { sent, skipped };
}

/* ------------------------------------------------------------------ *
 * invoice.overdue
 * ------------------------------------------------------------------ */

async function sweepOverdueInvoices(now: Date) {
  const overdue = await prisma.invoice.findMany({
    where: { dueDate: { lt: now } },
    select: {
      id: true,
      amount: true,
      dueDate: true,
      leaseId: true,
      lease: {
        select: {
          unit: { select: { label: true, property: { select: { name: true } } } },
          membership: {
            select: {
              organizationId: true,
              user: { select: { name: true, email: true, phone: true } },
            },
          },
        },
      },
    },
  });

  if (overdue.length === 0) return { sent: 0, skipped: 0 };

  // One grouped aggregate rather than a nested `payments` include, matching
  // `paidByInvoice` in `lib/payments.ts`: a balance is derived, not a column,
  // so it can't be filtered in SQL — but it can be summed there.
  const totals = await prisma.payment.groupBy({
    by: ["invoiceId"],
    where: { invoiceId: { in: overdue.map((invoice) => invoice.id) } },
    _sum: { amount: true },
  });
  const paidByInvoice = new Map(
    totals.map((total) => [total.invoiceId, total._sum.amount ?? 0])
  );

  const ownersByOrg = new Map<string, Recipient[]>();
  let sent = 0;
  let skipped = 0;

  for (const invoice of overdue) {
    const paid = paidByInvoice.get(invoice.id) ?? 0;
    const balance = invoice.amount - paid;
    if (balance <= 0) continue;

    const daysLate = daysBetween(invoice.dueDate, now);
    const notice = Math.floor(daysLate / OVERDUE_INTERVAL_DAYS);
    if (notice >= MAX_OVERDUE_NOTICES) continue;

    const organizationId = invoice.lease.membership.organizationId;
    // The notice index is part of the key, so each week is a fresh occasion
    // and the same invoice can legitimately be chased again.
    const claimed = await claim(
      organizationId,
      "invoice.overdue",
      `invoice.overdue:${invoice.id}:${notice}`
    );
    if (!claimed) {
      skipped += 1;
      continue;
    }

    const facts: InvoiceFacts = {
      invoiceId: invoice.id,
      reference: invoiceReference(invoice.id),
      leaseId: invoice.leaseId,
      amount: invoice.amount,
      paid,
      balance,
      dueDate: invoice.dueDate,
      tenantName: displayName(invoice.lease.membership.user),
      tenantPhone: invoice.lease.membership.user.phone,
      propertyName: invoice.lease.unit.property.name,
      unitLabel: invoice.lease.unit.label,
    };

    if (!ownersByOrg.has(organizationId)) {
      ownersByOrg.set(organizationId, await getOwnerRecipients(organizationId));
    }

    for (const owner of ownersByOrg.get(organizationId)!) {
      await sendInvoiceOverdueToOwner(facts, daysLate, owner);
    }
    sent += 1;
  }

  return { sent, skipped };
}

export async function runNotificationSweep(
  now = new Date()
): Promise<SweepResult> {
  const leases = await sweepExpiringLeases(now);
  const invoices = await sweepOverdueInvoices(now);

  return {
    leaseExpiring: leases.sent,
    invoiceOverdue: invoices.sent,
    skipped: leases.skipped + invoices.skipped,
  };
}
