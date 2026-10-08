/** The business's clock — what "today" means to a landlord reading the app. */
export const APP_TIME_ZONE = "Africa/Dar_es_Salaam";

const DAY_MS = 24 * 60 * 60 * 1000;

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Today's calendar date in Dar es Salaam, as UTC midnight.
 *
 * Lease dates are stored as UTC midnight (a date, not an instant), so this is
 * the shape they must be compared against. Subtracting `now` itself counts the
 * hours already gone today and undercounts by a day for most of it.
 */
export function startOfTodayUtc(now: Date = new Date()) {
  return new Date(`${ymd.format(now)}T00:00:00Z`);
}

/** Whole calendar days from `from` to `to`; both must be UTC-midnight dates. */
export function calendarDaysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * The last day a lease runs — what every screen, email and contract calls its
 * end date.
 *
 * `Lease.endDate` is stored **exclusive**: start + N months, the first day the
 * tenant no longer has (a 1 Sep lease for 12 months stores 1 Sep next year).
 * Overlap checks, occupancy and the Active→Ended flip all compare against that
 * stored value, so it stays; people read the day before. Day counts measure to
 * this date too, so on the last day a lease "ends today". Also used for a
 * coverage date, which is exclusive in the same way.
 */
export function lastDayOf(exclusiveEnd: Date | string) {
  return new Date(new Date(exclusiveEnd).getTime() - DAY_MS);
}
