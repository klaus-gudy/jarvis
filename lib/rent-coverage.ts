import { startOfTodayUtc } from "@/lib/dates";
import { addMonths } from "@/lib/leases-schemas";

/**
 * How far a tenant's payments reach, in months of rent.
 *
 * A lease carries one invoice for the whole term, due on the start date — so
 * "overdue" is true of nearly every running lease that isn't paid off, and
 * says nothing. What a tenant understands is months: rent is covered up to a
 * date, and each month that has started since is owed. Derived here, never
 * stored; nothing about the invoice model changes.
 *
 * Prisma-free so it can be tested on its own.
 */
export type RentCoverage = {
  /** Whole months the payments so far pay for (capped at the term). */
  monthsPaid: number;
  /**
   * The day the first unpaid month starts — rent is covered up to (not
   * including) this date. Equals `endDate` once the whole term is paid.
   */
  coveredUntil: Date;
  /** Months of the term that have started by today (all of them once ended). */
  monthsDue: number;
  /** Money owed for months already started, never more than the balance. */
  amountBehind: number;
  /** `amountBehind` in months, rounded up — a part month still counts as one. */
  monthsBehind: number;
};

export function rentCoverage(
  lease: {
    startDate: Date;
    endDate: Date;
    durationMonths: number;
    monthlyRent: number;
    status: "Upcoming" | "Active" | "Ended" | "Renewed";
  },
  invoice: { amount: number; paid: number },
  now: Date = new Date()
): RentCoverage {
  const { startDate, endDate, durationMonths, monthlyRent } = lease;
  const today = startOfTodayUtc(now);

  const monthsPaid =
    monthlyRent > 0
      ? Math.min(durationMonths, Math.floor(invoice.paid / monthlyRent))
      : durationMonths;
  const coveredUntil =
    monthsPaid >= durationMonths ? endDate : addMonths(startDate, monthsPaid);

  let monthsDue: number;
  if (lease.status === "Upcoming") {
    monthsDue = 0;
  } else if (lease.status === "Active") {
    // A month is due from its first day, so the month running today counts.
    monthsDue = 0;
    while (monthsDue < durationMonths && addMonths(startDate, monthsDue) <= today) {
      monthsDue += 1;
    }
  } else {
    monthsDue = durationMonths;
  }

  const balance = Math.max(0, invoice.amount - invoice.paid);
  const amountBehind = Math.min(
    balance,
    Math.max(0, monthsDue * monthlyRent - invoice.paid)
  );
  const monthsBehind = monthlyRent > 0 ? Math.ceil(amountBehind / monthlyRent) : 0;

  return { monthsPaid, coveredUntil, monthsDue, amountBehind, monthsBehind };
}
