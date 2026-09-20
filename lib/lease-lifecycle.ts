import { buildContractPlan } from "@/lib/contracts";
import { publishEvent } from "@/lib/events/publisher";
import { announceLeaseRenewals, insertLease, type RenewalAnnouncement } from "@/lib/leases";
import { prisma } from "@/lib/prisma";

/**
 * What jarvis does when `automatifier` says a lease's term is up.
 *
 * That service owns the **clock** — a daily scan, an outbox, one event per
 * overdue lease — and this app owns the **tables**. So the message is an
 * instruction to act, never a source of truth: everything the action depends
 * on (which unit, whose membership, what rent, whether a successor already
 * exists) is re-read here from the row, because a scan's snapshot can be days
 * old and a stale rent must not become the rent on a new lease.
 *
 * Both handlers are **idempotent**, which is what makes an at-least-once bus
 * safe: a redelivered `lease.renewal` finds the lease already `Renewed` and
 * does nothing, and a redelivered `lease.vacating` updates nothing because the
 * status guard no longer matches.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** What a handler tells the worker to do with the message it was given. */
export type LifecycleOutcome =
  /** Acted, or already actioned — either way the broker can drop it. */
  | { action: "done"; detail: string }
  /**
   * Will never succeed: the lease is gone, or the message disagrees with the
   * row about which organization it belongs to. Retrying cannot fix either.
   */
  | { action: "drop"; detail: string }
  /** Might succeed later — a database that blinked. Worth one more go. */
  | { action: "retry"; detail: string };

/**
 * The lease, plus everything either handler needs, in one read.
 *
 * `organizationId` is reached through both the membership *and* the unit's
 * property, the same two checks every org-scoped query here makes — the id in
 * the message is a claim, and a claim is not a tenancy boundary.
 */
async function loadLease(leaseId: string) {
  return prisma.lease.findUnique({
    where: { id: leaseId },
    select: {
      id: true,
      status: true,
      endDate: true,
      durationMonths: true,
      monthlyRent: true,
      unitId: true,
      membershipId: true,
      renewedTo: { select: { id: true } },
      membership: { select: { organizationId: true } },
      unit: {
        select: {
          minTenureMonths: true,
          autoRenew: true,
          property: { select: { organizationId: true } },
        },
      },
    },
  });
}

type LoadedLease = NonNullable<Awaited<ReturnType<typeof loadLease>>>;

/** The organization this lease actually belongs to, or null if its two sides disagree. */
function organizationOf(lease: LoadedLease): string | null {
  const viaMembership = lease.membership.organizationId;
  return viaMembership === lease.unit.property.organizationId ? viaMembership : null;
}

/**
 * `lease.renewal` — write the successor lease.
 *
 * Goes through `insertLease`, the same overlap-checked path the manual
 * "Create lease" button and the old in-app sweep use, so an event about a unit
 * somebody re-let by hand cannot double-book it. `insertLease` also marks this
 * lease `Renewed` in its own transaction.
 *
 * The term comes from the unit's `minTenureMonths`, falling back to the length
 * of the lease being renewed — a renewal continues an arrangement, and the
 * rent is carried forward rather than re-rated, which is not a job's decision
 * to make.
 */
export async function handleLeaseRenewal(leaseId: string): Promise<LifecycleOutcome> {
  const lease = await loadLease(leaseId);
  if (!lease) {
    return { action: "drop", detail: `lease ${leaseId} no longer exists` };
  }

  const organizationId = organizationOf(lease);
  if (!organizationId) {
    return {
      action: "drop",
      detail: `lease ${leaseId} spans two organizations — refusing to act on it`,
    };
  }

  // The renewal already happened: a redelivery, or a person who renewed by
  // hand between the scan and now. Both are "nothing left to do".
  if (lease.renewedTo || lease.status === "Renewed") {
    return { action: "done", detail: `lease ${leaseId} already has a successor` };
  }

  /*
   * A unit's minimum tenure is the renewal term — but only when it is a real
   * one. It is nullable *and* holds 0 on plenty of live units, and a zero-month
   * renewal would write a lease that ends the day it starts, with an invoice
   * for nothing. Both fall back to the term being renewed.
   */
  const tenure = lease.unit.minTenureMonths;
  const durationMonths = tenure && tenure > 0 ? tenure : lease.durationMonths;

  // The day after the old term ends, so the half-open overlap test can never
  // read the two as colliding.
  const startDate = new Date(lease.endDate.getTime() + DAY_MS);

  const result = await insertLease({
    unitId: lease.unitId,
    membershipId: lease.membershipId,
    startDate,
    durationMonths,
    monthlyRent: lease.monthlyRent,
    renewedFromId: lease.id,
  });

  /*
   * `unit-occupied` — the only way `insertLease` refuses — means the unit was
   * re-let while this event was in flight, so the tenancy did end; it just
   * ended in a way nobody told automatifier about. Closing the lease is the
   * honest record, and it stops the same event arriving forever.
   */
  if (result.error) {
    await endLease(lease.id);
    return {
      action: "done",
      detail: `lease ${leaseId} could not renew — unit already re-let; marked Ended`,
    };
  }

  const renewals = [{ leaseId: result.lease.id, previousEndDate: lease.endDate }];

  /*
   * Mail and contract are announced **after** the write, and neither can fail
   * the message: both swallow their own errors, and the lease is already
   * correct without them. Same split the in-app sweep made, for the same
   * reason — a broker round trip has no business deciding whether a renewal
   * counts as done.
   */
  await announceLeaseRenewals(organizationId, renewals);
  await queueContractsForRenewals(organizationId, renewals);

  return {
    action: "done",
    detail: `lease ${leaseId} renewed as ${result.lease.id} (${durationMonths} months from ${startDate.toISOString().slice(0, 10)})`,
  };
}

