/** ISO 4217 code for the Tanzanian shilling. Defined once so it isn't scattered as a literal. */
export const CURRENCY = "TZS";

/** "TZS 1.4M" — the compact form used in cards and tables. */
export function formatCurrency(amount: number) {
  return `${CURRENCY} ${formatMoney(amount)}`;
}

/** "TZS 1,400,000" — for detail views where the exact figure matters. */
export function formatCurrencyFull(amount: number) {
  return `${CURRENCY} ${formatMoneyFull(amount)}`;
}

/** Compact shilling amounts, matching how rent rolls are read at a glance: 1_400_000 -> "1.4M". */
export function formatMoney(amount: number) {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    // Drop the decimal when it adds nothing: 3.0M reads worse than 3M.
    return `${millions % 1 === 0 ? millions : millions.toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}k`;
  }
  return String(amount);
}

/** Full precision, for detail views where the exact figure matters. */
export function formatMoneyFull(amount: number) {
  return new Intl.NumberFormat("en-US").format(amount);
}

/** "3 days ago", "yesterday" — for activity lists where the exact time is noise. */
export function formatRelativeTime(date: Date, now = new Date()) {
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMinutes = Math.round((date.getTime() - now.getTime()) / 60_000);

  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return formatter.format(diffDays, "day");

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return formatter.format(diffMonths, "month");

  return formatter.format(Math.round(diffMonths / 12), "year");
}

/** "12 Jun" — dense enough for a list row. */
export function formatDayMonth(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
