import { buildContractPlan } from "@/lib/contracts";
import { publishEvent } from "@/lib/events/publisher";
import { prisma } from "@/lib/prisma";
import { insertLease, type RenewalAnnouncement } from "@/lib/leases";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AutoRenewalResult = {
  renewed: string[];
  skipped: { leaseId: string; reason: string }[];
  /**
   * The renewals this call actually performed, for `announceLeaseRenewals`.
   *
   * Returned rather than emailed from in here: this runs at the top of a page
   * render, and `publishMail` waits on a broker round trip. Handing the work
   * back lets the caller put it in `after()`, so an unreachable RabbitMQ
   * delays nothing a person is looking at. Empty on a throttled call, which is
   * most of them.
   */
  renewals: RenewalAnnouncement[];
  /** True when the sweep was skipped because one ran recently. */
  throttled?: true;
};

/**
 * When each organization last swept, so ordinary navigation stops paying for
 * a candidate query it will almost never find anything in. Renewal is a
 * date-boundary event — being a few minutes late to notice one is invisible,
 * while a query on every single page view is not.
 *
 * Per process, like any in-memory throttle: another instance sweeps on its own
 * schedule, which is harmless because the sweep is idempotent.
 */
const lastSweptAt = new Map<string, number>();
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * No scheduler exists in this app — this runs lazily at the top of the pages
 * most likely to be loaded regularly (`/leases`, `/dashboard`). Idempotent by
 * construction: a lease with a successor (`renewedTo` set) drops out of
 * `candidates` on the next call, and `renewedFromId` is unique so a race can't
 * attach two successors to one lease.
 *
 * Scoped to one organization at a time, matching every other org-scoped query
 * here — through both the membership and the unit's property.
 */
export async function runAutoRenewals(
  organizationId: string,
  { force = false }: { force?: boolean } = {}
): Promise<AutoRenewalResult> {
  const now = new Date();

  const since = now.getTime() - (lastSweptAt.get(organizationId) ?? 0);
  if (!force && since < SWEEP_INTERVAL_MS) {
    return { renewed: [], skipped: [], renewals: [], throttled: true };
  }
  // Stamped before the work, not after: a failed sweep shouldn't be retried by
  // every concurrent request, and the next one will pick the lease up anyway.
  lastSweptAt.set(organizationId, now.getTime());

  await syncLeaseStatuses(organizationId, now);

  const candidates = await prisma.lease.findMany({
    where: {
      endDate: { lte: now },
      renewedTo: null,
      membership: { organizationId },
      unit: { autoRenew: true, property: { organizationId } },
    },
    include: { unit: true },
  });

  const renewed: string[] = [];
  const skipped: { leaseId: string; reason: string }[] = [];
  const renewals: RenewalAnnouncement[] = [];

  for (const lease of candidates) {
    if (lease.unit.minTenureMonths == null) {
      skipped.push({ leaseId: lease.id, reason: "unit has no minimum tenure set" });
      continue;
    }

    // Start the day after the old lease ends — guarantees no overlap
    // regardless of the half-open interval's edge behavior.
    const startDate = new Date(lease.endDate.getTime() + DAY_MS);

    const result = await insertLease({
      unitId: lease.unitId,
      membershipId: lease.membershipId,
      startDate,
      durationMonths: lease.unit.minTenureMonths,
      // Carries the agreed rate forward rather than repricing to the unit's
      // asking rent: a renewal continues the arrangement, and silently
      // re-rating a negotiated lease is not something a job should decide.
      monthlyRent: lease.monthlyRent,
      renewedFromId: lease.id,
    });

    if (result.error) {
      skipped.push({ leaseId: lease.id, reason: result.error });
    } else {
      renewed.push(lease.id);
      // The *new* lease's id, plus the date the old term ended — the email
      // leads with "your lease ended on X and has renewed".
      renewals.push({
        leaseId: result.lease.id,
        previousEndDate: lease.endDate,
      });
    }
  }

  return { renewed, skipped, renewals };
}

/**
 * Moves stored `Lease.status` forward as dates pass: Upcoming → Active once
 * started, anything not yet Ended → Ended once its end date is behind us.
 * Same rule `leaseStatus()` applies at write time. Idempotent — each
 * `updateMany` only matches rows still in the old state.
 */
export async function syncLeaseStatuses(organizationId: string, now = new Date()) {
  const scope = { membership: { organizationId }, unit: { property: { organizationId } } };

  const ended = await prisma.lease.updateMany({
    where: { ...scope, status: { not: "Ended" }, endDate: { lt: now } },
    data: { status: "Ended" },
  });
  const started = await prisma.lease.updateMany({
    where: { ...scope, status: "Upcoming", startDate: { lte: now }, endDate: { gte: now } },
    data: { status: "Active" },
  });

  return { ended: ended.count, started: started.count };
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
 * `runAutoRenewals` — the gap Phase 66 predicted almost exactly: "a third
 * caller of `runAutoRenewals` would have to remember the `after()` line."
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
