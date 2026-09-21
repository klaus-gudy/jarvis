import { createHmac, timingSafeEqual } from "node:crypto";

import { PRICING_PLANS, type BillingPeriod } from "@/lib/site";

/**
 * Verifying and reading snippe's webhooks — the server-to-server call that
 * says a subscription payment really happened.
 *
 * Spec: https://docs.snippe.sh/docs/2026-01-25/webhooks. The parts this file
 * depends on, so nobody has to re-read the docs to review it:
 *
 * - `X-Webhook-Timestamp` is Unix seconds; `X-Webhook-Signature` is
 *   `hex(HMAC-SHA256(secret, "{timestamp}.{raw body}"))`, 64 characters.
 * - The secret is the whole `whsec_…` string from snippe's dashboard
 *   (Settings → Webhook Secret), used as-is — every example in their docs
 *   keys the HMAC with it unmodified.
 * - Anything older than five minutes is to be refused, as a replay.
 * - Delivery is at-least-once (up to five attempts over ~45 minutes), so the
 *   event `id` is the idempotency key.
 *
 * Pure functions only, no Prisma and no request objects, so the security-
 * critical half can be exercised in isolation.
 */

/** snippe's own replay window, applied in both directions — see `verifySnippeSignature`. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type SignatureVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Whether a delivery was signed by somebody holding our webhook secret, and
 * recently.
 *
 * Takes the body as **raw bytes**, never a parsed object: the signature covers
 * the exact bytes snippe sent, and re-serialising JSON (key order, spacing,
 * escaped unicode) produces a different string that fails for no visible
 * reason. The HMAC is fed the timestamp prefix and then those bytes, which is
 * byte-for-byte the docs' `"{timestamp}.{body}"` without a lossy decode step.
 *
 * The timestamp check is symmetric where snippe's example only rejects the
 * past: a timestamp ten minutes in the *future* is either a broken clock or a
 * forged header, and neither is something to accept a payment from.
 *
 * `reason` is for our logs only — the caller must not echo it to the sender,
 * who has no business learning which check it failed.
 */
export function verifySnippeSignature({
  raw,
  timestamp,
  signature,
  secret,
  nowMs,
}: {
  raw: Buffer;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  nowMs: number;
}): SignatureVerdict {
  if (!timestamp || !signature) {
    return { ok: false, reason: "missing X-Webhook-Timestamp or X-Webhook-Signature" };
  }

  if (!/^\d{1,12}$/.test(timestamp)) {
    return { ok: false, reason: "malformed timestamp" };
  }

  const skew = Math.floor(nowMs / 1000) - Number(timestamp);
  if (Math.abs(skew) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: `timestamp ${skew}s from now, outside ±${SIGNATURE_TOLERANCE_SECONDS}s` };
  }

  const given = signature.trim().toLowerCase();
  // Checked before comparing because `timingSafeEqual` throws on a length
  // mismatch — which would be a 500 and a retry storm instead of a refusal.
  if (!/^[0-9a-f]{64}$/.test(given)) {
    return { ok: false, reason: "malformed signature" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(raw)
    .digest();

  return timingSafeEqual(Buffer.from(given, "hex"), expected)
    ? { ok: true }
    : { ok: false, reason: "signature mismatch" };
}

/** A verified delivery, reduced to what `BillingEvent` stores alongside the raw payload. */
export type SnippeEvent = {
  eventId: string;
  type: string;
  reference: string;
  status: string | null;
  amount: number | null;
  currency: string | null;
  provider: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  plan: string | null;
  billing: BillingPeriod | null;
  occurredAt: Date | null;
};

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function date(value: unknown): Date | null {
  const text = str(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The fields worth querying by, lifted out of a verified body.
 *
 * Reads both payload shapes snippe documents, because which one arrives is a
 * setting on the snippe account rather than anything this app controls:
 *
 * - **2026-01-25** (current): `{ id, type, created_at, data: { reference, … } }`.
 * - **2026-01-01** (legacy): flat, with `event` instead of `type` and **no
 *   event id at all**. Its dedupe key is `event:reference` instead — a given
 *   payment reaches each outcome once, so a redelivery collides with itself
 *   while `payment.failed` and a later `payment.completed` for the same
 *   reference do not.
 *
 * Returns `null` when there is nothing to key the row by. That is a signed
 * body we cannot store idempotently, which the route answers with a 400
 * rather than a row that a redelivery would duplicate.
 */
export function parseSnippeEvent(body: unknown): SnippeEvent | null {
  if (!isObject(body)) return null;

  const type = str(body.type) ?? str(body.event);
  const data = isObject(body.data) ? body.data : body;
  const reference = str(data.reference);
  if (!type || !reference) return null;

  const eventId = str(body.id) ?? `${type}:${reference}`;

  const amount = isObject(data.amount) ? data.amount : null;
  const value = amount?.value;
  const channel = isObject(data.channel) ? data.channel : null;
  const customer = isObject(data.customer) ? data.customer : null;
  const metadata = isObject(data.metadata) ? data.metadata : null;
  const urlMetadata = metadata && isObject(metadata.url_metadata) ? metadata.url_metadata : null;

  return {
    eventId,
    type,
    reference,
    status: str(data.status),
    amount: typeof value === "number" && Number.isSafeInteger(value) ? value : null,
    currency: str(amount?.currency),
    provider: str(channel?.provider) ?? str(data.payment_channel),
    customerName: str(customer?.name),
    customerEmail: str(customer?.email)?.toLowerCase() ?? null,
    customerPhone: str(customer?.phone),
    ...readPlan(urlMetadata),
    occurredAt:
      date(data.completed_at) ?? date(data.failed_at) ?? date(body.created_at) ?? date(data.created_at),
  };
}

/**
 * The package the checkout link was opened for, from the `?meta=` blob
 * `planCheckoutHref` attaches — snippe hands it back as
 * `data.metadata.url_metadata`.
 *
 * Only a known slug and period are lifted into the columns; anything else
 * stays in the raw payload and the columns stay empty.
 *
 * **A signature does not make this true.** It proves snippe sent the event,
 * not that the link was unedited — the blob is base64 in a URL the payer
 * holds, not encrypted. So `plan` records what the link *claimed*; the day
 * something is unlocked by it, the grant must also check that `amount` is
 * that plan's price, or a Mikumi payment with an edited link buys Serengeti.
 */
function readPlan(urlMetadata: Json | null): { plan: string | null; billing: BillingPeriod | null } {
  const slug = str(urlMetadata?.plan);
  const period = str(urlMetadata?.billing);

  return {
    plan: slug && PRICING_PLANS.some((candidate) => candidate.slug === slug) ? slug : null,
    billing: period === "monthly" || period === "yearly" ? period : null,
  };
}
