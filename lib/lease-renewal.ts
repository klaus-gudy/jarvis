import { prisma } from "@/lib/prisma";
import { insertLease } from "@/lib/leases";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AutoRenewalResult = {
  renewed: string[];
  skipped: { leaseId: string; reason: string }[];
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
    return { renewed: [], skipped: [], throttled: true };
  }
  // Stamped before the work, not after: a failed sweep shouldn't be retried by
  // every concurrent request, and the next one will pick the lease up anyway.
  lastSweptAt.set(organizationId, now.getTime());

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

    if (result.error) skipped.push({ leaseId: lease.id, reason: result.error });
    else renewed.push(lease.id);
  }

  return { renewed, skipped };
}
