import { prisma } from "@/lib/prisma";
import { insertLease } from "@/lib/leases";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AutoRenewalResult = {
  renewed: string[];
  skipped: { leaseId: string; reason: string }[];
};

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
export async function runAutoRenewals(organizationId: string): Promise<AutoRenewalResult> {
  const now = new Date();

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
      rentAmount: lease.unit.rentAmount,
      renewedFromId: lease.id,
    });

    if (result.error) skipped.push({ leaseId: lease.id, reason: result.error });
    else renewed.push(lease.id);
  }

  return { renewed, skipped };
}
