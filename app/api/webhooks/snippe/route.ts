import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseSnippeEvent, verifySnippeSignature } from "@/lib/billing/snippe-webhook";

/**
 * snippe's webhook — the URL submitted in their dashboard as
 * `https://www.rentoo.co.tz/api/webhooks/snippe`.
 *
 * This is the trusted half of a payment; `/payment-complete` is the other. The
 * page shows the payer whatever their redirect URL claims; this endpoint only
 * believes what arrives signed with `SNIPPE_WEBHOOK_SECRET`. Outside the
 * `proxy.ts` matcher like every API route, so there is no session to check —
 * the signature is the authentication.
 *
 * The response codes are chosen for snippe's retry loop (five attempts over
 * about 45 minutes, on anything that isn't 2xx):
 *
 * - **200** once the event is stored — or was already, since a redelivery is
 *   success, not an error.
 * - **401** for a bad or stale signature. A forged request is retried by
 *   nobody; a genuine one failing here means our secret is wrong, and the
 *   retries buy time to fix it.
 * - **503** when the secret is unset. Refused rather than accepted unsigned:
 *   an open endpoint that writes payment records is worse than a missed one,
 *   and snippe will redeliver once the variable is in place.
 * - **500** when the database write fails, so snippe tries again.
 *
 * It stores **before** it answers, against snippe's advice to acknowledge
 * first and process later. Their advice protects slow handlers from the
 * 30-second timeout; ours is one insert, and acknowledging first would mean an
 * insert that then fails is a payment we told snippe we had, and never did.
 */

/**
 * A real delivery is a couple of kilobytes. The cap stops somebody without the
 * secret making us buffer an arbitrarily large body just to reject it.
 */
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const secret = process.env.SNIPPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[snippe] SNIPPE_WEBHOOK_SECRET is not set — refusing webhook");
    return Response.json({ error: "Not configured" }, { status: 503 });
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.byteLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  const verdict = verifySnippeSignature({
    raw,
    timestamp: request.headers.get("x-webhook-timestamp"),
    signature: request.headers.get("x-webhook-signature"),
    secret,
    nowMs: Date.now(),
  });

  if (!verdict.ok) {
    // The reason is logged, never returned: a sender without the secret has
    // no business learning which check it failed.
    console.warn(`[snippe] rejected webhook: ${verdict.reason}`);
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    console.error("[snippe] signed body is not valid JSON");
    return Response.json({ error: "Malformed body" }, { status: 400 });
  }

  /*
   * The event type comes from the signed body, never the `X-Webhook-Event`
   * header — that header is outside the signature, so it is only as
   * trustworthy as whoever last touched the request.
   */
  const event = parseSnippeEvent(body);
  if (!event) {
    console.error("[snippe] signed body has no event type or reference — not stored");
    return Response.json({ error: "Unrecognised event" }, { status: 400 });
  }

  try {
    await prisma.billingEvent.create({
      data: { ...event, payload: body as Prisma.InputJsonValue },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.log(`[snippe] ${event.eventId} already stored — redelivery acknowledged`);
      return Response.json({ ok: true, duplicate: true });
    }
    console.error(`[snippe] failed to store ${event.eventId}:`, error);
    return Response.json({ error: "Storage failed" }, { status: 500 });
  }

  // No customer name, phone or email in the log line — those live in the row.
  console.log(
    `[snippe] stored ${event.type} ${event.reference} ` +
      `${event.amount ?? "?"} ${event.currency ?? ""} ` +
      `plan=${event.plan ?? "-"}/${event.billing ?? "-"} (${event.eventId})`
  );
  return Response.json({ ok: true });
}
