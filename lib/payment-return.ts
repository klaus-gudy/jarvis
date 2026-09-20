/**
 * Reading a payment gateway's return URL, for `/payment-complete`.
 *
 * **Nothing here is evidence that anything was paid.** Every value arrives as a
 * query parameter on a URL the payer's browser followed, so anyone can type
 * `?status=success` and see the happy page. The page built on this reports a
 * claim; it must never grant anything. When checkout lands, what unlocks a
 * package is the gateway's server-to-server callback writing a row.
 */

/**
 * What we tell the payer happened. Four states rather than two, because both
 * extras are the common case here: mobile money settles after the redirect
 * (`pending` is not a failure, and calling it one sends people to pay twice),
 * and a provider that redirects with no status at all is normal (`unknown`).
 */
export type PaymentOutcome = "succeeded" | "pending" | "failed" | "unknown";

/**
 * Status words seen in the wild, lower-cased — the vocabularies a Tanzanian
 * checkout would plausibly meet, plus the plain English a hand-rolled
 * integration sends. A cancellation maps to `failed`, whose copy says only
 * that nothing was taken, which is true of both.
 *
 * An unrecognised word falls through to `unknown` rather than to a default:
 * that is a gap in this table, and reporting it as a definite outcome would
 * hide the gap behind a confident sentence.
 */
const OUTCOME_BY_STATUS: Record<string, PaymentOutcome> = {
  success: "succeeded",
  successful: "succeeded",
  succeeded: "succeeded",
  completed: "succeeded",
  paid: "succeeded",
  approved: "succeeded",

  pending: "pending",
  processing: "pending",
  ongoing: "pending",
  queued: "pending",
  initiated: "pending",

  failed: "failed",
  failure: "failed",
  error: "failed",
  declined: "failed",
  rejected: "failed",
  insufficient_funds: "failed",
  cancelled: "failed",
  canceled: "failed",
  aborted: "failed",
  abandoned: "failed",
};

/**
 * A search param collapsed to one value. Next hands back `string[]` when a key
 * repeats — a gateway appending its own `status` to one already in the return
 * URL is how — so the provider's word, the later one, wins.
 */
export function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[value.length - 1] : value;
}

export function normalizePaymentOutcome(raw: string | undefined): PaymentOutcome {
  if (!raw) return "unknown";
  return OUTCOME_BY_STATUS[raw.trim().toLowerCase()] ?? "unknown";
}

/**
 * The transaction reference, if it looks like one.
 *
 * React escapes what it renders, so this is not about scripts — it is about a
 * crafted link putting a *sentence* on a page that otherwise reads as ours
 * ("…your card was stolen, call this number"). A reference is an opaque
 * machine token, so anything with a space in it is not one and is dropped.
 */
export function safeReference(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return /^[A-Za-z0-9._:-]{4,64}$/.test(trimmed) ? trimmed : null;
}