/**
 * `lease.vacating` — the term is up on a unit that does not auto-renew, so the
 * tenancy is over.
 *
 * Guarded on the status rather than checked first: `updateMany` reporting zero
 * rows *is* the idempotency, where a read-then-write would leave a window two
 * deliveries could both pass through.
 */
async function endLease(leaseId: string) {
  const { count } = await prisma.lease.updateMany({
    where: { id: leaseId, status: { in: ["Upcoming", "Active"] } },
    data: { status: "Ended" },
  });
  return count;
}

export async function handleLeaseVacating(leaseId: string): Promise<LifecycleOutcome> {
  const lease = await loadLease(leaseId);
  if (!lease) {
    return { action: "drop", detail: `lease ${leaseId} no longer exists` };
  }

  if (!organizationOf(lease)) {
    return {
      action: "drop",
      detail: `lease ${leaseId} spans two organizations — refusing to act on it`,
    };
  }

  /*
   * A lease that was renewed is **not** vacated, whatever the event says: the
   * two messages are published from one scan and the unit's `autoRenew` can be
   * switched between them, so the row is the tiebreak. Overwriting `Renewed`
   * with `Ended` would erase a successor that exists.
   */
  if (lease.renewedTo || lease.status === "Renewed") {
    return {
      action: "done",
      detail: `lease ${leaseId} was renewed after the scan — leaving it Renewed`,
    };
  }

  const count = await endLease(lease.id);

  return {
    action: "done",
    detail: count
      ? `lease ${leaseId} marked Ended — tenant vacating`
      : `lease ${leaseId} was already Ended`,
  };
}

/**
 * Moves stored `Lease.status` forward for leases whose **start** date has
 * arrived: Upcoming → Active.
 *
 * The other direction needs nothing here — a term ending is exactly what
 * `lease.renewal` and `lease.vacating` announce, and both handlers write the
 * status themselves. This is the transition no event covers, because a lease
 * starting is not an event anybody publishes.
 *
 * Every organization at once: it runs from the cron endpoint, which is not
 * scoped to one, and the condition is a date rather than anything org-specific.
 * Idempotent — the `Upcoming` guard is what makes a second run in the same
 * hour match nothing.
 */
export async function syncLeaseStatuses(now = new Date()) {
  const { count } = await prisma.lease.updateMany({
    where: { status: "Upcoming", startDate: { lte: now }, endDate: { gte: now } },
    data: { status: "Active" },
  });

  return { started: count };
}

/**
 * Queues a contract for each lease an auto-renewal sweep just created.
 *
 * `insertLease` announces nothing itself (Phase 66) so a renewal can't be
 * mistaken for a brand-new lease — but that left **contract generation**
 * unwired too: `buildContractPlan` + `publishEvent("lease.created", …)` only
 * ever ran from `POST /api/leases` and the Contract tab's Generate button, so
 * a renewed lease sat with no document until someone noticed the empty tab
 * and clicked Generate by hand.
 *
 * One function rather than copied into each page that calls
 * the renewal handler above, and by anything else that ever creates a
 * renewal lease.
 * Both existing callers wrap this the same way they already wrap
 * `announceLeaseRenewals`, in `after()`, for the same reason: a template read
 * and a broker round trip have no business blocking a page render.
 *
 * Never throws — `buildContractPlan` returns its failures and `publishEvent`
 * swallows its own, both logging rather than surfacing, matching how the lease
 * route treats the identical two calls.
 */
export async function queueContractsForRenewals(
  organizationId: string,
  renewals: RenewalAnnouncement[]
) {
  for (const renewal of renewals) {
    const plan = await buildContractPlan(organizationId, renewal.leaseId);

    if ("error" in plan) {
      console.warn(
        `[lease-renewal] no contract queued for ${renewal.leaseId}: ${plan.error.message}`
      );
      continue;
    }

    await publishEvent("lease.created", plan.plan.event);
  }
}
