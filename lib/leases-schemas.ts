import { z } from "zod";

/**
 * Common lease terms, in months. Offered as suggestions only — the duration
 * field accepts any whole number of months, so a term outside this list is
 * perfectly valid. The end date is derived from whatever is entered.
 */
export const DURATION_OPTIONS = [3, 6, 12, 18, 24, 36] as const;

/**
 * Adds whole months, clamping to the end of the month rather than overflowing:
 * 31 Jan + 1 month is 28 Feb, not 3 Mar. Dates are UTC midnight (parsed from a
 * yyyy-mm-dd string), so UTC accessors are used throughout to stop a local
 * timezone offset shifting the day.
 *
 * Lives here rather than in lib/leases.ts so the form can preview the end date
 * without pulling Prisma into the client bundle.
 */
export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);
  if (result.getUTCDate() < day) {
    // Rolled into the following month — step back to the intended month's last day.
    result.setUTCDate(0);
  }
  return result;
}

export const createLeaseSchema = z.object({
  // Sent so the server can prove the unit really belongs to the property the
  // user picked, rather than trusting the cascade the client rendered.
  propertyId: z.string().trim().min(1, "Select a property"),
  unitId: z.string().trim().min(1, "Select a unit"),
  membershipId: z.string().trim().min(1, "Select a tenant"),
  startDate: z.coerce.date({ error: "Start date is required" }),
  durationMonths: z
    .number({ error: "Select a duration" })
    .int("Duration must be a whole number of months")
    .min(1, "Duration must be at least 1 month")
    .max(120, "Duration cannot exceed 120 months"),
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
