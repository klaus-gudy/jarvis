import { OWNER_ROLE_NAME } from "@/lib/role-constants";

/**
 * The mail service's wire format, and the settings that decide where a message
 * goes. Dependency-free so anything can import the type.
 */

/**
 * Exactly what the mail service expects on the queue. It renders nothing of its
 * own — it takes a finished email and sends it — so every decision about what a
 * message *says* is made here, in `lib/mail/`, and none of it is made there.
 *
 * `service_name` is snake_case because the consumer's contract says so; it is
 * not this codebase's convention and shouldn't be copied elsewhere.
 */
export type MailMessage = {
  email: string;
  subject: string;
  /** An HTML *fragment*, not a document — see `lib/mail/layout.ts`. */
  content: string;
  service_name: string;
};

/**
 * Every routing key this app publishes. A topic exchange carries them, so the
 * mail service can bind `#` today and split `auth.password.*` or `invoice.*`
 * onto their own queues later without this app changing.
 */
export const MAIL_ROUTING_KEYS = [
  "auth.user.registered",
  "auth.email.verification_requested",
  "auth.password.reset_requested",
  "auth.password.reset_completed",
  "auth.password.changed",
  "auth.login.locked_out",
  "org.created",
  // Section B — invitations
  "invitation.sent",
  // Section C — leases
  "lease.created",
  "lease.renewed",
  "lease.expiring",
  // Section D — billing
  "invoice.paid_in_full",
  "invoice.overdue",
] as const;

export type MailRoutingKey = (typeof MAIL_ROUTING_KEYS)[number];

/**
 * Defaults match `docker-compose.yml`, so a fresh checkout works with no
 * `.env` entry at all. Set `RABBITMQ_URL` on the deploy target.
 */
export const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5682";

/** Topic exchange every email is published to. */
export const MAIL_EXCHANGE = process.env.MAIL_EXCHANGE ?? "jarvis.emails";

/**
 * The queue the `notifier` service consumes. Declared here — by the producer —
 * so publishing to a broker nobody has consumed from yet still durably holds
 * the messages; `notifier` only `checkQueue`s and consumes.
 *
 * **Named for who consumes it, in caps**, matching `DOCUMENT_WORKER_QUEUE` on
 * the events side. It was `emails.outbound`, which is the same lowercase-dotted
 * shape as a routing key — and a queue and a routing key are different things:
 * one is *who reads*, the other is *what happened*. Naming them alike is what
 * made the retired `contracts.generate` queue look like an event.
 *
 * It is `NOTIFIER_EMAIL_QUEUE` rather than something generic because that
 * service also sends SMS: the topic qualifier is what keeps room for a second
 * queue belonging to the same consumer.
 */
export const MAIL_QUEUE = process.env.MAIL_QUEUE ?? "NOTIFIER_EMAIL_QUEUE";

/**
 * Where a message goes when the consumer rejects it, instead of vanishing.
 *
 * `_DEAD`, derived from the queue, same as the events side — and the exchange
 * is **direct**, not fanout. A fanout copies every reject into every bound dead
 * queue, so the moment a second consumer exists each one's failures land in
 * both holding areas. Direct, routed by the originating queue's own name, keeps
 * them apart.
 */
export const MAIL_DLX = `${MAIL_EXCHANGE}.dlx`;
export const MAIL_DLQ = `${MAIL_QUEUE}_DEAD`;

/**
 * When true, **only Owners are emailed an invitation link.**
 *
 * The invitation is the only message in the product that can reach a tenant —
 * everything else about leases, invoices and expiry resolves its recipients
 * through `getOwnerRecipients`, so tenants are already structurally excluded
 * from domain mail. This closes the last door: a tenant invited by staff gets
 * no email, and whoever invited them shares the link by hand, which is how
 * tenant onboarding worked before invitations were emailed at all.
 *
 * Defaults to **on**, matching the "owners only" rule the rest of the mail
 * layer already follows.
 *
 * The cost, stated because it is real: any role that is not Owner — a
 * Caretaker, an Accountant, anything an organization invents — is also not
 * emailed, and a person cannot join without the link. That is survivable only
 * because the suppression is **visible**: the response carries
 * `emailSuppressedForRole` and the invite dialog tells whoever sent it to
 * share the link themselves. Turn this off to email every role.
 *
 *   INVITE_EMAIL_OWNERS_ONLY=true    # the default — Owners only
 *   INVITE_EMAIL_OWNERS_ONLY=false   # email every role, tenants included
 */
export const INVITE_EMAIL_OWNERS_ONLY =
  process.env.INVITE_EMAIL_OWNERS_ONLY !== "false";

/**
 * May someone holding this role be emailed their invitation link?
 *
 * Role names are free text and editable per organization, so this is matched
 * loosely — the same way every other Owner/Tenant lookup in the codebase is.
 */
export function mayEmailInvitation(roleName: string) {
  if (!INVITE_EMAIL_OWNERS_ONLY) return true;
  return roleName.trim().toLowerCase() === OWNER_ROLE_NAME.toLowerCase();
}

/** The `service_name` stamped on every message. */
export const MAIL_SERVICE_NAME = process.env.MAIL_SERVICE_NAME ?? "Jarvis";
